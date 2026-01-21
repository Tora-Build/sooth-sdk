// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "@core/LaunchpadEngine.sol";
import "@core/AMMEngine.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title Live Launchpad Trade Tests
 * @notice Fork tests against Base Sepolia deployment
 * @dev Updated Dec 29, 2025 to include sell-side fee tests
 */
contract LiveLaunchpadTrade is Test {
    // V9.1.0 Deployed Addresses (Base Sepolia) — Dec 29, 2025 Sell Fee Fix
    LaunchpadEngine launchpad = LaunchpadEngine(0xEff2d8dF8Fa9dFf67953273Ec6151e250693DEa1);
    AMMEngine amm = AMMEngine(0xc30b15912BD5EBC275CBc8CdA88FA881509F3029);
    IERC20 usdc = IERC20(0x856FbEebD91Db28e3b4550e7602142Cfab683796);
    
    // Test Markets
    address alienTruth = 0xa4838e6E410570438d8B074e9459082b228A460C;
    
    // Test User (must have USDC on Base Sepolia)
    address user = 0xEfdB15EE6e7C7C7906cb230AfF1EDb75CcBaA74F;

    uint8 constant YES = 1;
    uint8 constant NO = 0;

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
            YES,
            int256(buyAmount),
            maxCost
        );
        
        console.log("Bought 10 ALIEN YES shares for:", actualCost);
        assertTrue(actualCost > 0, "Trade failed");
        
        vm.stopPrank();
    }

    function test_live_sell_alien_yes() public {
        // First, ensure user has a position to sell
        vm.startPrank(user);
        
        // Check existing position
        (uint256 yesBefore, uint256 noBefore) = amm.getPosition(alienTruth, user);
        console.log("Position before - YES:", yesBefore, "NO:", noBefore);
        
        // If no YES position, buy some first
        if (yesBefore < 10 * 1e18) {
            usdc.approve(address(launchpad), 20 * 1e18);
            launchpad.tradePositions(alienTruth, YES, int256(20 * 1e18), 20 * 1e18);
            (yesBefore,) = amm.getPosition(alienTruth, user);
            console.log("Bought 20 YES, new position:", yesBefore);
        }
        
        // Get quote for sell
        uint256 sellAmount = 5 * 1e18;
        (uint256 baseCost,) = amm.getPositionQuote(alienTruth, YES, -int256(sellAmount));
        console.log("Base sell proceeds (before fee):", baseCost);
        
        // Get fee rate
        (,,,,,,,, bool isGraduated,,) = launchpad.markets(alienTruth);
        uint16 feeBps = isGraduated ? launchpad.postGradFeeBps() : launchpad.preGradFeeBps();
        uint256 expectedFee = (baseCost * feeBps) / 10000;
        uint256 expectedNet = baseCost - expectedFee;
        console.log("Expected fee:", expectedFee, "Expected net:", expectedNet);
        
        // Execute sell
        uint256 actualProceeds = launchpad.tradePositions(
            alienTruth,
            YES,
            -int256(sellAmount),
            0 // no slippage protection for test
        );
        
        console.log("Actual net proceeds:", actualProceeds);
        
        // Verify fee was deducted
        assertEq(actualProceeds, expectedNet, "Proceeds should be net of fee");
        assertLt(actualProceeds, baseCost, "Net proceeds must be less than base cost");
        
        // Verify position decreased
        (uint256 yesAfter,) = amm.getPosition(alienTruth, user);
        assertEq(yesAfter, yesBefore - sellAmount, "Position should decrease by sell amount");
        
        // Verify proceeds are locked
        (uint256 available, uint256 locked) = amm.getBalances(user);
        console.log("Balances - Available:", available, "Locked:", locked);
        assertGe(available, actualProceeds, "Available balance should include sell proceeds");
        
        vm.stopPrank();
    }

    function test_live_buy_sell_roundtrip() public {
        vm.startPrank(user);
        
        // Get initial state
        uint256 usdcBefore = usdc.balanceOf(user);
        (uint256 availBefore, uint256 lockedBefore) = amm.getBalances(user);
        
        console.log("=== Initial State ===");
        console.log("USDC balance:", usdcBefore);
        console.log("Available balance:", availBefore);
        console.log("Locked balance:", lockedBefore);
        
        // Buy YES
        uint256 buyAmount = 10 * 1e18;
        usdc.approve(address(launchpad), 20 * 1e18);
        uint256 buyCost = launchpad.tradePositions(alienTruth, YES, int256(buyAmount), 20 * 1e18);
        console.log("\n=== After Buy ===");
        console.log("Buy cost:", buyCost);
        
        // Immediately sell
        uint256 sellProceeds = launchpad.tradePositions(alienTruth, YES, -int256(buyAmount), 0);
        console.log("\n=== After Sell ===");
        console.log("Sell proceeds:", sellProceeds);
        
        // Calculate roundtrip loss (fees)
        uint256 roundtripLoss = buyCost - sellProceeds;
        console.log("Roundtrip loss (fees):", roundtripLoss);
        
        // Loss should be approximately 10% (5% buy + 5% sell at pre-grad rate)
        // But since price moved, it won't be exact
        assertTrue(roundtripLoss > 0, "Should have lost fees");
        
        // Check final balances
        (uint256 availAfter, uint256 lockedAfter) = amm.getBalances(user);
        console.log("\n=== Final State ===");
        console.log("Available balance:", availAfter);
        console.log("Locked balance:", lockedAfter);
        
        // Sell proceeds should be locked (direct check, no underflow risk)
        assertEq(availAfter, sellProceeds, "Available should equal sell proceeds");
        assertEq(lockedAfter, sellProceeds, "Locked should equal sell proceeds");
        
        vm.stopPrank();
    }
}
