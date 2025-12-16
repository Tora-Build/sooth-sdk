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
    
    // Events are inherited from ILaunchpadMarket interface and SoothMarketBase
    event Locked(address indexed user, uint256 amount, uint64 unlockTime);
    event Unlocked(address indexed user, uint256 amount);
    event Claimed(address indexed user, uint256 amount);
    event LpTokensAccrued(address indexed to, uint256 amount);
    event LpTokensRedeemed(address indexed from, uint256 amount, uint256 assets);
    event MarketLiquidated(uint256 liquidationFee, uint256 refundAmount);
    event LiquidationRefundClaimed(address indexed user, uint256 amount);

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
        address /* _lpVault - not used, market is its own vault */,
        uint256 _creatorDeposit,
        address _assetAddress
    ) external {
        require(creator == address(0), "Launchpad: already init");
        require(_creator != address(0), "Launchpad: zero creator");
        require(_assetAddress != address(0), "Launchpad: zero asset");

        creator = _creator;
        // Ensure base's marketOperator matches creator (set during base.initialize())
        require(marketOperator == _creator, "Launchpad: operator mismatch");
        
        liquidityTierIndex = _liquidityTierIndex;
        deadline = _deadline;
        totalCreatorDeposit = _creatorDeposit;
        factory = msg.sender;
        _asset = IERC20(_assetAddress);
        
        // V6: Mint initial LP tokens to creator (equal to deposit)
        _mint(_creator, _creatorDeposit);
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

    /// @notice Override executeAMMTrade to handle fee splits, LP tokens, and check graduation
    function executeAMMTrade(
        address trader,
        uint8 outcome,
        int256 deltaShares
    ) public override(SoothMarketBase, ISoothMarketV4) onlyTraderVault onlyLive returns (int256 cost, uint256 fee) {
        // Execute base logic (from SoothMarketBase)
        (cost, fee) = super.executeAMMTrade(trader, outcome, deltaShares);
        
        if (!isGraduated) {
            // Track fees for graduation
            feesAccrued += fee;
            
            // Auto-compound liquidity (Increase B)
            // delta_b = fee / 0.693 (1/ln(2) in WAD)
            uint256 deltaB = (fee * 1442695040888963407) / 1e18; // 1/ln(2) in WAD
            bBase += deltaB;
            emit BBaseIncrease(bBase - deltaB, bBase);
            
            // Mint LP tokens to trader (proportional to fee paid)
            // Exchange rate: 1 fee = 1 LP token (1:1 initially, adjusts with totalAssets/totalSupply)
            if (fee > 0) {
                _mint(trader, fee);
                emit LpTokensAccrued(trader, fee);
            }
            
            // Check Graduation
            if (bBase >= graduationThreshold()) {
                graduate();
            }
        } else {
            // Post Graduation: Fee split handled by standard vault logic
            // For V6, we're the vault, so we handle it here
            // 50% liquidity (b growth), 30% LP tokens (exchangeRate), 20% protocol
            // But for simplicity in V6, we'll just grow b and mint LP tokens
            uint256 deltaB = (fee * 1442695040888963407) / 1e18 / 2; // 50% to liquidity
            bBase += deltaB;
            
            // 30% to LP tokens (mint to trader)
            uint256 lpAmount = (fee * 3000) / 10000;
            if (lpAmount > 0) {
                _mint(trader, lpAmount);
                emit LpTokensAccrued(trader, lpAmount);
            }
            
            // 20% to protocol (stays in market, can be claimed by treasury)
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
    
    function decimalsScale() external view override returns (uint256) {
        return 10 ** (18 - IERC20Metadata(address(_asset)).decimals());
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
        require(!isLive && !isGraduated, "Not expired/failed");
        require(msg.sender == creator, "Not creator");
        
        uint256 totalRefund = totalAssets();
        require(totalRefund > 0, "No assets to refund");
        
        _asset.safeTransfer(creator, totalRefund);
        emit CreatorRefunded(creator, totalRefund);
    }
    
    // Guardian functions
    modifier onlyGuardian() {
        address protocolConfig = ILaunchpadFactory(factory).protocolConfig();
        require(
            IProtocolConfig(protocolConfig).guardian() == msg.sender,
            "Launchpad: not guardian"
        );
        _;
    }
    
    function liquidate() external onlyGuardian {
        require(!isGraduated && !isLive, "Launchpad: cannot liquidate");
        require(block.timestamp > deadline, "Launchpad: not expired");
        
        isLiquidated = true;
        isLive = false;
        
        address protocolConfig = ILaunchpadFactory(factory).protocolConfig();
        uint256 liquidationFeeBps = IProtocolConfig(protocolConfig).liquidationFeeBps();
        uint256 totalAssets_ = totalAssets();
        uint256 liquidationFee = (totalAssets_ * liquidationFeeBps) / 10000;
        uint256 refundAmount = totalAssets_ - liquidationFee;
        
        // Transfer liquidation fee to protocol (via factory treasury or protocolConfig)
        if (liquidationFee > 0) {
            // Protocol gets fee - need to determine recipient
            // For now, leave it in market
        }
        
        emit MarketLiquidated(liquidationFee, refundAmount);
    }
    
    function forceGraduate() external onlyGuardian {
        require(!isGraduated, "Launchpad: already graduated");
        isGraduated = true;
        emit MarketGraduated(feesAccrued, block.timestamp);
    }
    
    function claimLiquidationRefund(address user) external {
        require(isLiquidated, "Launchpad: not liquidated");
        require(user == msg.sender || msg.sender == traderVault, "Launchpad: unauthorized");
        
        // Calculate user's share based on LP tokens
        uint256 userLP = balanceOf(user);
        uint256 totalLP = totalSupply();
        require(totalLP > 0, "Launchpad: no LP tokens");
        
        uint256 userShare = (totalAssets() * userLP) / totalLP;
        require(userShare > 0, "Launchpad: no refund");
        
        // Burn LP tokens
        _burn(user, userLP);
        
        // Transfer refund
        _asset.safeTransfer(user, userShare);
        emit LiquidationRefundClaimed(user, userShare);
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
        return (amount * totalAssets()) / supply;
    }
}
