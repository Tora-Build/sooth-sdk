// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ITickBook
 * @notice Minimal interface for TickBook integration with LaunchpadEngine
 * @dev Full TickBook API is available on the contract itself
 */
interface ITickBook {
    /**
     * @notice Register a new market for orderbook trading
     * @param market Truth market address
     * @param yesToken YES outcome token address
     * @param noToken NO outcome token address
     * @param initialProbabilityWad Initial probability (0-1e18)
     * @return marketKey Unique market identifier
     */
    function registerMarket(
        address market,
        address yesToken,
        address noToken,
        uint256 initialProbabilityWad
    ) external returns (bytes32 marketKey);
}
