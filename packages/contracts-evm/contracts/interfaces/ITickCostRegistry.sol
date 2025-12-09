// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ITickCostRegistry
/// @notice Interface for external tick cost registry
interface ITickCostRegistry {
    /// @notice Get the marginal cost for a single tick
    function getCost(uint16 tick) external view returns (uint256);
    
    /// @notice Check if registry is fully initialized
    function initialized() external view returns (bool);
    
    /// @notice Get ln(2) constant in WAD
    function LN2_WAD() external view returns (uint256);
}
