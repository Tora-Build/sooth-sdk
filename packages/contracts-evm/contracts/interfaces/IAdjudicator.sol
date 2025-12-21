// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Canonical Truth interface for Sooth markets.
/// @dev Markets do NOT call into this interface; the adjudicator calls the market.
///      This interface exists to standardize registry whitelisting + offchain tooling.
interface IAdjudicator {
    /// @notice Adjudicator class identifier (e.g., optimistic, zk-rule, oracle+zk, multisig).
    function adjudicatorClass() external view returns (uint8);

    /// @notice Whether a given market has been resolved by this adjudicator.
    function isResolved(address market) external view returns (bool);
}

