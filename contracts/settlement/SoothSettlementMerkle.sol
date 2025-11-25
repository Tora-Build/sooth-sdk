// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../stubs/OwnableUpgradeable.sol";
import "../stubs/MerkleProof.sol";
import "../core/SoothVault.sol";
import "./SoothZKVerifierStub.sol";

/// @title SoothSettlementMerkle
/// @notice Merkle-based PnL settlement with per-market adjudicator routing and restricted provers.
contract SoothSettlementMerkle is OwnableUpgradeable {
    using MerkleProof for bytes32[];

    SoothVault public vault;
    SoothZKVerifierStub public verifier; // reserved for future ZK/off-chain proof systems

    struct SettlementInfo {
        bytes32 pnlRoot;
        bytes32 adjudicatorId;
        bool settled;
    }

    // market -> settlement info
    mapping(address => SettlementInfo) public settlements;

    // market -> user -> claimed
    mapping(address => mapping(address => bool)) public claimed;

    // authorized provers who can post settlement roots
    mapping(address => bool) public isProver;

    event SettlementStored(address indexed market, bytes32 indexed adjudicatorId, bytes32 pnlRoot);
    event Claimed(address indexed market, address indexed user, bytes32 adjudicatorId, int256 pnl);
    event ProverSet(address indexed prover, bool allowed);

    /// @notice One-time initializer.
    function initialize(address _vault, address _verifier) external initializer {
        require(_vault != address(0), "SoothSettle: bad vault");
        __Ownable_init();
        vault = SoothVault(_vault);
        verifier = SoothZKVerifierStub(_verifier);
    }

    function setProver(address prover, bool allowed) external onlyOwner {
        isProver[prover] = allowed;
        emit ProverSet(prover, allowed);
    }

    /// @notice Store the settlement Merkle root for a given market and adjudicator.
    /// @param market The market whose positions are being settled.
    /// @param adjudicatorId The adjudicator / oracle bucket id this market belongs to.
    /// @param pnlRoot The Merkle root of (user, pnl) leaves.
    /// @param proofData Reserved for future off-chain proof systems; currently only checked non-empty.
    function storeSettlement(
        address market,
        bytes32 adjudicatorId,
        bytes32 pnlRoot,
        bytes calldata proofData
    ) external {
        require(isProver[msg.sender], "SoothSettle: not prover");
        require(market != address(0), "SoothSettle: bad market");
        require(adjudicatorId != bytes32(0), "SoothSettle: bad adj");
        require(pnlRoot != bytes32(0), "SoothSettle: bad root");
        require(proofData.length > 0, "SoothSettle: invalid proof");

        SettlementInfo storage info = settlements[market];
        require(!info.settled, "SoothSettle: already settled");

        require(_marketResolved(market), "SoothSettle: not resolved");
        require(_marketAdjudicator(market) == adjudicatorId, "SoothSettle: adj mismatch");

        bool ok = verifier.verifySettlement(market, proofData);
        require(ok, "SoothSettle: bad proof");

        info.pnlRoot = pnlRoot;
        info.adjudicatorId = adjudicatorId;
        info.settled = true;

        emit SettlementStored(market, adjudicatorId, pnlRoot);
    }

    /// @notice Claim PnL for the caller for a given market.
    /// @param market The market address whose settlement root to use.
    /// @param adjudicatorIdHint The adjudicator id the caller expects; must match stored.
    /// @param pnl The signed PnL amount for msg.sender, as encoded in the Merkle leaf.
    /// @param merkleProof Merkle proof from leaf to root.
    function claim(
        address market,
        bytes32 adjudicatorIdHint,
        int256 pnl,
        bytes32[] calldata merkleProof
    ) external {
        SettlementInfo memory info = settlements[market];
        require(info.settled, "SoothSettle: not settled");
        require(info.adjudicatorId == adjudicatorIdHint, "SoothSettle: adj mismatch");
        require(!claimed[market][msg.sender], "SoothSettle: claimed");

        bytes32 leaf = keccak256(abi.encode(msg.sender, pnl));
        require(MerkleProof.verify(merkleProof, info.pnlRoot, leaf), "SoothSettle: bad proof");

        claimed[market][msg.sender] = true;

        if (pnl > 0) {
            vault.lpToUser(msg.sender, info.adjudicatorId, uint256(pnl));
        } else if (pnl < 0) {
            vault.userToLP(msg.sender, info.adjudicatorId, uint256(-pnl));
        }

        emit Claimed(market, msg.sender, info.adjudicatorId, pnl);
    }

    function _marketResolved(address market) internal view returns (bool resolved) {
        (bool ok, bytes memory data) = market.staticcall(abi.encodeWithSignature("isResolved()"));
        if (ok && data.length == 32) {
            resolved = abi.decode(data, (bool));
        }
    }

    function _marketAdjudicator(address market) internal view returns (bytes32 adj) {
        (bool ok, bytes memory data) = market.staticcall(abi.encodeWithSignature("adjudicatorId()"));
        if (ok && data.length == 32) {
            adj = abi.decode(data, (bytes32));
        }
    }
}
