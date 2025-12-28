// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {TruthMarket} from "../../contracts/TruthMarket.sol";
import {Collateralizer} from "../../contracts/Collateralizer.sol";
import {TickBook} from "../../contracts/TickBook.sol";
import {TickBookVault} from "../../contracts/TickBookVault.sol";
import {OutcomeToken} from "../../contracts/OutcomeToken.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";

/**
 * @title V8IntegrationTest
 * @notice End-to-end integration tests for V8 architecture (Collateralizer domain)
 * @dev TickBook tests are separate since it now uses TickBookVault
 */
contract V8IntegrationTest is Test {
    // Contracts
    TruthMarket public market;
    Collateralizer public collateralizer;
    TickBook public tickBook;
    TickBookVault public vault;
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
        vault = new TickBookVault(address(usdc), address(this));
        tickBook = new TickBook(address(vault));
        vault.setTickBook(address(tickBook));
        
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
        
        // Register market with tickBook at 50% probability
        marketKey = tickBook.registerMarket(
            address(market),
            yesToken,
            noToken,
            0.5e18
        );
        
        // Fund users
        usdc.mint(alice, 10000 * WAD);
        usdc.mint(bob, 10000 * WAD);
        usdc.mint(carol, 10000 * WAD);
    }
    
    // ==================================================
    // Collateralizer Split/Merge/Redeem Tests
    // ==================================================
    
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
        
        // === PHASE 2: Market settles as YES ===
        vm.prank(adjudicator);
        market.settle(1, 0); // YES wins, no T*
        
        assertTrue(market.isSettled());
        
        // === PHASE 3: Users redeem winning tokens ===
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
