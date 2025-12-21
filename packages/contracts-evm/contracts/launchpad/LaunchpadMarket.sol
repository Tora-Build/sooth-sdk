// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {SoothMarketBase} from "../core/SoothMarketBase.sol";
import {ISoothMarketV4} from "../interfaces/ISoothMarketV4.sol";
import {ISoothLiquidityVault} from "../core/ISoothLiquidityVault.sol";
import {ILaunchpadMarket} from "./interfaces/ILaunchpadMarket.sol";
import {ILaunchpadFactory} from "./interfaces/ILaunchpadFactory.sol";
import {IProtocolConfig} from "../core/ProtocolConfig.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title LaunchpadMarket
/// @notice Launchpad Market with pre-graduation locking and merged LPVault
/// @dev Built on SoothMarketBase architecture (continuous LMSR AMM + orderbook)
///      Market implements ISoothLiquidityVault interface itself (2-contract architecture)
///      Market inherits ERC20 for LP tokens
///      Creator has operator permissions (can increase liquidity, settle market)
contract LaunchpadMarket is SoothMarketBase, ERC20, ISoothLiquidityVault, ILaunchpadMarket {
    using SafeERC20 for IERC20;

    // =========================================================================
    // State
    // =========================================================================

    address public override creator;
    uint8 public override liquidityTierIndex;
    uint40 public override deadline;
    bool public override isGraduated;
    address public override factory;
    
    /// @notice V6: No separate LPVault (market is its own vault)
    function lpVault() external pure override returns (address) {
        return address(0);
    }
    
    // Graduation state
    uint256 public feesAccrued;
    uint256 public totalCreatorDeposit;
    
    // Market is its own vault (implements ISoothLiquidityVault interface)
    IERC20 private _asset;
    
    // Pre-graduation locking
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
    uint256 public override totalLockedProceeds;
    uint256 public constant LOCK_DURATION = 24 hours;
    
    // Guardian liquidation
    bool public isLiquidated;
    
    // =========================================================================
    // Events
    // =========================================================================
    
    // V6 events are declared in ILaunchpadMarket interface
    // Additional events for locking (inherited from ISoothLiquidityVault)
    event Locked(address indexed user, uint256 amount, uint64 unlockTime);
    event Unlocked(address indexed user, uint256 amount);
    event Claimed(address indexed user, uint256 amount);
    event LpTokensAccrued(address indexed to, uint256 amount);

    // =========================================================================
    // Constructor
    // =========================================================================

    constructor() ERC20("Sooth LP", "SLP") {
        // ERC20 name/symbol will be updated in initializeLaunchpad
    }

    // =========================================================================
    // Initialization
    // =========================================================================

    /// @notice Initialize Launchpad Market specific state
    /// @dev Called by Factory immediately after deployment (and SoothMarketBase init)
    ///      Note: Base's marketOperator is set to creator during SoothMarketBase.initialize()
    function initializeLaunchpad(
        address _creator,
        uint8 _liquidityTierIndex,
        uint40 _deadline,
        address,
        uint256 _creatorDeposit,
        address _assetAddress
    ) external {
        require(creator == address(0), "INIT");
        require(_creator != address(0), "ZERO");
        require(_assetAddress != address(0), "ZERO");

        creator = _creator;
        require(marketOperator == _creator, "OP");
        
        liquidityTierIndex = _liquidityTierIndex;
        deadline = _deadline;
        totalCreatorDeposit = _creatorDeposit;
        factory = msg.sender;
        _asset = IERC20(_assetAddress);
        
        uint8 assetDecimals = IERC20Metadata(_assetAddress).decimals();
        _mint(_creator, _creatorDeposit * (10 ** (18 - assetDecimals)));
    }

    // =========================================================================
    // Overrides
    // =========================================================================

    /// @notice Creator has operator permissions (marketOperator == creator)
    modifier onlyOperator() override {
        require(msg.sender == creator, "Launchpad: not creator");
        require(marketOperator == creator, "Launchpad: operator mismatch");
        _;
    }
    
    /// @notice Determine fee based on graduation status
    /// @dev Pre-grad: 5% (500 bps). Post-grad: 1% (100 bps).
    function feeLMSR() public view override(SoothMarketBase, ISoothMarketV4) returns (uint256) {
        if (isGraduated) {
            return 100; // 1%
        } else {
            return 500; // 5%
        }
    }

    /// @notice Override executeAMMTrade to handle fee splits and check graduation
    function executeAMMTrade(
        address trader,
        uint8 outcome,
        int256 deltaShares
    ) public override(SoothMarketBase, ISoothMarketV4) onlyTraderVault onlyLive returns (int256 cost, uint256 fee) {
        // Execute base logic (from SoothMarketBase)
        (cost, fee) = super.executeAMMTrade(trader, outcome, deltaShares);
        
        // V6.1.4: Use shared fee handler (no LP minting for fees)
        _handlePostTradeFees(trader, fee, deltaShares > 0);
    }

    // =========================================================================
    // Direct AMM Trading (V6.1 - Bypass TraderVault)
    // =========================================================================

    /// @notice Direct swap: buy/sell outcome tokens without going through TraderVault
    /// @dev Disabled in Stage 1 of the dual-engine redesign because it mixes
    ///      LMSR state updates (AMM) with minting/burning collateralized outcome tokens (Orderbook).
    ///      This breaks the protocol's dual-ledger separation (AMM positions vs. complete-set tokens).
    /// @param outcome 0 = YES, 1 = NO
    /// @param deltaShares Positive = buy, negative = sell (in 18 decimals)
    /// @param maxCost For buys: max USDC to spend. For sells: min USDC to receive (in USDC decimals)
    function swap(
        uint8 outcome,
        int256 deltaShares,
        int256 maxCost
    ) external onlyLive returns (int256 cost, uint256 fee) {
        (outcome, deltaShares, maxCost);
        revert("Launchpad: direct swap disabled (use TraderVault)");
    }
    
    /// @dev Internal helper to handle post-trade fee logic (LP tokens, graduation check)
    function _handlePostTradeFees(address trader, uint256 fee, bool /* isBuy */) internal {
        if (fee == 0) return;
        
        uint256 supply = totalSupply();
        uint256 assets = totalNetAssets(); // current net assets (includes this fee)
        
        uint256 lpToMint;

        // V6.2.4: Everything is WAD (18 decimals). No scale factor needed for logic.
        // Fair Minting (Anti-dilution) with "Par Floor" protection:
        // We want to mint tokens at the current floor price: Price = (Assets - Fee) / Supply
        
        uint256 preFeeAssets = assets > fee ? assets - fee : 0;
        
        if (supply == 0 || preFeeAssets < supply) {
            // Fallback: If pool is "underwater" or equity is less than 1:1 parity,
            // mint at the initial 1:1 rate (1 unit of fee = 1 LP unit).
            lpToMint = fee;
        } else {
            // Current Price > 1.0: Mint at the fair market rate to avoid diluting existing LPs.
            // lpToMint = fee / Price = (fee * supply) / preFeeAssets
            lpToMint = (fee * supply) / preFeeAssets;
        }

        if (!isGraduated) {
            // Track fees for graduation
            feesAccrued += fee;
            
            // Auto-compound liquidity (benefit existing LPs)
            uint256 deltaB = (fee * 1442695040888963407) / 1e18;
            bBase += deltaB;
            emit BBaseIncrease(bBase - deltaB, bBase);
            
            // Distribute fair LP rewards to traders
            if (lpToMint > 0) {
                _mint(trader, lpToMint);
                emit LpTokensAccrued(trader, lpToMint);
            }
            
            // Check Graduation
            if (bBase >= graduationThreshold()) {
                graduate();
            }
        } else {
            // Post-graduation fee handling: 50% to liquidity depth
            uint256 deltaB = (fee * 1442695040888963407) / 1e18 / 2;
            bBase += deltaB;
            
            // 30% to LP tokens (Fair rewards)
            uint256 lpFromFee = (lpToMint * 3000) / 10000;
            if (lpFromFee > 0) {
                _mint(trader, lpFromFee);
                emit LpTokensAccrued(trader, lpFromFee);
            }
            
            // 20% to protocol stays in market
        }
    }
    
    /// @dev Internal helper to lock proceeds with 24h unlock
    function _lockProceeds(address user, uint256 amount) internal {
        if (amount == 0) return;
        
        UserLockState storage state = _lockStates[user];
        uint64 unlockTime = uint64(block.timestamp + LOCK_DURATION);
        
        state.locks.push(LockEntry({
            amount: amount,
            unlockTime: unlockTime
        }));
        state.totalLocked += amount;
        totalLockedProceeds += amount;
        
        emit Locked(user, amount, unlockTime);
    }
    
    /// @notice Claim unlocked proceeds (called by user directly)
    function claimUnlocked() external returns (uint256 claimed) {
        UserLockState storage state = _lockStates[msg.sender];
        
        uint256 len = state.locks.length;
        for (uint256 i = state.headIndex; i < len; i++) {
            if (state.locks[i].unlockTime <= block.timestamp) {
                claimed += state.locks[i].amount;
                delete state.locks[i];
                state.headIndex = i + 1;
            } else {
                break; // Locks are ordered by time
            }
        }
        
        if (claimed > 0) {
            state.totalLocked -= claimed;
            totalLockedProceeds -= claimed;
            _asset.safeTransfer(msg.sender, claimed);
            emit Claimed(msg.sender, claimed);
        }
    }

    /// @notice Target b = 2 * initial_b (Doubled liquidity)
    function graduationThreshold() public view override returns (uint256) {
        return ILaunchpadFactory(factory).getLiquidityB(liquidityTierIndex) * 2; 
    }

    // =========================================================================
    // ISoothLiquidityVault Implementation
    // =========================================================================

    /// @notice Market is its own vault (implements ISoothLiquidityVault)
    /// @dev Parent's liquidityVault state variable is set to address(this) during initialize()
    
    function asset() external view override returns (IERC20) {
        return _asset;
    }
    
    function totalAssets() public view override returns (uint256) {
        return _asset.balanceOf(address(this));
    }
    
    // =========================================================================
    // Pure AMM Accounting (V6.1.9)
    // =========================================================================

    function ammAssets() public view returns (uint256) {
        uint256 bv = b();
        if (bv == 0) return 0;
        int256 delta = _cost(qYes, qNo, bv) - _cost(0, 0, bv);
        uint256 s = 10 ** (18 - IERC20Metadata(address(_asset)).decimals());
        int256 total = int256(totalCreatorDeposit * s) + int256(feesAccrued) + delta;
        return total > 0 ? uint256(total) : 0;
    }

    function totalNetAssets() public view override returns (uint256) {
        uint256 assets = ammAssets();
        uint256 qY_ = uint256(qYes >= 0 ? qYes : int256(0));
        uint256 qN_ = uint256(qNo >= 0 ? qNo : int256(0));
        uint256 liability = (qY_ > qN_ ? qY_ : qN_);
        return assets > liability ? assets - liability : 0;
    }

    function pureCeilingAssets() public view returns (uint256) {
        uint256 assets = ammAssets();
        uint256 qY_ = uint256(qYes >= 0 ? qYes : int256(0));
        uint256 qN_ = uint256(qNo >= 0 ? qNo : int256(0));
        uint256 liability = (qY_ < qN_ ? qY_ : qN_);
        return assets > liability ? assets - liability : 0;
    }

    function convertSharesToFloor(uint256 shares) external view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return shares;
        return (shares * totalNetAssets()) / supply;
    }

    function lpRealizedPnL() external view returns (int256) {
        uint256 bVal = b();
        if (bVal == 0) return 0;
        return _cost(qYes, qNo, bVal) - _cost(0, 0, bVal);
    }

    function isUnderwater() external view returns (bool) {
        return totalNetAssets() == 0;
    }

    function decimalsScale() external view override returns (uint256) {
        return 10 ** (18 - IERC20Metadata(address(_asset)).decimals());
    }

    /// @notice ERC-4626 standard conversion (Floor-based)
    function convertToAssets(uint256 shares) public view override returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return shares;
        return (shares * totalNetAssets()) / supply;
    }

    /// @notice ERC-4626 standard conversion (Floor-based)
    function convertToShares(uint256 assets) public view override returns (uint256) {
        uint256 supply = totalSupply();
        uint256 netAssets = totalNetAssets();
        if (netAssets == 0 || supply == 0) return assets;
        return (assets * supply) / netAssets;
    }
    
    // Lock-on-Sell implementation
    function lockProceeds(uint256 /* marketId */, address user, uint256 amount)
        external
        override
        returns (uint64 unlockTime)
    {
        _checkAuthorized();
        require(amount > 0, "Zero amount");
        require(totalAssets() >= totalLockedProceeds + amount, "Insufficient assets");

        UserLockState storage state = _lockStates[user];
        unlockTime = uint64(block.timestamp) + uint64(LOCK_DURATION);
        
        state.locks.push(LockEntry({amount: amount, unlockTime: unlockTime}));
        state.totalLocked += amount;
        totalLockedProceeds += amount;
        
        emit Locked(user, amount, unlockTime);
    }
    
    function claimUnlocked(address user, address recipient)
        external
        override
        returns (uint256 claimed)
    {
        _checkAuthorized();
        claimed = _claimUnlockedInternal(user);

        if (claimed > 0) {
            totalLockedProceeds -= claimed;
            _asset.safeTransfer(recipient, claimed);
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
    
    // Use locked proceeds for buying
    function useLockedProceeds(address user, uint256 amount) external {
        _checkAuthorized();
        require(amount > 0, "Zero amount");
        
        UserLockState storage state = _lockStates[user];
        require(state.totalLocked >= amount, "Insufficient locked proceeds");
        
        // Reduce from oldest locks first (FIFO)
        uint256 remaining = amount;
        uint256 len = state.locks.length;
        
        for (uint256 i = state.headIndex; i < len && remaining > 0; i++) {
            LockEntry storage entry = state.locks[i];
            if (entry.amount <= remaining) {
                remaining -= entry.amount;
                state.totalLocked -= entry.amount;
                totalLockedProceeds -= entry.amount;
                state.headIndex = i + 1;
            } else {
                entry.amount -= remaining;
                state.totalLocked -= remaining;
                totalLockedProceeds -= remaining;
                remaining = 0;
            }
        }
        
        require(remaining == 0, "Insufficient locked proceeds");
        // Funds stay in market (no transfer needed, they're already here)
    }
    
    // Funds flow
    function receiveFunds(uint256 /* marketId */, uint256 /* amount */) external view override {
        _checkAuthorized();
    }
    
    function sendFunds(uint256 /* marketId */, address recipient, uint256 amount) external override {
        _checkAuthorized();
        require(totalAssets() >= amount, "Insufficient assets");
        _asset.safeTransfer(recipient, amount);
    }
    
    // Stubbed ISoothLiquidityVault functions
    function depositFor(address, uint256) external pure override returns (uint256) {
        revert("Launchpad: use mint");
    }
    
    function withdrawFor(address, uint256, address) external pure override returns (uint256) {
        revert("Launchpad: use redeem");
    }
    
    function allocateExposure(uint256, uint256) external pure override {}
    function releaseExposure(uint256, uint256) external pure override {}
    function getMarketReserve(uint256) external pure override returns (int256) { return 0; }
    function defaultBBase() external pure override returns (uint256) { return 0; }
    function defaultFeeBps() external pure override returns (uint256) { return 0; }
    function reserveFactorBps() external pure override returns (uint256) { return 0; }
    
    function _checkAuthorized() internal view {
        // Allow TraderVault
        if (msg.sender == traderVault) return;
        // Allow Market itself (for internal calls)
        if (msg.sender == address(this)) return;
        revert("Launchpad: unauthorized");
    }
    
    // Public view for locked proceeds
    function lockedProceeds(address user) external view returns (uint256) {
        return _lockStates[user].totalLocked;
    }

    // =========================================================================
    // External Actions
    // =========================================================================

    function graduate() public override {
        require(!isGraduated, "Already graduated");
        require(bBase >= graduationThreshold(), "Threshold not met");
        
        isGraduated = true;
        emit MarketGraduated(feesAccrued, block.timestamp);
    }

    function expire() external override {
        require(!isGraduated, "Already graduated");
        require(block.timestamp > deadline, "Not expired");
        require(isLive, "Already settled");
        
        isLive = false;
        emit MarketExpired(feesAccrued, totalCreatorDeposit);
    }

    function claimCreatorRefund() external override {
        revert("Launchpad: creator refund removed (use redeemLP)");
    }
    
    // Guardian liquidation/force-graduate are deferred to Stage 2.
    // Stage 1: Failure handling is permissionless via `expire()` + `redeemLP()`.
    function liquidate() external {
        revert("Launchpad: liquidation deferred (Stage 2)");
    }

    function forceGraduate() external {
        revert("Launchpad: forceGraduate deferred (Stage 2)");
    }

    function claimLiquidationRefund(address) external {
        revert("Launchpad: liquidation refunds removed (use redeemLP)");
    }
    
    // LP Token redemption (only after settlement)
    function redeemLP(uint256 amount) external {
        require(!isLive, "Market still active");
        require(amount > 0, "Zero amount");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");
        
        uint256 assets = previewRedeemLP(amount);
        require(assets > 0, "Zero assets");
        
        _burn(msg.sender, amount);
        _asset.safeTransfer(msg.sender, assets);
        
        emit LpTokensRedeemed(msg.sender, amount, assets);
    }
    
    function previewRedeemLP(uint256 amount) public view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return 0;
        uint256 netAssets = totalAssets() > totalLockedProceeds ? totalAssets() - totalLockedProceeds : 0;
        return (amount * netAssets) / supply;
    }

    /// @notice Stage 1 failure UX: allow claiming locked proceeds immediately once the market ends.
    /// @dev Avoids trapping users behind a 24h timer after `expire()` or settlement.
    function claimLockedOnMarketEnd(uint256 maxSteps) external returns (uint256 claimed) {
        require(!isLive, "Market still active");
        UserLockState storage state = _lockStates[msg.sender];

        uint256 len = state.locks.length;
        uint256 steps = 0;

        for (uint256 i = state.headIndex; i < len && steps < maxSteps; i++) {
            claimed += state.locks[i].amount;
            delete state.locks[i];
            state.headIndex = i + 1;
            steps++;
        }

        if (claimed > 0) {
            state.totalLocked -= claimed;
            totalLockedProceeds -= claimed;
            _asset.safeTransfer(msg.sender, claimed);
            emit Claimed(msg.sender, claimed);
        }
    }
}
