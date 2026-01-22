// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IProtocolConfig
 * @notice Minimal interface for protocol-level roles and pause state
 */
interface IProtocolConfig {
    function isPaused() external view returns (bool);
    function isGuardian(address account) external view returns (bool);
}
