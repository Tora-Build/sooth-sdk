// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SoothZKVerifierStub - placeholder zk proof verifier for Sooth
/// @notice This is a stub for architecture/testing. Integrate a real zk verifier before production.
contract SoothZKVerifierStub {
    event ProofVerified(address indexed market, bytes proofData, bool valid);

    function verifySettlement(address market, bytes calldata proofData) external returns (bool) {
        bool ok = proofData.length > 0;
        emit ProofVerified(market, proofData, ok);
        return ok;
    }
}
