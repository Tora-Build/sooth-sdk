// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Liquidity Vault interface for asset and LP management.
/// @dev Historically named "GovernorVault" but manages liquidity, not governance.
///      In Launchpad markets, the Market implements this interface directly.
interface ISoothLiquidityVault {
    function asset() external view returns (IERC20);
    function totalAssets() external view returns (uint256);
    function decimalsScale() external view returns (uint256);

    // Lock-on-Sell accounting (proceeds remain in vault)
    function lockProceeds(uint256 marketId, address user, uint256 amount) external returns (uint64 unlockTime);
    function claimUnlocked(address user, address recipient) external returns (uint256 claimed);
    function lockedBalance(address user) external view returns (uint256);
    function claimableBalance(address user) external view returns (uint256);
    function getLockEntries(address user) external view returns (uint256[] memory amounts, uint64[] memory unlockTimes);
    function nextUnlock(address user) external view returns (uint256 amount, uint64 unlockTime);

    // LP Actions
    function depositFor(address lp, uint256 assets) external returns (uint256);
    function withdrawFor(address lp, uint256 assets, address receiver) external returns (uint256);

    // Market Actions
    function allocateExposure(uint256 marketId, uint256 amount) external;
    function releaseExposure(uint256 marketId, uint256 amount) external;

    /// @notice Called by Market when it (or TraderVault) sends funds to vault.
    function receiveFunds(uint256 marketId, uint256 amount) external;

    /// @notice Called by Market to request payment from vault to recipient.
    function sendFunds(uint256 marketId, address recipient, uint256 amount) external;

    function getMarketReserve(uint256 marketId) external view returns (int256);

    // Vault Configuration
    function defaultBBase() external view returns (uint256);
    function defaultFeeBps() external view returns (uint256);
    function reserveFactorBps() external view returns (uint256);
}
