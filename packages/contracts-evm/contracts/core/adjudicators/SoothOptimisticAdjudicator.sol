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
    uint256 public immutable minBond; // wei; simple spam filter

    struct Proposal {
        address proposer;
        uint8 outcome;
        uint64 tStar;
        uint64 proposedAt;
        uint256 bond;
        bool disputed;
        bool finalized;
    }

    mapping(address => Proposal) public proposals; // market => proposal
    mapping(address => bool) public override isResolved;

    /// @notice ETH bonds claimable by successful proposers (pull-based refund).
    mapping(address => uint256) public claimableBonds;
    uint256 public totalClaimableBonds;

    /// @notice ETH bonds accrued to the protocol (slashed on dispute).
    uint256 public ownerAccruedBonds;

    event Proposed(address indexed market, address indexed proposer, uint8 outcome, uint64 tStar, uint64 proposedAt);
    event Disputed(address indexed market);
    event Finalized(address indexed market, uint8 outcome, uint64 tStar);
    event BondCredited(address indexed proposer, uint256 amount);
    event BondSlashed(address indexed market, address indexed proposer, uint256 amount);
    event BondWithdrawn(address indexed proposer, address indexed to, uint256 amount);
    event OwnerWithdrawal(address indexed to, uint256 amount);
    event SurplusWithdrawal(address indexed to, uint256 amount);

    constructor(address owner_, uint8 classId, uint64 disputeWindowSeconds, uint256 minBondAsset) Ownable(owner_) {
        require(disputeWindowSeconds > 0, "OptAdj: zero window");
        adjudicatorClass = classId;
        disputeWindow = disputeWindowSeconds;
        minBond = minBondAsset;
    }

    receive() external payable {
        revert("OptAdj: direct ETH");
    }

    function propose(address market, uint8 outcome, uint64 tStar) external payable {
        Proposal storage p = proposals[market];
        require(p.proposedAt == 0 || p.finalized || p.disputed, "OptAdj: active proposal");
        require(outcome < 2, "OptAdj: invalid outcome");
        require(tStar > 0, "OptAdj: invalid tStar");
        require(msg.value >= minBond, "OptAdj: bond too low");

        // Use a fixed bond equal to minBond and refund any excess immediately.
        // This prevents accidental overpayment while keeping the simple `>=` check.
        uint256 bond = minBond;
        uint256 refund = msg.value - bond;
        if (refund != 0) {
            (bool ok, ) = msg.sender.call{value: refund}("");
            require(ok, "OptAdj: refund failed");
        }

        proposals[market] = Proposal({
            proposer: msg.sender,
            outcome: outcome,
            tStar: tStar,
            proposedAt: uint64(block.timestamp),
            bond: bond,
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
        if (p.bond != 0) {
            ownerAccruedBonds += p.bond;
            emit BondSlashed(market, p.proposer, p.bond);
            p.bond = 0;
        }
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

        // Credit bond refund to proposer (pull-based) so the proposal slot can be reused safely.
        if (p.bond != 0) {
            claimableBonds[p.proposer] += p.bond;
            totalClaimableBonds += p.bond;
            emit BondCredited(p.proposer, p.bond);
            p.bond = 0;
        }

        emit Finalized(market, p.outcome, p.tStar);
    }

    /// @notice Withdraw refundable proposal bonds after a successful finalize().
    function withdrawBond(address payable to, uint256 amount) external {
        require(amount != 0, "OptAdj: zero amount");
        uint256 bal = claimableBonds[msg.sender];
        require(bal >= amount, "OptAdj: insufficient claimable");
        claimableBonds[msg.sender] = bal - amount;
        totalClaimableBonds -= amount;
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "OptAdj: withdraw failed");
        emit BondWithdrawn(msg.sender, to, amount);
    }

    /// @notice Withdraw bonds slashed via dispute().
    function withdrawOwnerAccrued(address payable to, uint256 amount) external onlyOwner {
        require(amount != 0, "OptAdj: zero amount");
        require(ownerAccruedBonds >= amount, "OptAdj: insufficient accrued");
        ownerAccruedBonds -= amount;
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "OptAdj: owner withdraw failed");
        emit OwnerWithdrawal(to, amount);
    }

    /// @notice Withdraw ETH that is not owed to proposers or the owner (e.g., forced ETH via selfdestruct).
    function withdrawSurplus(address payable to, uint256 amount) external onlyOwner {
        require(amount != 0, "OptAdj: zero amount");
        uint256 liabilities = totalClaimableBonds + ownerAccruedBonds;
        uint256 bal = address(this).balance;
        require(bal >= liabilities, "OptAdj: undercollateralized");
        uint256 surplus = bal - liabilities;
        require(surplus >= amount, "OptAdj: insufficient surplus");
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "OptAdj: surplus withdraw failed");
        emit SurplusWithdrawal(to, amount);
    }
}

