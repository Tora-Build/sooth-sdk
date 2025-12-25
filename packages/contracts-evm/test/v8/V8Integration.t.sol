// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {TruthMarket} from "../../contracts/TruthMarket.sol";
import {Collateralizer} from "../../contracts/Collateralizer.sol";
import {TickBook} from "../../contracts/TickBook.sol";
import {OutcomeToken} from "../../contracts/OutcomeToken.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";

/**
 * @title V8IntegrationTest
 * @notice End-to-end integration tests for V8 architecture
 */
contract V8IntegrationTest is Test {
    // Contracts
    TruthMarket public market;
    Collateralizer public collateralizer;
    TickBook public tickBook;
    ERC20Mock public usdc;
    
    // Actors
    address public creator = address(0x1);
    address public adjudicator = address(0x2);
    address public guardian = address(0x3);
    address public alice = address(0x10);
    address public bob = address(0x11);
    address public carol = address(0x12);
    
    // Tokens
    address public yesToken;
    address public noToken;
    bytes32 public marketKey;
    
    uint256 constant WAD = 1e18;
    
    function setUp() public {
        // Deploy infrastructure
        usdc = new ERC20Mock();
        collateralizer = new Collateralizer(address(usdc));
        tickBook = new TickBook();
        
        // Create market
        vm.prank(creator);
        market = new TruthMarket(
            "Will ETH > $5000 by EOY?",
            uint64(block.timestamp + 30 days),
            adjudicator,
            guardian
        );
        
        // Activate market
        vm.prank(creator);
        market.activate();
        
        // Register market with collateralizer
        (yesToken, noToken) = collateralizer.registerMarket(
            address(market),
            "ETH > $5000",
            "ETH5K"
        );
        
        // Register market with tickBook
        marketKey = tickBook.registerMarket(
            address(market),
            yesToken,
            noToken
        );
        
        // Fund users
        usdc.mint(alice, 10000 * WAD);
        usdc.mint(bob, 10000 * WAD);
        usdc.mint(carol, 10000 * WAD);
    }
    
    function test_FullLifecycle_YESWins() public {
        // === PHASE 1: Users split USDC into tokens ===
        vm.startPrank(alice);
        usdc.approve(address(collateralizer), 1000 * WAD);
        collateralizer.split(address(market), 1000 * WAD);
        vm.stopPrank();
        
        vm.startPrank(bob);
        usdc.approve(address(collateralizer), 500 * WAD);
        collateralizer.split(address(market), 500 * WAD);
        vm.stopPrank();
        
        // Verify token balances
        assertEq(OutcomeToken(yesToken).balanceOf(alice), 1000 * WAD);
        assertEq(OutcomeToken(noToken).balanceOf(alice), 1000 * WAD);
        
        // === PHASE 2: Users provide depth to TickBook ===
        vm.startPrank(alice);
        OutcomeToken(yesToken).approve(address(tickBook), 500 * WAD);
        OutcomeToken(noToken).approve(address(tickBook), 500 * WAD);
        tickBook.placeLimitOrder(marketKey, 5000, 5000, 500 * WAD); // At 50% tick
        vm.stopPrank();
        
        // === PHASE 3: Bob executes a market order ===
        vm.startPrank(bob);
        OutcomeToken(noToken).approve(address(tickBook), 100 * WAD);
        uint256 yesReceived = tickBook.executeMarketOrder(marketKey, true, 100 * WAD, 6000);
        vm.stopPrank();
        
        assertTrue(yesReceived > 0);
        
        // === PHASE 4: Market settles as YES ===
        vm.prank(adjudicator);
        market.settle(1, 0); // YES wins, no T*
        
        assertTrue(market.isSettled());
        
        // === PHASE 5: Users redeem winning tokens ===
        vm.startPrank(alice);
        uint256 aliceYesBalance = OutcomeToken(yesToken).balanceOf(alice);
        OutcomeToken(yesToken).approve(address(collateralizer), aliceYesBalance);
        uint256 alicePayout = collateralizer.redeem(address(market), aliceYesBalance);
        vm.stopPrank();
        
        // Alice should get 1:1 redemption for YES tokens
        assertEq(alicePayout, aliceYesBalance);
        assertEq(usdc.balanceOf(alice), 9000 * WAD + alicePayout);
    }
    
    function test_FullLifecycle_NOWins() public {
        // Split tokens
        vm.startPrank(alice);
        usdc.approve(address(collateralizer), 1000 * WAD);
        collateralizer.split(address(market), 1000 * WAD);
        vm.stopPrank();
        
        // Settle as NO
        vm.prank(adjudicator);
        market.settle(0, 0); // NO wins
        
        // Redeem NO tokens
        vm.startPrank(alice);
        uint256 noBalance = OutcomeToken(noToken).balanceOf(alice);
        OutcomeToken(noToken).approve(address(collateralizer), noBalance);
        uint256 payout = collateralizer.redeemOutcome(address(market), 0, noBalance);
        vm.stopPrank();
        
        assertEq(payout, 1000 * WAD);
    }
    
    function test_FullLifecycle_INVALID() public {
        // Split tokens
        vm.startPrank(alice);
        usdc.approve(address(collateralizer), 1000 * WAD);
        collateralizer.split(address(market), 1000 * WAD);
        vm.stopPrank();
        
        // Settle as INVALID
        vm.prank(adjudicator);
        market.settle(2, 0); // INVALID
        
        // Redeem YES tokens (should get 50%)
        vm.startPrank(alice);
        uint256 yesBalance = OutcomeToken(yesToken).balanceOf(alice);
        OutcomeToken(yesToken).approve(address(collateralizer), yesBalance);
        uint256 yesPayout = collateralizer.redeemOutcome(address(market), 1, yesBalance);
        
        // Redeem NO tokens (should get 50%)
        uint256 noBalance = OutcomeToken(noToken).balanceOf(alice);
        OutcomeToken(noToken).approve(address(collateralizer), noBalance);
        uint256 noPayout = collateralizer.redeemOutcome(address(market), 0, noBalance);
        vm.stopPrank();
        
        assertEq(yesPayout, 500 * WAD); // 50% of 1000
        assertEq(noPayout, 500 * WAD);  // 50% of 1000
        assertEq(usdc.balanceOf(alice), 9000 * WAD + yesPayout + noPayout);
    }
    
    function test_MultipleUsers_Trading() public {
        // All users split tokens
        address[3] memory users = [alice, bob, carol];
        for (uint i = 0; i < users.length; i++) {
            vm.startPrank(users[i]);
            usdc.approve(address(collateralizer), 1000 * WAD);
            collateralizer.split(address(market), 1000 * WAD);
            vm.stopPrank();
        }
        
        // Alice provides depth
        vm.startPrank(alice);
        OutcomeToken(yesToken).approve(address(tickBook), 1000 * WAD);
        OutcomeToken(noToken).approve(address(tickBook), 1000 * WAD);
        tickBook.placeLimitOrder(marketKey, 4900, 5100, 500 * WAD);
        vm.stopPrank();
        
        // Bob and Carol trade
        vm.startPrank(bob);
        OutcomeToken(noToken).approve(address(tickBook), 100 * WAD);
        tickBook.executeMarketOrder(marketKey, true, 100 * WAD, 6000);
        vm.stopPrank();
        
        vm.startPrank(carol);
        OutcomeToken(yesToken).approve(address(tickBook), 100 * WAD);
        tickBook.executeMarketOrder(marketKey, false, 100 * WAD, 4000);
        vm.stopPrank();
        
        // Verify total collateral is conserved
        uint256 totalCollateral = collateralizer.getTotalCollateral(address(market));
        assertEq(totalCollateral, 3000 * WAD);
    }
    
    function test_GuardianVeto_ThenResettle() public {
        // Split tokens
        vm.startPrank(alice);
        usdc.approve(address(collateralizer), 1000 * WAD);
        collateralizer.split(address(market), 1000 * WAD);
        vm.stopPrank();
        
        // Settle incorrectly
        vm.prank(adjudicator);
        market.settle(1, 0); // YES
        
        // Guardian vetoes
        vm.prank(guardian);
        market.veto();
        
        assertFalse(market.isSettled());
        
        // Resettle correctly
        vm.prank(adjudicator);
        market.settle(0, 0); // NO
        
        // Redeem NO tokens
        vm.startPrank(alice);
        uint256 noBalance = OutcomeToken(noToken).balanceOf(alice);
        OutcomeToken(noToken).approve(address(collateralizer), noBalance);
        uint256 payout = collateralizer.redeemOutcome(address(market), 0, noBalance);
        vm.stopPrank();
        
        assertEq(payout, 1000 * WAD);
    }
    
    function test_Invariant_CollateralConservation() public {
        // Multiple users split
        vm.startPrank(alice);
        usdc.approve(address(collateralizer), 1000 * WAD);
        collateralizer.split(address(market), 1000 * WAD);
        vm.stopPrank();
        
        vm.startPrank(bob);
        usdc.approve(address(collateralizer), 500 * WAD);
        collateralizer.split(address(market), 500 * WAD);
        vm.stopPrank();
        
        // Total YES supply == Total NO supply
        assertEq(
            OutcomeToken(yesToken).totalSupply(),
            OutcomeToken(noToken).totalSupply()
        );
        
        // Total collateral == Total YES supply
        assertEq(
            collateralizer.getTotalCollateral(address(market)),
            OutcomeToken(yesToken).totalSupply()
        );
    }
}
