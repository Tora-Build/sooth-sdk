// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../core/SoothAdjudicatorManager.sol";

/// @title SoothAdjudicatorRealityETH - stub Reality.eth adjudicator adapter
/// @notice In production, wire this to Reality.eth question/answer flows.
contract SoothAdjudicatorRealityETH {
    SoothAdjudicatorManager public manager;
    bytes32 public adjudicatorId;

    constructor(address _manager, bytes32 _adjudicatorId) {
        manager = SoothAdjudicatorManager(_manager);
        adjudicatorId = _adjudicatorId;
    }

    function finalizeFromReality(
        address market,
        uint8 winningOutcome,
        uint256 eventTimestamp
    ) external {
        manager.finalizeMarket(adjudicatorId, market, winningOutcome, eventTimestamp);
    }
}
