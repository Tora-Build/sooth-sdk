// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../../../contracts/LaunchpadEngine.sol";
import "../../../contracts/AMMEngine.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract LiveLaunchpadTrade is Test {
    LaunchpadEngine launchpad = LaunchpadEngine(0x1d87596C24e413f23f029E1d4Bf1b4191B3a9968);
    IERC20 usdc = IERC20(0x856FbEebD91Db28e3b4550e7602142Cfab683796);
    address alienTruth = 0xa4838e6E410570438d8B074e9459082b228A460C;
    address user = 0xEfdB15EE6e7C7C7906cb230AfF1EDb75CcBaA74F;

    function setUp() public {
        vm.createSelectFork("https://sepolia.base.org");
    }

    function test_live_buy_alien() public {
        vm.startPrank(user);
        
        uint256 buyAmount = 10 * 1e18; // 10 shares
        uint256 maxCost = 10 * 1e18; // $10 max
        
        usdc.approve(address(launchpad), maxCost);
        
        uint256 actualCost = launchpad.tradePositions(
            alienTruth,
            1, // YES
            int256(buyAmount),
            maxCost
        );
        
        console.log("Bought 10 ALIEN shares for:", actualCost);
        assertTrue(actualCost > 0, "Trade failed");
        
        vm.stopPrank();
    }
}
