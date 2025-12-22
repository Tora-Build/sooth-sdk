// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ISoothMarketV4} from "../interfaces/ISoothMarketV4.sol";

/// @notice Minimal Merkle proof verifier (sorted pairs).
library SoothMerkleProof {
    /// @notice Verifies a Merkle proof for `leaf` against `root` using sorted-pair hashing.
    /// @dev The tree is constructed such that for each step the pair is sorted (`a <= b`) before hashing.
    ///      This removes left/right ambiguity in proofs at the cost of requiring sorted pair construction.
    function verify(bytes32[] memory proof, bytes32 root, bytes32 leaf) internal pure returns (bool) {
        bytes32 computed = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 p = proof[i];
            computed = computed <= p ? keccak256(abi.encodePacked(computed, p)) : keccak256(abi.encodePacked(p, computed));
        }
        return computed == root;
    }
}

/// @notice Settlement-root sink for retroactive-finality settlement (Brevis-style).
/// @dev This contract intentionally does NOT perform transfers in Stage 2.
///      It records roots and verifies claims (emits events) so offchain/indexers can reconcile.
contract SoothSettlementRootSink is Ownable {
    using SoothMerkleProof for bytes32[];

    /// @notice Optional authorized provers (ZK callbacks / operators).
    mapping(address => bool) public isProver;

    /// @notice market => batchId => root
    mapping(address => mapping(bytes32 => bytes32)) public roots;

    /// @notice market => batchId => account => claimed
    mapping(address => mapping(bytes32 => mapping(address => bool))) public claimed;

    event ProverSet(address indexed prover, bool allowed);
    event RootSubmitted(address indexed market, bytes32 indexed batchId, bytes32 root, address indexed submitter);
    event Claimed(address indexed market, bytes32 indexed batchId, address indexed account, int256 pnlWad);

    constructor(address owner_) Ownable(owner_) {}

    /// @notice Allow or disallow an address to submit roots (in addition to the market adjudicator).
    /// @dev Intended for ZK provers / operators that post finalized batches.
    function setProver(address prover, bool allowed) external onlyOwner {
        isProver[prover] = allowed;
        emit ProverSet(prover, allowed);
    }

    /// @notice Submit a settlement Merkle root for a market/batch.
    /// @dev Only the market's adjudicator or an authorized prover may submit.
    /// @dev `batchId` is an opaque identifier (e.g. epoch, block range, or external proof id).
    function submitRoot(address market, bytes32 batchId, bytes32 root) external {
        require(root != bytes32(0), "Sink: zero root");
        require(roots[market][batchId] == bytes32(0), "Sink: root exists");

        address adj = ISoothMarketV4(market).adjudicator();
        require(msg.sender == adj || isProver[msg.sender], "Sink: not authorized");
        require(ISoothMarketV4(market).isSettled(), "Sink: market not settled");

        roots[market][batchId] = root;
        emit RootSubmitted(market, batchId, root, msg.sender);
    }

    /// @notice Claim against a settlement root (verification + event only).
    /// @dev Leaf format must match the producer:
    ///      `leaf = keccak256(abi.encodePacked(market, account, pnlWad, batchId))`.
    /// @param pnlWad Signed delta in WAD (18 decimals) for this account.
    /// @param proof Merkle proof for leaf = keccak256(market, account, pnlWad, batchId).
    function claim(address market, bytes32 batchId, int256 pnlWad, bytes32[] calldata proof) external {
        bytes32 root = roots[market][batchId];
        require(root != bytes32(0), "Sink: no root");
        require(!claimed[market][batchId][msg.sender], "Sink: already claimed");
        claimed[market][batchId][msg.sender] = true;

        bytes32 leaf = keccak256(abi.encodePacked(market, msg.sender, pnlWad, batchId));
        require(proof.verify(root, leaf), "Sink: bad proof");

        emit Claimed(market, batchId, msg.sender, pnlWad);
    }
}

