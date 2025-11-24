// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "../core/SoothMarket.sol";
import "../core/SoothVault.sol";

/// @title SoothMarketFactory - deploys SoothMarket instances
contract SoothMarketFactory is OwnableUpgradeable {
    SoothVault public vault;
    address public adjudicatorManager;

    event MarketCreated(address indexed market, bytes32 indexed adjudicatorId, bytes32 indexed eventId, uint256 b);

    function initialize(address _vault, address _adjMgr) external initializer {
        __Ownable_init();
        vault = SoothVault(_vault);
        adjudicatorManager = _adjMgr;
    }

    function createMarket(
        bytes32 adjudicatorId,
        bytes32 eventId,
        uint256 b
    ) external onlyOwner returns (address) {
        SoothMarket m = new SoothMarket();
        m.initialize(address(vault), adjudicatorManager, adjudicatorId, eventId, b);
        vault.setAuthorized(address(m), true);
        emit MarketCreated(address(m), adjudicatorId, eventId, b);
        return address(m);
    }
}
