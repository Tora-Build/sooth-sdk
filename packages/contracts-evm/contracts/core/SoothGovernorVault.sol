// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./SoothInterfaces.sol";

/// @notice Governor Vault for LP liquidity management.
/// @dev Simplified architecture: No RiskManager, manual b management.
///      Acts as a pool for LP funds and counterparty for AMM trades.
contract SoothGovernorVault is ISoothGovernorVault, Ownable {
    IERC20 public immutable override asset;
    uint256 public immutable override decimalsScale;
    uint256 public constant LOCK_DURATION = 24 hours;

    // --- LP Share State ---
    string public name = "Sooth LP Shares";
    string public symbol = "sLP";
    uint8 public decimals;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    
    // --- Asset Tracking ---
    uint256 public override totalAssets; 
    
    // --- Market State ---
    mapping(uint256 => int256) public marketReserves; // PnL per market
    mapping(uint256 => uint256) public lockedExposure; // Max loss allocated
    uint256 public totalLockedExposure;
    uint256 public totalLockedProceeds;

    mapping(address => bool) public authorizedSpender;

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

    // --- Vault Configuration (Per-Vault defaults) ---
    uint256 public override defaultBBase;     // Default 'b' for new markets
    uint256 public override defaultFeeBps;    // Default fee for new markets
    uint256 public override reserveFactorBps; // Reserve multiplier (Global)

    // --- Events ---
    event Deposit(address indexed lp, uint256 assets, uint256 shares);
    event Withdraw(address indexed lp, uint256 assets, uint256 shares);
    event MarketFlow(uint256 indexed marketId, int256 amount, int256 newReserve);
    event AuthorizedSet(address indexed who, bool allowed);
    event ExposureAllocated(uint256 indexed marketId, uint256 amount);
    event ExposureReleased(uint256 indexed marketId, uint256 amount);
    event VaultConfigSet(uint256 bBase, uint256 feeBps, uint256 reserveFactor);
    event Locked(address indexed user, uint256 amount, uint64 unlockTime);
    event Unlocked(address indexed user, uint256 amount);
    event Claimed(address indexed user, uint256 amount);

    constructor(IERC20 _asset) {
        asset = _asset;
        uint8 assetDecimals = IERC20Metadata(address(_asset)).decimals();
        decimals = assetDecimals;
        decimalsScale = 10 ** (18 - assetDecimals);

        // Default Config
        defaultBBase = 10000 * 1e18; // 10k USDC
        defaultFeeBps = 50;          // 0.5%
        reserveFactorBps = 1000;     // 0.1x (10%)
    }

    function setVaultConfig(
        uint256 _bBase,
        uint256 _feeBps,
        uint256 _reserveFactorBps
    ) external onlyOwner {
        require(_feeBps <= 1000, "Fee too high"); // Max 10%
        require(_reserveFactorBps <= 5000, "Reserve factor too high"); // Max 0.5x

        defaultBBase = _bBase;
        defaultFeeBps = _feeBps;
        reserveFactorBps = _reserveFactorBps;
        
        emit VaultConfigSet(_bBase, _feeBps, _reserveFactorBps);
    }

    modifier onlyAuthorized() {
        require(authorizedSpender[msg.sender], "GovernorVault: not authorized");
        _;
    }

    function setAuthorized(address who, bool allowed) external onlyOwner {
        authorizedSpender[who] = allowed;
        emit AuthorizedSet(who, allowed);
    }

    // --- Locked Proceeds (Sell-side timelock lives in Governor) ---

    function lockProceeds(uint256 marketId, address user, uint256 amount)
        external
        override
        onlyAuthorized
        returns (uint64 unlockTime)
    {
        require(amount > 0, "Zero amount");
        // Funds are staying in vault, just check we have enough unallocated
        require(totalAssets >= totalLockedProceeds + totalLockedExposure + amount, "Insufficient assets");

        UserLockState storage state = _lockStates[user];

        unlockTime = uint64(block.timestamp) + uint64(LOCK_DURATION);
        state.locks.push(LockEntry({amount: amount, unlockTime: unlockTime}));
        state.totalLocked += amount;
        totalLockedProceeds += amount;

        // Track PnL for this market (user sold shares back to LP)
        marketReserves[marketId] -= int256(amount);
        // DO NOT decrease totalAssets - funds stay in Governor until claimed

        emit Locked(user, amount, unlockTime);
    }

    function claimUnlocked(address user, address recipient)
        external
        override
        onlyAuthorized
        returns (uint256 claimed)
    {
        claimed = _claimUnlockedInternal(user);

        if (claimed > 0) {
            totalLockedProceeds -= claimed;
            totalAssets -= claimed;  // Funds are now leaving the vault
            require(asset.transfer(recipient, claimed), "Transfer failed");
            emit Unlocked(user, claimed);
            emit Claimed(user, claimed);
        }
    }

    function lockedBalance(address user) public view override returns (uint256) {
        return _lockStates[user].totalLocked;
    }

    function claimableBalance(address user) public view override returns (uint256 claimable) {
        UserLockState storage state = _lockStates[user];
        uint256 len = state.locks.length;

        for (uint256 i = state.headIndex; i < len; i++) {
            LockEntry storage entry = state.locks[i];
            if (entry.unlockTime <= block.timestamp) {
                claimable += entry.amount;
            } else {
                break;
            }
        }
    }

    function getLockEntries(address user)
        external
        view
        override
        returns (uint256[] memory amounts, uint64[] memory unlockTimes)
    {
        UserLockState storage state = _lockStates[user];
        uint256 len = state.locks.length;
        uint256 active = len > state.headIndex ? len - state.headIndex : 0;

        amounts = new uint256[](active);
        unlockTimes = new uint64[](active);

        for (uint256 i = 0; i < active; i++) {
            LockEntry storage entry = state.locks[state.headIndex + i];
            amounts[i] = entry.amount;
            unlockTimes[i] = entry.unlockTime;
        }
    }

    function nextUnlock(address user) external view override returns (uint256 amount, uint64 unlockTime) {
        UserLockState storage state = _lockStates[user];
        uint256 len = state.locks.length;
        if (state.headIndex < len) {
            LockEntry storage entry = state.locks[state.headIndex];
            amount = entry.amount;
            unlockTime = entry.unlockTime;
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

    // --- LP Actions ---

    function depositFor(address lp, uint256 assets) external override returns (uint256) {
        require(assets > 0, "Zero deposit");
        
        uint256 shares;
        if (totalSupply == 0) {
            shares = assets;
        } else {
            shares = assets * totalSupply / totalAssets;
        }

        require(asset.transferFrom(msg.sender, address(this), assets), "Transfer failed");
        
        balanceOf[lp] += shares;
        totalSupply += shares;
        totalAssets += assets;
        
        emit Deposit(lp, assets, shares);
        return shares;
    }

    function withdrawFor(address lp, uint256 assets, address receiver) external override returns (uint256) {
        require(msg.sender == lp, "GovernorVault: not authorized");
        require(assets > 0, "Zero withdraw");
        
        uint256 shares;
        if (totalAssets == 0) {
            shares = assets;
        } else {
            shares = assets * totalSupply / totalAssets;
        }
        
        require(balanceOf[lp] >= shares, "Insufficient shares");
        // Protect both market exposure AND locked trader proceeds
        require(totalAssets >= totalLockedExposure + totalLockedProceeds + assets, "Locked funds");

        balanceOf[lp] -= shares;
        totalSupply -= shares;
        totalAssets -= assets;
        
        require(asset.transfer(receiver, assets), "Transfer failed");
        
        emit Withdraw(lp, assets, shares);
        return shares;
    }

    // --- Market Actions ---

    /// @notice Allocate exposure for a market based on its current b parameter
    /// @dev This should be called when market's b increases (governor action or PnL growth)
    /// @param marketId The market ID
    function allocateExposure(uint256 marketId, uint256 amount) external override onlyAuthorized {
        lockedExposure[marketId] += amount;
        totalLockedExposure += amount;
        require(totalLockedExposure <= totalAssets, "Overexposed");
        emit ExposureAllocated(marketId, amount);
    }
    
    /// @notice Update exposure allocation to match market's current b (dynamic solvency)
    /// @dev Can be called by market or governor to sync locked exposure with actual max loss
    /// @param marketId The market ID
    /// @param newExposure New exposure amount (typically equals market's b())
    function updateExposure(uint256 marketId, uint256 newExposure) external onlyAuthorized {
        uint256 oldExposure = lockedExposure[marketId];
        
        // Update tracking
        totalLockedExposure = totalLockedExposure - oldExposure + newExposure;
        lockedExposure[marketId] = newExposure;
        
        require(totalLockedExposure <= totalAssets, "Overexposed");
        
        if (newExposure > oldExposure) {
            emit ExposureAllocated(marketId, newExposure - oldExposure);
        } else if (newExposure < oldExposure) {
            emit ExposureReleased(marketId, oldExposure - newExposure);
        }
    }

    function releaseExposure(uint256 marketId, uint256 amount) external override onlyAuthorized {
        if (amount > lockedExposure[marketId]) amount = lockedExposure[marketId];
        lockedExposure[marketId] -= amount;
        totalLockedExposure -= amount;
        emit ExposureReleased(marketId, amount);
    }

    /// @notice Called when Market/TraderVault sends funds (Profit)
    function receiveFunds(uint256 marketId, uint256 amount) external override onlyAuthorized {
        // Funds assumed to be transferred already (Push model)
        // We trust the authorized caller to have sent the funds
        marketReserves[marketId] += int256(amount);
        totalAssets += amount; 
        emit MarketFlow(marketId, int256(amount), marketReserves[marketId]);
    }

    /// @notice Called when Market requests payment (Loss/Settlement)
    function sendFunds(uint256 marketId, address recipient, uint256 amount) external override onlyAuthorized {
        require(totalAssets >= amount, "Insufficient assets");
        
        marketReserves[marketId] -= int256(amount);
        totalAssets -= amount;
        
        require(asset.transfer(recipient, amount), "Transfer failed");
        emit MarketFlow(marketId, -int256(amount), marketReserves[marketId]);
    }

    function getMarketReserve(uint256 marketId) external view override returns (int256) {
        return marketReserves[marketId];
    }
}
