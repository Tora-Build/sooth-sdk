// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IAdjudicator} from "../../interfaces/IAdjudicator.sol";
import {ISoothMarketV4} from "../../interfaces/ISoothMarketV4.sol";

/// @notice Optimistic adjudicator: anyone proposes, can be disputed, finalizes after a window.
/// @dev Stage 3: dispute handling is simplified (owner can mark disputed).
contract SoothOptimisticAdjudicator is Ownable, IAdjudicator {
    uint8 public immutable override adjudicatorClass;
    uint64 public immutable disputeWindow;
    uint256 public immutable minBond; // asset-decimals value; used as simple spam filter

    struct Proposal {
        address proposer;
        uint8 outcome;
        uint64 tStar;
        uint64 proposedAt;
        bool disputed;
        bool finalized;
    }

    mapping(address => Proposal) public proposals; // market => proposal
    mapping(address => bool) public override isResolved;

    event Proposed(address indexed market, address indexed proposer, uint8 outcome, uint64 tStar, uint64 proposedAt);
    event Disputed(address indexed market);
    event Finalized(address indexed market, uint8 outcome, uint64 tStar);

    constructor(address owner_, uint8 classId, uint64 disputeWindowSeconds, uint256 minBondAsset) Ownable(owner_) {
        require(disputeWindowSeconds > 0, "OptAdj: zero window");
        adjudicatorClass = classId;
        disputeWindow = disputeWindowSeconds;
        minBond = minBondAsset;
    }

    function propose(address market, uint8 outcome, uint64 tStar) external payable {
        Proposal storage p = proposals[market];
        require(p.proposedAt == 0 || p.finalized || p.disputed, "OptAdj: active proposal");
        require(outcome < 2, "OptAdj: invalid outcome");
        require(tStar > 0, "OptAdj: invalid tStar");
        require(msg.value >= minBond, "OptAdj: bond too low");

        proposals[market] = Proposal({
            proposer: msg.sender,
            outcome: outcome,
            tStar: tStar,
            proposedAt: uint64(block.timestamp),
            disputed: false,
            finalized: false
        });

        emit Proposed(market, msg.sender, outcome, tStar, uint64(block.timestamp));
    }

    /// @notice Simplified dispute: protocol owner flags it disputed.
    function dispute(address market) external onlyOwner {
        Proposal storage p = proposals[market];
        require(p.proposedAt != 0 && !p.finalized, "OptAdj: no active");
        p.disputed = true;
        emit Disputed(market);
    }

    function finalize(address market) external {
        Proposal storage p = proposals[market];
        require(p.proposedAt != 0, "OptAdj: no proposal");
        require(!p.disputed, "OptAdj: disputed");
        require(!p.finalized, "OptAdj: finalized");
        require(uint64(block.timestamp) >= p.proposedAt + disputeWindow, "OptAdj: window");
        require(!isResolved[market], "OptAdj: already resolved");

        ISoothMarketV4(market).finalizeResolution(p.outcome, p.tStar);
        p.finalized = true;
        isResolved[market] = true;

        emit Finalized(market, p.outcome, p.tStar);
    }
}

