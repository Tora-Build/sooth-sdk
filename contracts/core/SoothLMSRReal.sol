// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./SoothInterfaces.sol";

/// @notice Placeholder for a full LMSR implementation.
/// @dev For now this contract reverts; you can replace it with a production LMSR
///      that implements ISoothAMM using the true logarithmic cost function.
contract SoothLMSRReal is ISoothAMM {
    function costDelta(
        State memory,
        uint8,
        int256,
        uint256
    ) external pure override returns (int256, State memory) {
        revert("SoothLMSRReal: not implemented");
    }

    function price(
        State memory,
        uint8,
        uint256
    ) external pure override returns (uint256) {
        revert("SoothLMSRReal: not implemented");
    }
}
