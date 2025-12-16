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

    /// @notice The associated LP Vault address
    function lpVault() external view returns (address);

    /// @notice Triggers graduation if criteria are met. Permissionless.
    function graduate() external;

    /// @notice Triggers expiry if deadline passed without graduation. Permissionless.
    function expire() external;

    /// @notice Claim refund for creator if market expired.
    function claimCreatorRefund() external;
    
    /// @notice V6: Use locked proceeds for buying
    function useLockedProceeds(address user, uint256 amount) external;
    
    /// @notice V6: Get locked proceeds for a user
    function lockedProceeds(address user) external view returns (uint256);
    
    /// @notice V6: Total locked proceeds
    function totalLockedProceeds() external view returns (uint256);
}
