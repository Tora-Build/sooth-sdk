// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ITickBookVault
 * @notice Vault-native custody + internal ledger for TickBook (ADR-051)
 * @dev Stores USDC in custody and tracks internal balances in WAD.
 */
interface ITickBookVault {
    // ============================================
    // Events
    // ============================================

    event TickBookSet(address indexed tickBook);
    event UsdcDeposited(address indexed user, uint256 usdcAmountAsset, uint256 usdcAmountWad);
    event UsdcWithdrawn(address indexed user, uint256 usdcAmountWad, uint256 usdcAmountAsset);
    event UsdcReserved(address indexed user, uint256 amountWad);
    event UsdcReleased(address indexed user, uint256 amountWad);
    event OutcomeCredited(address indexed market, address indexed user, uint8 outcome, uint256 sharesWad);
    event RedeemedResolved(address indexed market, address indexed user, uint256 payoutWad, uint256 yesBurned, uint256 noBurned);

    // ============================================
    // User USDC
    // ============================================

    function depositUsdc(uint256 amountAsset) external;
    function withdrawUsdc(uint256 amountWad) external;

    function availableUsdcWad(address user) external view returns (uint256);
    function reservedUsdcWad(address user) external view returns (uint256);

    // ============================================
    // Internal Outcomes (Phase 1: read-only for UI)
    // ============================================

    function getInternalOutcomes(address market, address user) external view returns (uint256 yesSharesWad, uint256 noSharesWad);

    // ============================================
    // Market Collateral (complete-set backing)
    // ============================================

    function marketCollateralWad(address market) external view returns (uint256);

    // ============================================
    // TickBook-only Accounting Hooks
    // ============================================

    function reserveUsdc(address user, uint256 amountWad) external;
    function releaseUsdc(address user, uint256 amountWad) external;
    function spendAvailableToMarket(address user, address market, uint256 amountWad) external;
    function spendReservedToMarket(address user, address market, uint256 amountWad) external;
    function creditOutcome(address market, address user, uint8 outcome, uint256 sharesWad) external;
    function refundMarketToAvailable(address market, address user, uint256 amountWad) external;

    // ============================================
    // Settlement / Redemption
    // ============================================

    function redeemResolved(address market) external returns (uint256 payoutWad);
}


