// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ISoothBook {
    error MarketAlreadyExists();

    function owner() external view returns (address);

    function createMarket(
        bytes32 marketKey,
        address collateral,
        string calldata name
    ) external returns (address yesToken, address noToken);
}
