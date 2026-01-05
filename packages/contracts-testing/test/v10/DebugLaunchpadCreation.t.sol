// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {LaunchpadEngine} from "@core/LaunchpadEngine.sol";
import {TruthMarket} from "@core/TruthMarket.sol";
import {MockUSDC} from "@core/MockUSDC.sol";

contract DebugLaunchpadCreation is Test {
    LaunchpadEngine launchpad;
    MockUSDC usdc;
    address creator = address(0x123);

    // baseSepolia addresses
    address LAUNCHPAD_ADDR = 0x007253E2501563ac3a8cd35B9311D7Ab6048E436;
    address USDC_ADDR = 0x52556fF7347B63f6881DF1D601aFC521a502779B;

    function setUp() public {
        // Fork Base Sepolia
        vm.createSelectFork("baseSepolia");
        
        launchpad = LaunchpadEngine(LAUNCHPAD_ADDR);
        usdc = MockUSDC(USDC_ADDR);
        
        vm.startPrank(creator);
    }

    function test_ReproduceCreateMarket() public {
        uint256 liquidity = 500 * 1e18;
        string memory name = "Test Market";
        string memory symbol = "TEST";
        uint64 deadline = uint64(block.timestamp + 1 days);

        // 1. Deploy TruthMarket
        TruthMarket tm = new TruthMarket("Question?", deadline, creator, creator);
        tm.activate();
        
        // 2. Mint USDC and Approve
        // Calculate required: ~500 * ln(2) = 346.5 USDC
        // Just mint plenty
        deal(address(usdc), creator, 10000 * 1e18);
        usdc.approve(address(launchpad), type(uint256).max);

        // 3. Call createMarket
        console.log("Calling createMarket...");
        try launchpad.createMarket(address(tm), liquidity, name, symbol) {
            console.log("Success!");
        } catch Error(string memory reason) {
            console.log("Reverted with reason:", reason);
            fail();
        } catch (bytes memory returnData) {
            console.logBytes(returnData);
            fail();
        }
    }
}
