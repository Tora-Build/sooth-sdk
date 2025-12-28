// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {AMMEngine} from "../../contracts/AMMEngine.sol";
import {TruthMarket} from "../../contracts/TruthMarket.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";

/**
 * @title AMMSettlementTest
 * @notice Test suite for AMMEngine position settlement after market resolution
 * @dev Critical: These tests ensure users receive correct payouts after settlement
 */
contract AMMSettlementTest is Test {
    AMMEngine public amm;
    TruthMarket public market;
    ERC20Mock public usdc;

    address public owner = address(0x1);
    address public trader1 = address(0x2);
    address public trader2 = address(0x3);
    address public adjudicator = address(0x4);
    address public guardian = address(0x5);

    uint256 constant WAD = 1e18;
    uint256 constant INITIAL_LIQUIDITY = 1000 * WAD;

    // V8.2 outcome constants (aligned with TruthMarket: 0=NO, 1=YES, 2=INVALID)
    uint8 constant YES = 1;
    uint8 constant NO = 0;

    function setUp() public {
        // Deploy mock USDC (18 decimals for test simplicity)
        usdc = new ERC20Mock();

        // Deploy AMM
        amm = new AMMEngine(address(usdc), owner);

        // Deploy market
        market = new TruthMarket(
            "Will ETH reach $5000?",
            uint64(block.timestamp + 30 days),
            adjudicator,
            guardian
        );

        // Initialize market in AMM
        amm.initializeMarket(address(market), INITIAL_LIQUIDITY);

        // Activate market
        market.activate();

        // Fund users
        usdc.mint(trader1, 10000 * WAD);
        usdc.mint(trader2, 10000 * WAD);
        
        // Fund AMM for payouts
        usdc.mint(address(amm), 100000 * WAD);

        // Approve AMM
        vm.prank(trader1);
        usdc.approve(address(amm), type(uint256).max);
        vm.prank(trader2);
        usdc.approve(address(amm), type(uint256).max);
    }

    // ============================================
    // Settlement Tests - YES Wins
    // ============================================

    function test_SettlePosition_YESWins() public {
        // Trader buys YES
        vm.prank(trader1);
        amm.tradePositions(address(market), YES, 100 * int256(WAD), 500 * WAD);

        // Verify position exists
        (uint256 yesShares, uint256 noShares) = amm.getPosition(address(market), trader1);
        assertEq(yesShares, 100 * WAD, "Should have 100 YES shares");
        assertEq(noShares, 0, "Should have 0 NO shares");

        // Settle market as YES
        vm.prank(adjudicator);
        market.settle(1, 0); // YES wins

        // Record balance before settlement
        uint256 usdcBefore = usdc.balanceOf(trader1);

        // Settle position
        vm.prank(trader1);
        uint256 payout = amm.settlePosition(address(market));

        // Verify payout
        assertEq(payout, 100 * WAD, "Payout should equal YES shares");
        assertEq(usdc.balanceOf(trader1), usdcBefore + 100 * WAD, "USDC should increase");

        // Verify position is cleared
        (yesShares, noShares) = amm.getPosition(address(market), trader1);
        assertEq(yesShares, 0, "YES shares should be cleared");
        assertEq(noShares, 0, "NO shares should be cleared");
    }

    function test_SettlePosition_NOWins() public {
        // Trader buys NO
        vm.prank(trader1);
        amm.tradePositions(address(market), NO, 100 * int256(WAD), 500 * WAD);

        // Verify position exists
        (uint256 yesShares, uint256 noShares) = amm.getPosition(address(market), trader1);
        assertEq(yesShares, 0, "Should have 0 YES shares");
        assertEq(noShares, 100 * WAD, "Should have 100 NO shares");

        // Settle market as NO
        vm.prank(adjudicator);
        market.settle(0, 0); // NO wins

        // Record balance before settlement
        uint256 usdcBefore = usdc.balanceOf(trader1);

        // Settle position
        vm.prank(trader1);
        uint256 payout = amm.settlePosition(address(market));

        // Verify payout
        assertEq(payout, 100 * WAD, "Payout should equal NO shares");
        assertEq(usdc.balanceOf(trader1), usdcBefore + 100 * WAD, "USDC should increase");

        // Verify position is cleared
        (yesShares, noShares) = amm.getPosition(address(market), trader1);
        assertEq(yesShares, 0, "YES shares should be cleared");
        assertEq(noShares, 0, "NO shares should be cleared");
    }

    function test_SettlePosition_HoldsBothButYESWins() public {
        // Trader buys both YES and NO
        vm.prank(trader1);
        amm.tradePositions(address(market), YES, 100 * int256(WAD), 500 * WAD);
        vm.prank(trader1);
        amm.tradePositions(address(market), NO, 50 * int256(WAD), 300 * WAD);

        // Verify both positions
        (uint256 yesShares, uint256 noShares) = amm.getPosition(address(market), trader1);
        assertEq(yesShares, 100 * WAD, "Should have 100 YES");
        assertEq(noShares, 50 * WAD, "Should have 50 NO");

        // Settle as YES
        vm.prank(adjudicator);
        market.settle(1, 0);

        // Settle position - should only pay out YES shares
        vm.prank(trader1);
        uint256 payout = amm.settlePosition(address(market));

        // Only YES shares pay out
        assertEq(payout, 100 * WAD, "Only YES shares should pay out");
    }

    function test_SettlePosition_HoldsBothButNOWins() public {
        // Trader buys both YES and NO
        vm.prank(trader1);
        amm.tradePositions(address(market), YES, 100 * int256(WAD), 500 * WAD);
        vm.prank(trader1);
        amm.tradePositions(address(market), NO, 50 * int256(WAD), 300 * WAD);

        // Settle as NO
        vm.prank(adjudicator);
        market.settle(0, 0);

        // Settle position - should only pay out NO shares
        vm.prank(trader1);
        uint256 payout = amm.settlePosition(address(market));

        // Only NO shares pay out
        assertEq(payout, 50 * WAD, "Only NO shares should pay out");
    }

    // ============================================
    // Settlement Tests - Edge Cases
    // ============================================

    function test_SettlePosition_ZeroPayout() public {
        // Trader buys YES but NO wins
        vm.prank(trader1);
        amm.tradePositions(address(market), YES, 100 * int256(WAD), 500 * WAD);

        // Settle as NO
        vm.prank(adjudicator);
        market.settle(0, 0);

        uint256 usdcBefore = usdc.balanceOf(trader1);

        // Settle position - 0 payout
        vm.prank(trader1);
        uint256 payout = amm.settlePosition(address(market));

        assertEq(payout, 0, "Payout should be zero for losing side");
        assertEq(usdc.balanceOf(trader1), usdcBefore, "USDC should not change");

        // Position should still be cleared
        (uint256 yesShares, uint256 noShares) = amm.getPosition(address(market), trader1);
        assertEq(yesShares, 0, "YES should be cleared");
        assertEq(noShares, 0, "NO should be cleared");
    }

    function test_SettlePosition_MultipleUsers() public {
        // Trader1 buys YES
        vm.prank(trader1);
        amm.tradePositions(address(market), YES, 100 * int256(WAD), 500 * WAD);

        // Trader2 buys NO
        vm.prank(trader2);
        amm.tradePositions(address(market), NO, 80 * int256(WAD), 400 * WAD);

        // Settle as YES
        vm.prank(adjudicator);
        market.settle(1, 0);

        // Both settle
        vm.prank(trader1);
        uint256 payout1 = amm.settlePosition(address(market));

        vm.prank(trader2);
        uint256 payout2 = amm.settlePosition(address(market));

        assertEq(payout1, 100 * WAD, "Trader1 should get full payout");
        assertEq(payout2, 0, "Trader2 should get zero");
    }

    // ============================================
    // Revert Tests
    // ============================================

    function test_RevertWhen_SettleBeforeMarketSettled() public {
        // Trader buys YES
        vm.prank(trader1);
        amm.tradePositions(address(market), YES, 100 * int256(WAD), 500 * WAD);

        // Try to settle before market is settled
        vm.prank(trader1);
        vm.expectRevert("AMMEngine: not settled");
        amm.settlePosition(address(market));
    }

    function test_RevertWhen_NoPositionToSettle() public {
        // Settle market
        vm.prank(adjudicator);
        market.settle(1, 0);

        // Try to settle with no position
        vm.prank(trader1);
        vm.expectRevert("AMMEngine: no position");
        amm.settlePosition(address(market));
    }

    function test_RevertWhen_SettleTwice() public {
        // Trader buys YES
        vm.prank(trader1);
        amm.tradePositions(address(market), YES, 100 * int256(WAD), 500 * WAD);

        // Settle market
        vm.prank(adjudicator);
        market.settle(1, 0);

        // First settlement
        vm.prank(trader1);
        amm.settlePosition(address(market));

        // Second settlement should fail
        vm.prank(trader1);
        vm.expectRevert("AMMEngine: no position");
        amm.settlePosition(address(market));
    }

    // ============================================
    // T* Retro Settlement Tests
    // ============================================

    function test_ApplyRetroSettlement_Reverts() public {
        // Should always revert as T* is not implemented
        vm.prank(trader1);
        vm.expectRevert("AMMEngine: T* not implemented");
        amm.applyRetroSettlement(address(market), trader1, "");
    }

    // ============================================
    // Fuzz Tests
    // ============================================

    function testFuzz_SettlePosition_RandomYESShares(uint256 shares) public {
        shares = bound(shares, 1, 1000 * WAD);

        // Trader buys YES
        vm.prank(trader1);
        amm.tradePositions(address(market), YES, int256(shares), type(uint256).max);

        // Settle as YES
        vm.prank(adjudicator);
        market.settle(1, 0);

        // Settle position
        vm.prank(trader1);
        uint256 payout = amm.settlePosition(address(market));

        assertEq(payout, shares, "Payout should equal shares bought");
    }

    function testFuzz_SettlePosition_RandomNOShares(uint256 shares) public {
        shares = bound(shares, 1, 1000 * WAD);

        // Trader buys NO
        vm.prank(trader1);
        amm.tradePositions(address(market), NO, int256(shares), type(uint256).max);

        // Settle as NO
        vm.prank(adjudicator);
        market.settle(0, 0);

        // Settle position
        vm.prank(trader1);
        uint256 payout = amm.settlePosition(address(market));

        assertEq(payout, shares, "Payout should equal shares bought");
    }
}

