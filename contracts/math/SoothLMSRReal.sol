// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library SoothLMSRReal {
    struct State {
        uint256 q0;
        uint256 q1;
        uint256 b;
    }

    function cost(
        State memory s,
        uint8 outcomeIndex,
        int256 deltaShares
    ) internal pure returns (int256) {
        s; outcomeIndex; deltaShares;
        revert("SoothLMSRReal: not implemented");
    }

    function price(State memory s, uint8 outcomeIndex) internal pure returns (uint256) {
        s; outcomeIndex;
        revert("SoothLMSRReal: not implemented");
    }
}
