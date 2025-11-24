// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../core/SoothAdjudicatorManager.sol";

contract SoothAdjudicatorAttestation {
    SoothAdjudicatorManager public manager;
    bytes32 public adjudicatorId;
    address public attestor;

    event AttestorSet(address indexed attestor);

    constructor(address _manager, bytes32 _adjudicatorId, address _attestor) {
        manager = SoothAdjudicatorManager(_manager);
        adjudicatorId = _adjudicatorId;
        attestor = _attestor;
    }

    modifier onlyAttestor() {
        require(msg.sender == attestor, "not attestor");
        _;
    }

    function setAttestor(address _attestor) external onlyAttestor {
        attestor = _attestor;
        emit AttestorSet(_attestor);
    }

    function finalizeByAttestation(
        address market,
        uint8 winningOutcome,
        uint256 eventTimestamp
    ) external onlyAttestor {
        manager.finalizeMarket(adjudicatorId, market, winningOutcome, eventTimestamp);
    }
}
