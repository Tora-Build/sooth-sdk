// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IMarketLPVault} from "./interfaces/IMarketLPVault.sol";
import {ISoothMarketV4} from "../interfaces/ISoothMarketV4.sol";

/// @title MarketLPVault
/// @notice Holds LP assets and manages LP tokens for a Launchpad Market.
/// @dev Tokens are minted by the Market during trading (internal phase) or fee accrual.
///      Redemption is allowed only when the vault holds assets (post-graduation/settlement).
contract MarketLPVault is ERC20, Ownable, IMarketLPVault {
    using SafeERC20 for IERC20;

    // =========================================================================
    // State
    // =========================================================================

    address public immutable override market;
    IERC20 public immutable override asset;
    
    // =========================================================================
    // Constructor
    // =========================================================================

    /// @param _name LP Token Name
    /// @param _symbol LP Token Symbol
    /// @param _market Associated Launchpad Market address
    /// @param _asset Underlying asset address (USDC)
    /// @param _owner Initial owner (likely LaunchpadFactory, then transferred to Market)
    constructor(
        string memory _name,
        string memory _symbol,
        address _market,
        address _asset,
        address _owner
    ) ERC20(_name, _symbol) Ownable(_owner) {
        require(_market != address(0), "LPVault: invalid market");
        require(_asset != address(0), "LPVault: invalid asset");
        
        market = _market;
        asset = IERC20(_asset);
    }

    // =========================================================================
    // Core Functions
    // =========================================================================

    /// @notice Total assets controlled by this vault
    function totalAssets() public view override returns (uint256) {
        return asset.balanceOf(address(this));
    }

    /// @notice Mint LP tokens. Only callable by the owner (Market).
    function mint(address to, uint256 amount) external override onlyOwner {
        _mint(to, amount);
        emit LpTokensAccrued(to, amount);
    }

    /// @notice Burn LP tokens and claim underlying assets.
    /// @dev Exchange rate = totalAssets / totalSupply
    function redeem(uint256 amount) external override returns (uint256 assets) {
        require(amount > 0, "LPVault: zero amount");
        require(balanceOf(msg.sender) >= amount, "LPVault: insufficient balance");
        
        assets = previewRedeem(amount);
        require(assets > 0, "LPVault: zero assets");

        _burn(msg.sender, amount);
        asset.safeTransfer(msg.sender, assets);

        emit LpTokensRedeemed(msg.sender, amount, assets);
    }

    /// @notice Preview redemption amount
    function previewRedeem(uint256 amount) public view override returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return 0;
        return (amount * totalAssets()) / supply;
    }

    // ============ ISoothGovernorVault Implementation ============

    // --- Asset Tracking (Already implemented totalAssets via override) ---
    
    function decimalsScale() external view override returns (uint256) {
        // Cast to address then ERC20 to access implementation-specific decimals() if needed,
        // or ensure asset is ERC20. IERC20 metadata extension includes decimals().
        // For safety/explicit cast:
        return 10 ** (18 - ERC20(address(asset)).decimals());
    }

    // --- Locked Proceeds (Lock-on-Sell) ---

    struct LockEntry {
        uint256 amount;
        uint64 unlockTime;
    }

    struct UserLockState {
        LockEntry[] locks;
        uint256 headIndex;
        uint256 totalLocked;
    }

    mapping(address => UserLockState) private _lockStates;
    uint256 public constant LOCK_DURATION = 24 hours;
    
    function lockProceeds(uint256 marketId, address user, uint256 amount)
        external
        override
        returns (uint64 unlockTime)
    {
        _checkAuthorized();

        require(amount > 0, "Zero amount");
        // Ensure we have enough assets to cover this lock (safety check)
        require(totalAssets() >= _totalLockedForAll() + amount, "Insufficient assets"); 

        UserLockState storage state = _lockStates[user];
        unlockTime = uint64(block.timestamp) + uint64(LOCK_DURATION);
        
        state.locks.push(LockEntry({amount: amount, unlockTime: unlockTime}));
        state.totalLocked += amount;
        totalLockedProceeds += amount; // Global tracking
        
        emit Locked(user, amount, unlockTime);
    }
    
    function _totalLockedForAll() internal view returns (uint256 total) {
        return totalLockedProceeds;
    }
    uint256 public totalLockedProceeds;

    function claimUnlocked(address user, address recipient)
        external
        override
        returns (uint256 claimed)
    {
        _checkAuthorized();
        claimed = _claimUnlockedInternal(user);

        if (claimed > 0) {
            totalLockedProceeds -= claimed;
            asset.safeTransfer(recipient, claimed);
            emit Unlocked(user, claimed);
            emit Claimed(user, claimed);
        }
    }

    function _claimUnlockedInternal(address user) internal returns (uint256 claimed) {
        UserLockState storage state = _lockStates[user];
        uint256 len = state.locks.length;

        for (uint256 i = state.headIndex; i < len; i++) {
            LockEntry storage entry = state.locks[i];
            if (entry.unlockTime <= block.timestamp) {
                claimed += entry.amount;
                state.totalLocked -= entry.amount;
                state.headIndex = i + 1;
            } else {
                break;
            }
        }
    }

    // --- View Functions ---

    function lockedBalance(address user) external view override returns (uint256) {
        return _lockStates[user].totalLocked;
    }

    function claimableBalance(address user) external view override returns (uint256 claimable) {
        UserLockState storage state = _lockStates[user];
        uint256 len = state.locks.length;
        for (uint256 i = state.headIndex; i < len; i++) {
            if (state.locks[i].unlockTime <= block.timestamp) {
                claimable += state.locks[i].amount;
            } else {
                break;
            }
        }
    }

    function getLockEntries(address user) external view override returns (uint256[] memory amounts, uint64[] memory unlockTimes) {
        UserLockState storage state = _lockStates[user];
        uint256 len = state.locks.length;
        uint256 active = len > state.headIndex ? len - state.headIndex : 0;
        amounts = new uint256[](active);
        unlockTimes = new uint64[](active);
        for (uint256 i = 0; i < active; i++) {
            amounts[i] = state.locks[state.headIndex + i].amount;
            unlockTimes[i] = state.locks[state.headIndex + i].unlockTime;
        }
    }

    function nextUnlock(address user) external view override returns (uint256 amount, uint64 unlockTime) {
        UserLockState storage state = _lockStates[user];
        if (state.headIndex < state.locks.length) {
            amount = state.locks[state.headIndex].amount;
            unlockTime = state.locks[state.headIndex].unlockTime;
        }
    }
    
    // --- Funds Flow ---

    function receiveFunds(uint256 marketId, uint256 amount) external override {
        // Funds are strictly pulled or pushed? "Push model".
        // Just verify authorization and emit if needed (GovVault emits MarketFlow).
        _checkAuthorized();
    }

    function sendFunds(uint256 marketId, address recipient, uint256 amount) external override {
        _checkAuthorized();
        require(totalAssets() >= amount, "Insufficient assets");
        asset.safeTransfer(recipient, amount);
    }
    
    // --- Unused/Stubbed Governor Interface ---

    function depositFor(address, uint256) external returns (uint256) {
        revert("LPVault: use mint");
    }
    function withdrawFor(address, uint256, address) external returns (uint256) {
        revert("LPVault: use redeem");
    }
    function allocateExposure(uint256, uint256) external {}
    function releaseExposure(uint256, uint256) external {}
    function getMarketReserve(uint256) external view returns (int256) { return 0; }
    function defaultBBase() external view returns (uint256) { return 0; }
    function defaultFeeBps() external view returns (uint256) { return 0; }
    function reserveFactorBps() external view returns (uint256) { return 0; }

    // --- Helpers ---
    
    function _checkAuthorized() internal view {
        // Allow Owner (Market)
        if (msg.sender == owner()) return;
        
        // Allow Market's TraderVault
        // Correctly cast market to ISoothMarketV4 to get traderVault
        try ISoothMarketV4(market).traderVault() returns (address tv) {
             if (msg.sender == tv) return;
        } catch {
             // Fallback
             (bool success, bytes memory data) = market.staticcall(abi.encodeWithSignature("traderVault()"));
             if (success && data.length == 32) {
                 address tv = abi.decode(data, (address));
                 if (msg.sender == tv) return;
             }
        }
        
        revert("LPVault: unauthorized");
    }
    
    // Events (Redeclared from Governor context if needed, but inheriting interface might not be enough)
    event Locked(address indexed user, uint256 amount, uint64 unlockTime);
    event Unlocked(address indexed user, uint256 amount);
    event Claimed(address indexed user, uint256 amount);
}
