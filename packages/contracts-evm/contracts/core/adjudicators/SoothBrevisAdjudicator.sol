// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IAdjudicator} from "../../interfaces/IAdjudicator.sol";
import {ISoothMarketV4} from "../../interfaces/ISoothMarketV4.sol";
import {SoothSettlementRootSink} from "../SoothSettlementRootSink.sol";

/// @notice Minimal Brevis-style adjudicator stub.
/// @dev Stage 4: callback authentication is implemented; proof verification is intentionally out of scope.
contract SoothBrevisAdjudicator is Ownable, IAdjudicator {
    uint8 public immutable override adjudicatorClass;

    /// @notice Brevis Gateway (callback caller)
    address public immutable brevisGateway;

    /// @notice Settlement sink for posting roots (optional but recommended)
    SoothSettlementRootSink public immutable sink;

    mapping(address => bool) public override isResolved;

    event BrevisResolved(address indexed market, uint8 outcome, uint64 tStar);
    event BrevisRootSubmitted(address indexed market, bytes32 indexed batchId, bytes32 root);

    constructor(address owner_, uint8 classId, address gateway, SoothSettlementRootSink sink_) Ownable(owner_) {
        require(gateway != address(0), "BrevisAdj: zero gateway");
        adjudicatorClass = classId;
        brevisGateway = gateway;
        sink = sink_;
    }

    modifier onlyBrevisGateway() {
        require(msg.sender == brevisGateway, "BrevisAdj: not gateway");
        _;
    }

    /// @notice Brevis callback to resolve a market.
    function brevisResolveMarket(address market, uint8 outcome, uint64 tStar) external onlyBrevisGateway {
        require(!isResolved[market], "BrevisAdj: already resolved");
        ISoothMarketV4(market).finalizeResolution(outcome, tStar);
        isResolved[market] = true;
        emit BrevisResolved(market, outcome, tStar);
    }

    /// @notice Brevis callback to submit a settlement root to the sink.
    function brevisSubmitSettlementRoot(address market, bytes32 batchId, bytes32 root) external onlyBrevisGateway {
        require(address(sink) != address(0), "BrevisAdj: no sink");
        sink.submitRoot(market, batchId, root);
        emit BrevisRootSubmitted(market, batchId, root);
    }
}

