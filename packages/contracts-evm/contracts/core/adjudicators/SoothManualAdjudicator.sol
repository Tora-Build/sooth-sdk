// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IAdjudicator} from "../../interfaces/IAdjudicator.sol";
import {ISoothMarketV4} from "../../interfaces/ISoothMarketV4.sol";

/// @notice Minimal adjudicator: owner resolves markets directly.
contract SoothManualAdjudicator is Ownable, IAdjudicator {
    uint8 public immutable override adjudicatorClass;
    mapping(address => bool) public override isResolved;

    event Resolved(address indexed market, uint8 outcome, uint64 tStar);

    constructor(address owner_, uint8 classId) Ownable(owner_) {
        adjudicatorClass = classId;
    }

    function resolve(address market, uint8 outcome, uint64 tStar) external onlyOwner {
        require(!isResolved[market], "ManualAdj: already resolved");
        ISoothMarketV4(market).finalizeResolution(outcome, tStar);
        isResolved[market] = true;
        emit Resolved(market, outcome, tStar);
    }
}

