// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/core/SoothMarket.sol";

contract BestOrderTest is Test {
    SoothMarket market;

    function setUp() public {
        market = new SoothMarket();
    }

    function testBestOrder() public {
        uint256 bestYes = market.bestOrder(0);
        assertEq(bestYes, 0);
        console.log("bestOrder(0) returned:", bestYes);

        uint256 bestNo = market.bestOrder(1);
        assertEq(bestNo, 0);
        console.log("bestOrder(1) returned:", bestNo);
    }
}
