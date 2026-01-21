// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TrialPeriodTestBase} from "../base/TrialPeriodTestBase.sol";
import {LaunchpadLPToken} from "@core/LaunchpadLPToken.sol";
import {TruthMarket} from "@core/TruthMarket.sol";

/**
 * @title LaunchpadLPToken Unit Tests
 * @notice Tests for ERC20 LP token with settlement-locked transfers
 */
contract LaunchpadLPTokenTest is TrialPeriodTestBase {
    // ============================================
    // Test State
    // ============================================

    LaunchpadLPToken internal lpToken;
    address internal testMarket;

    // ============================================
    // Setup
    // ============================================

    function setUp() public override {
        super.setUp();

        // Create a test market
        testMarket = address(new TruthMarket(
            "Test Market",
            uint64(block.timestamp),
            uint64(block.timestamp + 30 days),
            adjudicator,
            address(protocolConfig),
            creator
        ));

        // Deploy LP token directly for isolated testing
        lpToken = new LaunchpadLPToken(
            testMarket,
            address(this), // launchpadEngine = this contract for testing
            "Test LP Token",
            "TLP"
        );

        // Mint some tokens for testing
        lpToken.mint(alice, 1000e18);
        lpToken.mint(bob, 500e18);
    }

    // ============================================
    // Constructor Tests
    // ============================================

    function test_Constructor_SetsMarket() public view {
        assertEq(lpToken.market(), testMarket, "Market should be set");
    }

    function test_Constructor_SetsLaunchpadEngine() public view {
        assertEq(lpToken.launchpadEngine(), address(this), "Engine should be set");
    }

    function test_Constructor_SetsNameAndSymbol() public view {
        assertEq(lpToken.name(), "Test LP Token", "Name should match");
        assertEq(lpToken.symbol(), "TLP", "Symbol should match");
    }

    function test_Constructor_RevertsOnZeroMarket() public {
        vm.expectRevert(LaunchpadLPToken.ZeroAddress.selector);
        new LaunchpadLPToken(address(0), address(this), "Test", "T");
    }

    function test_Constructor_RevertsOnZeroEngine() public {
        vm.expectRevert(LaunchpadLPToken.ZeroAddress.selector);
        new LaunchpadLPToken(testMarket, address(0), "Test", "T");
    }

    // ============================================
    // Transfer Lock Tests
    // ============================================

    function test_Transfer_AllowedPreSettlement() public {
        // Market not settled - transfers should work
        assertTrue(lpToken.transfersUnlocked(), "Transfers should be unlocked");

        vm.prank(alice);
        bool success = lpToken.transfer(bob, 100e18);

        assertTrue(success, "Transfer should succeed");
        assertEq(lpToken.balanceOf(bob), 600e18, "Bob should have 600");
        assertEq(lpToken.balanceOf(alice), 900e18, "Alice should have 900");
    }

    function test_Transfer_BlockedPostSettlement() public {
        // Settle the market
        vm.prank(adjudicator);
        TruthMarket(testMarket).settle(1, 0);

        assertFalse(lpToken.transfersUnlocked(), "Transfers should be locked");

        vm.prank(alice);
        vm.expectRevert(LaunchpadLPToken.TransfersLocked.selector);
        lpToken.transfer(bob, 100e18);
    }

    function test_TransferFrom_AllowedPreSettlement() public {
        vm.prank(alice);
        lpToken.approve(bob, 200e18);

        vm.prank(bob);
        bool success = lpToken.transferFrom(alice, bob, 100e18);

        assertTrue(success, "TransferFrom should succeed");
    }

    function test_TransferFrom_BlockedPostSettlement() public {
        vm.prank(alice);
        lpToken.approve(bob, 200e18);

        // Settle the market
        vm.prank(adjudicator);
        TruthMarket(testMarket).settle(1, 0);

        vm.prank(bob);
        vm.expectRevert(LaunchpadLPToken.TransfersLocked.selector);
        lpToken.transferFrom(alice, bob, 100e18);
    }

    function test_TransfersUnlocked_ReturnsTruePreSettlement() public view {
        assertTrue(lpToken.transfersUnlocked(), "Should be unlocked");
    }

    function test_TransfersUnlocked_ReturnsFalsePostSettlement() public {
        vm.prank(adjudicator);
        TruthMarket(testMarket).settle(1, 0);

        assertFalse(lpToken.transfersUnlocked(), "Should be locked");
    }

    function test_TransfersUnlocked_ReturnsFalseAfterFinalize() public {
        vm.prank(adjudicator);
        TruthMarket(testMarket).settle(1, 0);

        vm.prank(adjudicator);
        TruthMarket(testMarket).finalize();

        assertFalse(lpToken.transfersUnlocked(), "Should be locked after finalize");
    }

    // ============================================
    // Mint/Burn Authorization Tests
    // ============================================

    function test_Mint_OnlyLaunchpadEngine() public {
        lpToken.mint(alice, 100e18);
        assertEq(lpToken.balanceOf(alice), 1100e18, "Should mint");
    }

    function test_Burn_OnlyLaunchpadEngine() public {
        lpToken.burn(alice, 100e18);
        assertEq(lpToken.balanceOf(alice), 900e18, "Should burn");
    }

    function test_Mint_RevertsFromUnauthorized() public {
        vm.prank(alice);
        vm.expectRevert(LaunchpadLPToken.OnlyLaunchpadEngine.selector);
        lpToken.mint(bob, 100e18);
    }

    function test_Burn_RevertsFromUnauthorized() public {
        vm.prank(alice);
        vm.expectRevert(LaunchpadLPToken.OnlyLaunchpadEngine.selector);
        lpToken.burn(alice, 100e18);
    }

    // ============================================
    // Mint/Burn After Settlement Tests
    // ============================================

    function test_Mint_AllowedAfterSettlement() public {
        vm.prank(adjudicator);
        TruthMarket(testMarket).settle(1, 0);

        // Minting still works (for LP redemption)
        lpToken.mint(alice, 100e18);
        assertEq(lpToken.balanceOf(alice), 1100e18, "Should mint after settlement");
    }

    function test_Burn_AllowedAfterSettlement() public {
        vm.prank(adjudicator);
        TruthMarket(testMarket).settle(1, 0);

        // Burning still works (for LP redemption)
        lpToken.burn(alice, 100e18);
        assertEq(lpToken.balanceOf(alice), 900e18, "Should burn after settlement");
    }

    // ============================================
    // View Functions Tests
    // ============================================

    function test_MarketQuestion_ReturnsCorrectly() public view {
        assertEq(lpToken.marketQuestion(), "Test Market", "Question should match");
    }

    function test_IsMarketSettled_ReturnsFalseInitially() public view {
        assertFalse(lpToken.isMarketSettled(), "Should not be settled");
    }

    function test_IsMarketSettled_ReturnsTrueAfterSettlement() public {
        vm.prank(adjudicator);
        TruthMarket(testMarket).settle(1, 0);

        assertTrue(lpToken.isMarketSettled(), "Should be settled");
    }

    // ============================================
    // ERC20 Compliance Tests
    // ============================================

    function test_TotalSupply_TracksCorrectly() public {
        uint256 supplyBefore = lpToken.totalSupply();

        lpToken.mint(alice, 100e18);
        assertEq(lpToken.totalSupply(), supplyBefore + 100e18, "Supply increased");

        lpToken.burn(alice, 50e18);
        assertEq(lpToken.totalSupply(), supplyBefore + 50e18, "Supply decreased");
    }

    function test_Approve_Works() public {
        vm.prank(alice);
        bool success = lpToken.approve(bob, 500e18);

        assertTrue(success, "Approve should succeed");
        assertEq(lpToken.allowance(alice, bob), 500e18, "Allowance set");
    }

    function test_Decimals_Returns18() public view {
        assertEq(lpToken.decimals(), 18, "Should have 18 decimals");
    }

    // ============================================
    // Edge Cases
    // ============================================

    function test_Transfer_ZeroAmount_AllowedPreSettlement() public {
        vm.prank(alice);
        bool success = lpToken.transfer(bob, 0);
        assertTrue(success, "Zero transfer should succeed");
    }

    function test_Transfer_ZeroAmount_BlockedPostSettlement() public {
        vm.prank(adjudicator);
        TruthMarket(testMarket).settle(1, 0);

        vm.prank(alice);
        vm.expectRevert(LaunchpadLPToken.TransfersLocked.selector);
        lpToken.transfer(bob, 0);
    }

    function test_SelfTransfer_AllowedPreSettlement() public {
        vm.prank(alice);
        bool success = lpToken.transfer(alice, 100e18);
        assertTrue(success, "Self transfer should succeed");
        assertEq(lpToken.balanceOf(alice), 1000e18, "Balance unchanged");
    }

    function test_SelfTransfer_BlockedPostSettlement() public {
        vm.prank(adjudicator);
        TruthMarket(testMarket).settle(1, 0);

        vm.prank(alice);
        vm.expectRevert(LaunchpadLPToken.TransfersLocked.selector);
        lpToken.transfer(alice, 100e18);
    }
}
