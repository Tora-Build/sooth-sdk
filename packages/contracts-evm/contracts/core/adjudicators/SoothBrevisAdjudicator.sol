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

    /// @param owner_ Contract owner (can be a multisig).
    /// @param classId Adjudicator class identifier surfaced via `IAdjudicator.adjudicatorClass()`.
    /// @param gateway Authorized Brevis gateway address that is allowed to call the callbacks.
    /// @param sink_ Settlement-root sink to post roots into (may be zero to disable root posting).
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
    /// @dev The gateway is expected to call this only after validating an external proof.
    /// @param market Target market to resolve.
    /// @param outcome Winning outcome (0 = YES, 1 = NO).
    /// @param tStar Truth timestamp (T*) used for Open-End / retroactive-finality semantics.
    function brevisResolveMarket(address market, uint8 outcome, uint64 tStar) external onlyBrevisGateway {
        require(!isResolved[market], "BrevisAdj: already resolved");
        ISoothMarketV4(market).finalizeResolution(outcome, tStar);
        isResolved[market] = true;
        emit BrevisResolved(market, outcome, tStar);
    }

    /// @notice Brevis callback to submit a settlement root to the sink.
    /// @dev This is a convenience wrapper around `sink.submitRoot(...)` with gateway auth.
    function brevisSubmitSettlementRoot(address market, bytes32 batchId, bytes32 root) external onlyBrevisGateway {
        require(address(sink) != address(0), "BrevisAdj: no sink");
        sink.submitRoot(market, batchId, root);
        emit BrevisRootSubmitted(market, batchId, root);
    }
}

