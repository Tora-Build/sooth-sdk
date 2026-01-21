// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ITickBook} from "@core/interfaces/ITickBook.sol";

/**
 * @title MockTickBook
 * @notice Mock TickBook for V11 testing
 */
contract MockTickBook is ITickBook {
    mapping(address => bytes32) public marketKeys;
    uint256 private keyCounter;

    bool public shouldRevertOnRegister;
    bytes4 public constant DUPLICATE_MARKET_SELECTOR = 0xedd7c146;

    // ============================================
    // Test Setup
    // ============================================

    function setShouldRevertOnRegister(bool shouldRevert) external {
        shouldRevertOnRegister = shouldRevert;
    }

    function setMarketKey(address market, bytes32 key) external {
        marketKeys[market] = key;
    }

    // ============================================
    // ITickBook Implementation
    // ============================================

    function registerMarket(
        address market,
        address, // yesToken
        address, // noToken
        uint256, // initialProbabilityWad
        address  // hook
    ) external override returns (bytes32 marketKey) {
        if (shouldRevertOnRegister) {
            // Simulate duplicate market error
            assembly {
                mstore(0x00, 0xedd7c14600000000000000000000000000000000000000000000000000000000)
                revert(0x00, 0x04)
            }
        }

        if (marketKeys[market] != bytes32(0)) {
            // Already registered
            return marketKeys[market];
        }

        keyCounter++;
        marketKey = keccak256(abi.encodePacked(market, keyCounter));
        marketKeys[market] = marketKey;
    }

    function getMarketKey(address market) external view returns (bytes32) {
        return marketKeys[market];
    }
}
