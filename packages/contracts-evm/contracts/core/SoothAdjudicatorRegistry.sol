// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Adjudicator registry (whitelist + metadata) for Launchpad (V6+).
/// @dev Named with V6 suffix to avoid clashing with legacy `ISoothAdjudicatorRegistry` in `SoothInterfaces.sol`.
interface ISoothAdjudicatorRegistryV6 {
    function isEnabled(address adjudicator) external view returns (bool);
}

/// @notice Registry of adjudicators (optimistic, ZK rule, oracle+ZK, multisig, etc.).
/// @dev This is the single on-chain allowlist used by factories.
contract SoothAdjudicatorRegistry is Ownable, ISoothAdjudicatorRegistryV6 {
    struct AdjudicatorConfig {
        uint8 classId;
        bool enabled;
        bytes32 paramsHash;
    }

    mapping(address => AdjudicatorConfig) public config;

    event AdjudicatorConfigured(address indexed adjudicator, uint8 classId, bool enabled, bytes32 paramsHash);

    constructor(address owner_) Ownable(owner_) {}

    function setAdjudicator(address adjudicator, uint8 classId, bool enabled, bytes32 paramsHash) external onlyOwner {
        require(adjudicator != address(0), "AdjRegistry: zero adjudicator");
        config[adjudicator] = AdjudicatorConfig({classId: classId, enabled: enabled, paramsHash: paramsHash});
        emit AdjudicatorConfigured(adjudicator, classId, enabled, paramsHash);
    }

    function isEnabled(address adjudicator) external view override returns (bool) {
        return config[adjudicator].enabled;
    }
}

