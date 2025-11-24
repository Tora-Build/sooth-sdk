// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SoothZKVerifierStub {
    event ProofVerified(address indexed market, bytes proofData, bool valid);

    function verifySettlement(address market, bytes calldata proofData) external returns (bool) {
        bool ok = proofData.length > 0;
        emit ProofVerified(market, proofData, ok);
        return ok;
    }
}
