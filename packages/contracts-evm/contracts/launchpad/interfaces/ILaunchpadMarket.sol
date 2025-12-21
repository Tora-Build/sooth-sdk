// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ISoothMarketV4} from "../../interfaces/ISoothMarketV4.sol";

interface ILaunchpadMarket is ISoothMarketV4 {
    // =========================================================================
    // Events
    // =========================================================================

    /// @notice Emitted when a market graduates (fees >= 2*b)
    event MarketGraduated(uint256 totalFeesAccrued, uint256 graduationTimestamp);

    /// @notice Emitted when a market fails to graduate by deadline
    event MarketExpired(uint256 feesRefunded, uint256 creatorDepositRefunded);

    /// @notice Emitted when creator claims refund after expiry
    event CreatorRefunded(address indexed creator, uint256 amount);

    /// @notice V6: Emitted when market is liquidated (failed to graduate)
    event MarketLiquidated(uint256 liquidationFee, uint256 refundAmount);
    
    /// @notice V6: Emitted when user claims liquidation refund
    event LiquidationRefundClaimed(address indexed user, uint256 amount);
    
    /// @notice V6: Emitted when LP tokens are redeemed
    event LpTokensRedeemed(address indexed from, uint256 amount, uint256 assets);

    // =========================================================================
    // Core Functions
    // =========================================================================

    function initializeLaunchpad(
        address _creator,
        uint8 _liquidityTierIndex,
        uint40 _deadline,
        address _lpVault,
        uint256 _creatorDeposit,
        address _assetAddress
    ) external;

    /// @notice The market creator's address
    function creator() external view returns (address);
    function factory() external view returns (address);

    /// @notice The liquidity tier index (0-3)
    function liquidityTierIndex() external view returns (uint8);

    /// @notice The fee threshold required to graduate (2 * b)
    function graduationThreshold() external view returns (uint256);

    /// @notice Timestamp when the market expires if not graduated
    function deadline() external view returns (uint40);

    /// @notice Whether the market has successfully graduated
    function isGraduated() external view returns (bool);

    /// @notice V6: Returns address(0) - market is its own vault (no separate LPVault)
    function lpVault() external view returns (address);

    /// @notice Triggers graduation if criteria are met. Permissionless.
    function graduate() external;

    /// @notice Triggers expiry if deadline passed without graduation. Permissionless.
    function expire() external;

    /// @notice (Deprecated) Creator refund was removed in favor of pro-rata LP redemption via `redeemLP()`.
    function claimCreatorRefund() external;
    
    /// @notice V6: Use locked proceeds for buying
    function useLockedProceeds(address user, uint256 amount) external;
    
    /// @notice V6: Get locked proceeds for a user
    function lockedProceeds(address user) external view returns (uint256);
    
    /// @notice V6: Total locked proceeds
    function totalLockedProceeds() external view returns (uint256);
    
    /// @notice Whether market has been liquidated (Stage 2 feature; currently unused)
    function isLiquidated() external view returns (bool);

    /// @notice (Deferred) Guardian liquidation is a Stage 2 feature.
    function liquidate() external;

    /// @notice (Deferred) Guardian force-graduate is a Stage 2 feature.
    function forceGraduate() external;

    /// @notice (Deprecated) Liquidation refunds were removed in favor of `redeemLP()`.
    function claimLiquidationRefund(address user) external;
    
    /// @notice V6: Redeem LP tokens for USDC (only after settlement)
    function redeemLP(uint256 amount) external;
    
    /// @notice V6: Preview redeem amount for LP tokens
    function previewRedeemLP(uint256 amount) external view returns (uint256);

    /// @notice Stage 1: claim locked proceeds immediately once market ends.
    function claimLockedOnMarketEnd(uint256 maxSteps) external returns (uint256 claimed);

    // =========================================================================
    // Pure AMM Accounting (V6.1.9)
    // =========================================================================

    /// @notice Theoretical cash bucket owned by LPs (creatorDeposit + fees + LMSR delta)
    function ammAssets() external view returns (uint256);

    /// @notice Pure Floor: ammAssets - max(qYes, qNo)
    function totalNetAssets() external view returns (uint256);

    /// @notice Pure Ceiling: ammAssets - min(qYes, qNo)
    function pureCeilingAssets() external view returns (uint256);

    /// @notice ERC-4626: Floor assets per share
    function convertToAssets(uint256 shares) external view returns (uint256);

    /// @notice ERC-4626: Shares per asset (Floor-based)
    function convertToShares(uint256 assets) external view returns (uint256);

    /// @notice Explicitly convert shares to Floor Value
    function convertSharesToFloor(uint256 shares) external view returns (uint256);

    /// @notice Pure AMM realized P&L from trading (currentCost - initialCost)
    function lpRealizedPnL() external view returns (int256);

    /// @notice Check if the AMM is underwater (Floor Equity == 0)
    function isUnderwater() external view returns (bool);
}


interface ILaunchpadQuoter {
    function calculateAMMTradeQuote(
        address market,
        uint8 outcome,
        uint256 shares,
        bool isBuy
    ) external view returns (
        int256 cost,
        uint256 fee,
        uint256 nextFloor,
        uint256 nextCeiling,
        uint256 priceImpactBps
    );
}
