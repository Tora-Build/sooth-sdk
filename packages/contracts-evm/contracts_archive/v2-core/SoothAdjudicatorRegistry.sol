// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./SoothInterfaces.sol";

/// @notice Registry of adjudicators (UMA/Reality, ZK rule, oracle+ZK, attestation).
contract SoothAdjudicatorRegistry is ISoothAdjudicatorRegistry, Ownable {
    struct AdjudicatorConfig {
        uint8 classId;
        address externalContract;
        bytes params;
        bool enabled;
    }

    mapping(bytes32 => AdjudicatorConfig) public adjudicatorById;

    event AdjudicatorRegistered(bytes32 indexed id, uint8 classId, address externalContract, bool enabled);

    function registerAdjudicator(bytes32 id, AdjudicatorConfig calldata cfg) external onlyOwner {
        adjudicatorById[id] = cfg;
        emit AdjudicatorRegistered(id, cfg.classId, cfg.externalContract, cfg.enabled);
    }

    function getAdjudicator(bytes32 id)
        external
        view
        override
        returns (uint8 cls, address externalContract, bytes memory params, bool enabled)
    {
        AdjudicatorConfig storage cfg = adjudicatorById[id];
        return (cfg.classId, cfg.externalContract, cfg.params, cfg.enabled);
    }
}
