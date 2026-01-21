// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ICollateralizer} from "@core/interfaces/ICollateralizer.sol";
import {OutcomeToken} from "@core/OutcomeToken.sol";

/**
 * @title MockCollateralizer
 * @notice Mock Collateralizer for V11 testing
 */
contract MockCollateralizer is ICollateralizer {
    struct MarketTokens {
        bool registered;
        address yesToken;
        address noToken;
    }

    mapping(address => MarketTokens) public marketTokens;
    address public deployer;

    constructor() {
        deployer = msg.sender;
    }

    // ============================================
    // Test Setup
    // ============================================

    function setMarketTokens(address market, address yesToken, address noToken) external {
        marketTokens[market] = MarketTokens({
            registered: true,
            yesToken: yesToken,
            noToken: noToken
        });
    }

    // ============================================
    // ICollateralizer Implementation
    // ============================================

    function registerMarket(address market)
        external
        override
        returns (address yesToken, address noToken)
    {
        if (marketTokens[market].registered) {
            return (marketTokens[market].yesToken, marketTokens[market].noToken);
        }

        // Deploy new outcome tokens
        yesToken = address(new OutcomeToken("YES", "YES", deployer, market, 1));
        noToken = address(new OutcomeToken("NO", "NO", deployer, market, 0));

        marketTokens[market] = MarketTokens({
            registered: true,
            yesToken: yesToken,
            noToken: noToken
        });
    }

    function split(address, uint256) external pure override {
        // Mock: no-op
    }

    function merge(address, uint256) external pure override {
        // Mock: no-op
    }

    function redeem(address, uint256)
        external
        pure
        override
        returns (uint256)
    {
        return 0;
    }

    function redeemOutcome(address, uint8, uint256)
        external
        pure
        override
        returns (uint256)
    {
        return 0;
    }

    function getOutcomeTokens(address market)
        external
        view
        override
        returns (address yesToken, address noToken)
    {
        MarketTokens memory tokens = marketTokens[market];
        return (tokens.yesToken, tokens.noToken);
    }

    function getBalances(address, address)
        external
        pure
        override
        returns (uint256 yesBalance, uint256 noBalance)
    {
        return (0, 0);
    }

    function getTotalCollateral(address)
        external
        pure
        override
        returns (uint256)
    {
        return 0;
    }

    function isMarketSettled(address) external pure override returns (bool) {
        return false;
    }

    function getRedemptionValue(address, uint8)
        external
        pure
        override
        returns (uint256)
    {
        return 0;
    }

    function isMarketRegistered(address market)
        external
        view
        override
        returns (bool)
    {
        return marketTokens[market].registered;
    }
}
