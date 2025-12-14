// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {ISoothGovernorVault} from "../../core/SoothInterfaces.sol";

interface IMarketLPVault is IERC20, ISoothGovernorVault {
    // =========================================================================
    // Events
    // =========================================================================

    /// @notice Emitted when LP tokens are minted to a recipient (accrued from trading fees)
    event LpTokensAccrued(address indexed recipient, uint256 amount);

    /// @notice Emitted when LP tokens are redeemed for USDC assets
    event LpTokensRedeemed(address indexed rescuer, uint256 amount, uint256 assets);

    // =========================================================================
    // Functions
    // =========================================================================

    /// @notice Associated market address
    function market() external view returns (address);

    /// @notice The underlying asset (USDC)
    function asset() external view returns (IERC20);

    /// @notice Total assets held by the vault (available for redemption)
    function totalAssets() external view returns (uint256);

    /// @notice Mint LP tokens. Only callable by the Market contract.
    /// @param to Recipient of the LP tokens
    /// @param amount Amount to mint
    function mint(address to, uint256 amount) external;

    /// @notice Burn LP tokens and claim underlying assets.
    /// @dev Only possible when market is SETTLED or FAILED (refund mode).
    /// @param amount Amount of LP tokens to burn
    function redeem(uint256 amount) external returns (uint256 assets);

    /// @notice Preview the amount of assets redeemable for a given amount of LP tokens
    function previewRedeem(uint256 amount) external view returns (uint256 assets);
}
