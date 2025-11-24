// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../core/SoothAdjudicatorManager.sol";

/// @title SoothAdjudicatorUMA - stub UMA-style adjudicator adapter
/// @notice In production, wire this to UMA's Optimistic Oracle callbacks.
contract SoothAdjudicatorUMA {
    SoothAdjudicatorManager public manager;
    bytes32 public adjudicatorId;

    constructor(address _manager, bytes32 _adjudicatorId) {
        manager = SoothAdjudicatorManager(_manager);
        adjudicatorId = _adjudicatorId;
    }

    /// @notice Called by off-chain agent once UMA has finalized an answer.
    function finalizeFromUMA(
        address market,
        uint8 winningOutcome,
        uint256 eventTimestamp
    ) external {
        manager.finalizeMarket(adjudicatorId, market, winningOutcome, eventTimestamp);
    }
}
