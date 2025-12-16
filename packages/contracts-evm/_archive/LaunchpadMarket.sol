// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {SoothMarketV4} from "../core/SoothMarketV4.sol";
import {ISoothMarketV4} from "../interfaces/ISoothMarketV4.sol";
import {ILaunchpadMarket} from "./interfaces/ILaunchpadMarket.sol";
import {ILaunchpadFactory} from "./interfaces/ILaunchpadFactory.sol";
import {IMarketLPVault} from "./interfaces/IMarketLPVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title LaunchpadMarket
/// @notice A market created via the Launchpad. Starts with lower fees that accrue to liquidity.
///         Graduates to "standard" fees once liquidity target is met.
contract LaunchpadMarket is SoothMarketV4, ILaunchpadMarket {
    using SafeERC20 for IERC20;

    // =========================================================================
    // State
    // =========================================================================

    address public override creator;
    uint8 public override liquidityTierIndex;
    uint40 public override deadline;
    bool public override isGraduated;
    address public override lpVault;
    address public override factory;
    
    // Graduation state
    uint256 public feesAccrued;
    uint256 public totalCreatorDeposit;

    // =========================================================================
    // Initialization
    // =========================================================================

    /// @notice Initialize Launchpad Market specific state
    /// @dev Called by Factory immediately after deployment (and V4 init)
    function initializeLaunchpad(
        address _creator,
        uint8 _liquidityTierIndex,
        uint40 _deadline,
        address _lpVault,
        uint256 _creatorDeposit
    ) external {
        require(creator == address(0), "Launchpad: already init");
        require(_lpVault != address(0), "Launchpad: null lpVault");

        creator = _creator;
        liquidityTierIndex = _liquidityTierIndex;
        deadline = _deadline;
        lpVault = _lpVault;
        totalCreatorDeposit = _creatorDeposit;
        factory = msg.sender;
    }

    // =========================================================================
    // Overrides
    // =========================================================================

    
    /// @notice Determine fee based on graduation status
    /// @dev Pre-grad: 5% (500 bps). Post-grad: 1% (100 bps).
    function feeLMSR() public view override(SoothMarketV4, ISoothMarketV4) returns (uint256) {
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
    ) public override(SoothMarketV4, ISoothMarketV4) onlyTraderVault onlyLive returns (int256 cost, uint256 fee) {
        // 1. Execute Base Logic (Cost calc + State update)
        // We cannot call super.executeAMMTrade because it does logic we want to intercept?
        // Actually, SoothMarketV4.executeAMMTrade does:
        // - Calc Cost/Fee
        // - Update reserve += fee
        // - EMIT TradeAMM
        
        // We want to hook into the "reserve += fee" part.
        // If we call super, it adds fee to 'reserve'.
        // We also want to track 'feesAccrued' towards graduation.
        
        // Let's call super first.
        (cost, fee) = super.executeAMMTrade(trader, outcome, deltaShares);
        
        if (!isGraduated) {
            // Track fees for graduation
            feesAccrued += fee;
            
            // Auto-compound liquidity (Increase B)
            // Metric: fees / 0.693 = increase in b
            // 0.693 approx ln(2).
            
            // Precision: fee is in WAD (from Market V4 logic)
            // delta_b = fee * 1e18 / 0.69314718e18
            
            uint256 deltaB = (fee * 1442695040888963407) / 1e18; // 1/ln(2) in WAD
            bBase += deltaB;
            emit BBaseIncrease(bBase - deltaB, bBase);
            
            // Check Graduation
            if (bBase >= graduationThreshold()) {
                graduate();
            }
        } else {
            // Post Graduation
            // Fee split handled by GovernorVault (MarketLPVault) logic or future withdrawals
        }
    }

    /// @notice Target b = 2 * initial_b (Doubled liquidity)
    /// @dev Factory sets initial b based on tier. 
    /// We verify threshold dynamically or store initialB?
    /// We can compute from tier index.
    function graduationThreshold() public view override returns (uint256) {
        return ILaunchpadFactory(factory).getLiquidityB(liquidityTierIndex) * 2; 
    }

    // =========================================================================
    // External Actions
    // =========================================================================

    function graduate() public override {
        require(!isGraduated, "Already graduated");
        // Check threshold
        require(bBase >= graduationThreshold(), "Threshold not met");
        
        isGraduated = true;
        
        // Trigger generic migration/listing?
        // For now, simple state flip. Fees drop.
        
        emit MarketGraduated(feesAccrued, block.timestamp);
    }

    function expire() external override {
        require(!isGraduated, "Already graduated");
        require(block.timestamp > deadline, "Not expired");
        require(isLive, "Already settled");
        
        isLive = false;
        
        // Refund logic
        // We need to return Creator Deposit + Fees.
        // All funds are in LPVault.
        // We need to enable Creator to claim.
        // IMarketLPVault(lpVault).redeem(...) or similar?
        // Creator deposit is 100% of LPVault initially.
        // Plus fees.
        // So Creator owns 100% of LP tokens? 
        // Implementation Detail: Creator never got LP tokens!
        // We need to mint them 100% valid LP tokens at start.
        
        emit MarketExpired(feesAccrued, totalCreatorDeposit);
    }

    function claimCreatorRefund() external override {
        require(!isLive && !isGraduated, "Not expired/failed");
        require(msg.sender == creator, "Not creator");
        
        // Transfer all assets from LPVault directly to Creator
        // Using sendFunds instead of redeem to avoid msg.sender balance check issue
        uint256 totalRefund = IMarketLPVault(lpVault).totalAssets();
        require(totalRefund > 0, "No assets to refund");
        
        IMarketLPVault(lpVault).sendFunds(marketId, creator, totalRefund);
        
        emit CreatorRefunded(creator, totalRefund);
    }
}
