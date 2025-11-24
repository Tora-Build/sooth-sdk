// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "../core/SoothVault.sol";
import "./SoothZKVerifierStub.sol";

/// @title SoothSettlementMerkle - Merkle-based settlement for Sooth
contract SoothSettlementMerkle is Initializable {
    SoothVault public vault;
    SoothZKVerifierStub public verifier;

    struct SettlementInfo {
        bytes32 pnlRoot;
        bool proven;
    }

    mapping(address => SettlementInfo) public settlements;
    mapping(address => mapping(address => bool)) public claimed;

    event SettlementProven(address indexed market, bytes32 pnlRoot);
    event Claimed(address indexed market, address indexed user, int256 pnl);

    function initialize(address _vault, address _verifier) external initializer {
        vault = SoothVault(_vault);
        verifier = SoothZKVerifierStub(_verifier);
    }

    function storeSettlement(
        address market,
        bytes32 adjudicatorId,
        bytes32 pnlRoot,
        bytes calldata proofData
    ) external {
        SettlementInfo storage info = settlements[market];
        require(!info.proven, "SoothSettle: already proven");
        bool ok = verifier.verifySettlement(market, proofData);
        require(ok, "SoothSettle: bad proof");
        info.pnlRoot = pnlRoot;
        info.proven = true;
        emit SettlementProven(market, pnlRoot);
    }

    function claim(
        address market,
        bytes32 adjudicatorId,
        int256 pnl,
        bytes32[] calldata merkleProof
    ) external {
        SettlementInfo memory info = settlements[market];
        require(info.proven, "SoothSettle: not settled");
        require(!claimed[market][msg.sender], "SoothSettle: claimed");
        claimed[market][msg.sender] = true;
        bytes32 leaf = keccak256(abi.encode(msg.sender, pnl));
        require(MerkleProof.verify(merkleProof, info.pnlRoot, leaf), "SoothSettle: bad proof");
        if (pnl > 0) {
            vault.lpToUser(msg.sender, adjudicatorId, uint256(pnl));
        } else if (pnl < 0) {
            vault.userToLP(msg.sender, adjudicatorId, uint256(-pnl));
        }
        emit Claimed(market, msg.sender, pnl);
    }
}
