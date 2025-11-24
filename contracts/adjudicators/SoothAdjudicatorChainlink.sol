// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../core/SoothAdjudicatorManager.sol";

interface IAggregatorV3 {
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}

/// @title SoothAdjudicatorChainlink - stub Chainlink + off-chain rule adjudicator
contract SoothAdjudicatorChainlink {
    SoothAdjudicatorManager public manager;
    bytes32 public adjudicatorId;
    IAggregatorV3 public feed;

    constructor(address _manager, bytes32 _adjudicatorId, address _feed) {
        manager = SoothAdjudicatorManager(_manager);
        adjudicatorId = _adjudicatorId;
        feed = IAggregatorV3(_feed);
    }

    /// @notice Example: finalize when price crosses a threshold (off-chain decides outcome).
    function finalizeFromOracle(
        address market,
        uint8 winningOutcome,
        uint256 eventTimestamp
    ) external {
        manager.finalizeMarket(adjudicatorId, market, winningOutcome, eventTimestamp);
    }
}
