// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Key-value pair for Lens V3 Post Action parameters
struct KeyValue {
    bytes32 key;
    bytes value;
}

/// @title IPostAction
/// @notice Lens V3 Post Action interface
/// @dev Actions are called via the ActionHub, never directly
interface IPostAction {
    function configure(
        address originalMsgSender,
        address feed,
        uint256 postId,
        KeyValue[] calldata params
    ) external payable returns (bytes memory);

    function execute(
        address originalMsgSender,
        address feed,
        uint256 postId,
        KeyValue[] calldata params
    ) external payable returns (bytes memory);

    function setDisabled(
        address originalMsgSender,
        address feed,
        uint256 postId,
        bool isDisabled,
        KeyValue[] calldata params
    ) external payable returns (bytes memory);
}
