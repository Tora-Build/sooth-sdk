// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../stubs/Initializable.sol";
import "../stubs/MerkleProof.sol";
import "../core/SoothVault.sol";

/// @title SoothSettlementMerkle
/// @notice Merkle-based PnL settlement with per-market adjudicator routing and basic auth.
///         In production, the adjudicator / market layer should ensure that only valid
///         finalized markets call into this contract and that the posted pnlRoot is
///         derived from a correct PnL computation (e.g. via Brevis/Succinct).
contract SoothSettlementMerkle is Initializable {
    using MerkleProof for bytes32[];

    SoothVault public vault;
    address public verifier; // reserved for future ZK/off-chain proof systems
    address public owner;

    struct SettlementInfo {
        bytes32 pnlRoot;
        bytes32 adjudicatorId;
        bool settled;
    }

    // market -> settlement info
    mapping(address => SettlementInfo) public settlements;

    // market -> user -> claimed
    mapping(address => mapping(address => bool)) public claimed;

    event SettlementStored(address indexed market, bytes32 indexed adjudicatorId, bytes32 pnlRoot);
    event Claimed(address indexed market, address indexed user, int256 pnl);

    modifier onlyInitialized() {
        require(owner != address(0), "SoothSettle: not init");
        _;
    }

    modifier onlyOwnerOrMarket(address market) {
        require(
            msg.sender == owner || msg.sender == market,
            "SoothSettle: not authorized"
        );
        _;
    }

    /// @notice One-time initializer.
    /// @dev Follows the local Initializable pattern used in this repo.
    function initialize(address _vault, address _verifier) external initializer {
        require(_vault != address(0), "SoothSettle: bad vault");
        vault = SoothVault(_vault);
        verifier = _verifier;
        owner = msg.sender;
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
    ) external onlyInitialized onlyOwnerOrMarket(market) {
        require(market != address(0), "SoothSettle: bad market");
        require(pnlRoot != bytes32(0), "SoothSettle: bad root");
        require(proofData.length > 0, "SoothSettle: invalid proof");

        SettlementInfo storage info = settlements[market];
        require(!info.settled, "SoothSettle: already settled");

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
    ) external onlyInitialized {
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

        emit Claimed(market, msg.sender, pnl);
    }
}
