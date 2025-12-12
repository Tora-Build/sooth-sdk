// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../core/SoothInterfaces.sol";
import "../core/SoothAdjudicatorRegistry.sol";

library MerkleProof {
    function verify(
        bytes32[] memory proof,
        bytes32 root,
        bytes32 leaf
    ) internal pure returns (bool) {
        bytes32 computed = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 p = proof[i];
            if (computed <= p) {
                computed = keccak256(abi.encodePacked(computed, p));
            } else {
                computed = keccak256(abi.encodePacked(p, computed));
            }
        }
        return computed == root;
    }
}

/// @notice Settlement contract: records adjudicator results and applies PnL via the vault.
/// @dev This is a simplified version focusing on the core flows needed for testing.
contract SoothSettlement is Ownable {
    using MerkleProof for bytes32[];

    ISoothGovernorVault public governorVault;
    ISoothTraderVault public traderVault;
    SoothAdjudicatorRegistry public adjudicatorRegistry;

    struct MarketResult {
        bool exists;
        bool settled;
        bytes32 adjudicatorId;
        uint64 truthTime;     // T*
        uint8 winningOutcome; // 0 = NO, 1 = YES
    }

    /// @notice Market results keyed by marketId.
    mapping(uint256 => MarketResult) public results;

    /// @notice Merkle roots keyed by batchId (could be market-specific or grouped).
    mapping(bytes32 => bytes32) public settlementRoots;

    /// @notice Track which accounts have claimed against a given batch.
    mapping(bytes32 => mapping(address => bool)) public claimed;

    /// @notice Simple access control for settlement root proposers / ZK callbacks.
    mapping(address => bool) public provers;

    event ResultStored(uint256 indexed marketId, bytes32 adjudicatorId, uint8 winningOutcome, uint64 truthTime);
    event SettlementRootStored(uint256 indexed marketId, bytes32 batchId, bytes32 root);
    event Claimed(uint256 indexed marketId, bytes32 batchId, address indexed account, int256 pnlDelta);
    event ProverSet(address indexed prover, bool allowed);

    constructor(ISoothGovernorVault _governorVault, ISoothTraderVault _traderVault, SoothAdjudicatorRegistry _adjRegistry) {
        governorVault = _governorVault;
        traderVault = _traderVault;
        adjudicatorRegistry = _adjRegistry;
    }

    function setProver(address who, bool allowed) external onlyOwner {
        provers[who] = allowed;
        emit ProverSet(who, allowed);
    }

    /// @notice Store the adjudicated result for a market (outcome + truth time).
    /// @dev In a full implementation this would verify with external contracts via the registry.
    function storeResult(
        uint256 marketId,
        bytes32 adjudicatorId,
        uint8 winningOutcome,
        uint64 truthTime
    ) external onlyOwner {
        (, , , bool enabled) = adjudicatorRegistry.getAdjudicator(adjudicatorId);
        require(enabled, "Settlement: adjudicator disabled");

        MarketResult storage r = results[marketId];
        require(!r.settled, "Settlement: already settled");
        r.exists = true;
        r.settled = true;
        r.adjudicatorId = adjudicatorId;
        r.winningOutcome = winningOutcome;
        r.truthTime = truthTime;

        emit ResultStored(marketId, adjudicatorId, winningOutcome, truthTime);
    }

    /// @notice Store a Merkle root for PnL deltas for a given market/batch.
    function storeSettlementRoot(
        uint256 marketId,
        bytes32 batchId,
        bytes32 root,
        bytes calldata /*proofMeta*/
    ) external {
        require(provers[msg.sender], "Settlement: not prover");
        MarketResult storage r = results[marketId];
        require(r.settled, "Settlement: market not settled");

        settlementRoots[batchId] = root;
        emit SettlementRootStored(marketId, batchId, root);
    }

    /// @notice Claim PnL for a given market/batch by providing a Merkle proof.
    /// @param marketId Market identifier.
    /// @param batchId Settlement batch id.
    /// @param pnlDelta Signed PnL delta for this account.
    /// @param merkleProof Merkle proof proving inclusion of (marketId, account, pnlDelta).
    function claimSettlement(
        uint256 marketId,
        bytes32 batchId,
        int256 pnlDelta,
        bytes32[] calldata merkleProof
    ) external {
        bytes32 root = settlementRoots[batchId];
        require(root != bytes32(0), "Settlement: no root");

        require(!claimed[batchId][msg.sender], "Settlement: already claimed");
        claimed[batchId][msg.sender] = true;

        bytes32 leaf = keccak256(abi.encodePacked(marketId, msg.sender, pnlDelta));
        require(merkleProof.verify(root, leaf), "Settlement: bad proof");

        if (pnlDelta > 0) {
            uint256 amount = uint256(pnlDelta);
            governorVault.sendFunds(marketId, address(traderVault), amount);
            traderVault.receiveFromGovernor(msg.sender, amount);
        } else if (pnlDelta < 0) {
            uint256 amount = uint256(-pnlDelta);
            traderVault.payToGovernor(msg.sender, amount);
            governorVault.receiveFunds(marketId, amount);
        }
        
        emit Claimed(marketId, batchId, msg.sender, pnlDelta);
    }
}
