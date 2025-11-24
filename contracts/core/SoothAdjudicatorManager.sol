// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../stubs/OwnableUpgradeable.sol";

interface ISoothMarket {
    function resolve(uint8 winningOutcome, uint256 eventTimestamp) external;
}

contract SoothAdjudicatorManager is OwnableUpgradeable {
    struct AdjudicatorInfo {
        address adjudicatorContract;
        bool isActive;
    }

    mapping(bytes32 => AdjudicatorInfo) public adjudicators;
    address public guardian;

    event AdjudicatorRegistered(bytes32 indexed id, address contractAddr);
    event MarketResolved(address indexed market, uint8 outcome, uint256 eventTime);
    event GuardianSet(address indexed guardian);

    modifier onlyGuardianOrOwner() {
        require(msg.sender == guardian || msg.sender == owner(), "not auth");
        _;
    }

    function initialize(address _guardian) external initializer {
        __Ownable_init();
        guardian = _guardian;
        emit GuardianSet(_guardian);
    }

    function setGuardian(address _guardian) external onlyOwner {
        guardian = _guardian;
        emit GuardianSet(_guardian);
    }

    function registerAdjudicator(bytes32 id, address contractAddr)
        external
        onlyGuardianOrOwner
    {
        adjudicators[id] = AdjudicatorInfo({adjudicatorContract: contractAddr, isActive: true});
        emit AdjudicatorRegistered(id, contractAddr);
    }

    function finalizeMarket(
        bytes32 adjudicatorId,
        address market,
        uint8 winningOutcome,
        uint256 eventTimestamp
    ) external {
        AdjudicatorInfo memory info = adjudicators[adjudicatorId];
        require(info.isActive, "inactive");
        require(
            msg.sender == info.adjudicatorContract || msg.sender == guardian,
            "unauthorized"
        );
        ISoothMarket(market).resolve(winningOutcome, eventTimestamp);
        emit MarketResolved(market, winningOutcome, eventTimestamp);
    }

    function guardianResolve(
        address market,
        uint8 winningOutcome,
        uint256 eventTimestamp
    ) external onlyGuardianOrOwner {
        ISoothMarket(market).resolve(winningOutcome, eventTimestamp);
        emit MarketResolved(market, winningOutcome, eventTimestamp);
    }
}
