// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../stubs/Initializable.sol";
import "./SoothVault.sol";
import "./SoothLMSR.sol";

contract SoothMarket is Initializable {
    using SoothLinearAMM for SoothLinearAMM.State;

    SoothVault public vault;
    address public adjudicatorManager;
    bytes32 public adjudicatorId;
    bytes32 public eventId;

    SoothLinearAMM.State public ammState;

    bool public isResolved;
    uint8 public winningOutcome;
    uint256 public resolutionTime;

    mapping(address => int256) public userOutcome0;
    mapping(address => int256) public userOutcome1;

    event Trade(address indexed user, uint8 outcomeIndex, uint256 shares, uint256 costOrPayout, bool isBuy);
    event Resolved(uint8 outcomeIndex, uint256 eventTimestamp);

    modifier onlyActive() {
        require(!isResolved, "SoothMarket: resolved");
        _;
    }

    modifier onlyAdjManager() {
        require(msg.sender == adjudicatorManager, "SoothMarket: not adj mgr");
        _;
    }

    function initialize(
        address _vault,
        address _adjudicatorManager,
        bytes32 _adjudicatorId,
        bytes32 _eventId,
        uint256 _b
    ) external initializer {
        require(_vault != address(0), "SoothMarket: zero vault");
        require(_adjudicatorManager != address(0), "SoothMarket: zero adj mgr");
        vault = SoothVault(_vault);
        adjudicatorManager = _adjudicatorManager;
        adjudicatorId = _adjudicatorId;
        eventId = _eventId;
        ammState.b = _b;
    }

    function buy(uint8 outcomeIndex, uint256 shares)
        external
        onlyActive
        returns (uint256 cost)
    {
        require(shares > 0, "SoothMarket: zero shares");
        require(outcomeIndex < 2, "SoothMarket: bad outcome");

        int256 delta = int256(shares);
        int256 rawCost = ammState.calcCost(delta, outcomeIndex);
        require(rawCost >= 0, "SoothMarket: cost<0");
        cost = uint256(rawCost);

        vault.userToLP(msg.sender, adjudicatorId, cost);

        if (outcomeIndex == 0) {
            ammState.q0 += delta;
            userOutcome0[msg.sender] += delta;
        } else {
            ammState.q1 += delta;
            userOutcome1[msg.sender] += delta;
        }

        vault.increaseExposure(adjudicatorId, shares);

        emit Trade(msg.sender, outcomeIndex, shares, cost, true);
    }

    function sell(uint8 outcomeIndex, uint256 shares)
        external
        onlyActive
        returns (uint256 payout)
    {
        require(shares > 0, "SoothMarket: zero shares");
        require(outcomeIndex < 2, "SoothMarket: bad outcome");

        if (outcomeIndex == 0) {
            require(userOutcome0[msg.sender] >= int256(shares), "SoothMarket: pos<sell");
        } else {
            require(userOutcome1[msg.sender] >= int256(shares), "SoothMarket: pos<sell");
        }

        int256 delta = -int256(shares);
        int256 rawCost = ammState.calcCost(delta, outcomeIndex);
        require(rawCost <= 0, "SoothMarket: payout<0");
        payout = uint256(-rawCost);

        vault.lpToUser(msg.sender, adjudicatorId, payout);

        if (outcomeIndex == 0) {
            ammState.q0 += delta;
            userOutcome0[msg.sender] += delta;
        } else {
            ammState.q1 += delta;
            userOutcome1[msg.sender] += delta;
        }

        vault.decreaseExposure(adjudicatorId, shares);

        emit Trade(msg.sender, outcomeIndex, shares, payout, false);
    }

    function resolve(uint8 _winningOutcome, uint256 _eventTimestamp) external onlyAdjManager {
        require(!isResolved, "SoothMarket: already resolved");
        require(_winningOutcome < 2, "SoothMarket: bad outcome");
        isResolved = true;
        winningOutcome = _winningOutcome;
        resolutionTime = _eventTimestamp;
        emit Resolved(_winningOutcome, _eventTimestamp);
    }

    function price(uint8 outcomeIndex) external view returns (uint256) {
        require(outcomeIndex < 2, "SoothMarket: bad outcome");
        (uint256 p0, uint256 p1) = ammState.prices();
        return outcomeIndex == 0 ? p0 : p1;
    }
}
