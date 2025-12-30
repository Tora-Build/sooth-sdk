// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Collateralizer} from "../../contracts/Collateralizer.sol";
import {TruthMarket} from "../../contracts/TruthMarket.sol";
import {OutcomeToken} from "../../contracts/OutcomeToken.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";

contract CollateralizerTest is Test {
    Collateralizer public collateralizer;
    ERC20Mock public usdc;
    TruthMarket public market;
    
    address public alice = address(0x1);
    address public adjudicator = address(0x99);
    address public guardian = address(0x98);
    
    uint256 constant WAD = 1e18;
    
    function setUp() public {
        usdc = new ERC20Mock();
        collateralizer = new Collateralizer(address(usdc));
        
        // Create market
        market = new TruthMarket(
            "Will ETH > $5000?",
            uint64(block.timestamp + 7 days),
            adjudicator,
            guardian
        );
        
        // Activate market
        market.activate();
        
        // Register market with collateralizer
        collateralizer.registerMarket(
            address(market),
            "Test Market",
            "TEST"
        );
        
        // Mint USDC to alice
        usdc.mint(alice, 1000 * WAD);
    }
    
    function test_RegisterMarket() public {
        (address yesToken, address noToken) = collateralizer.getOutcomeTokens(address(market));
        
        assertTrue(yesToken != address(0));
        assertTrue(noToken != address(0));
        assertTrue(collateralizer.isMarketRegistered(address(market)));
    }
    
    function test_Split() public {
        vm.startPrank(alice);
        usdc.approve(address(collateralizer), 100 * WAD);
        collateralizer.split(address(market), 100 * WAD);
        vm.stopPrank();
        
        (uint256 yesBalance, uint256 noBalance) = collateralizer.getBalances(address(market), alice);
        
        assertEq(yesBalance, 100 * WAD);
        assertEq(noBalance, 100 * WAD);
        assertEq(collateralizer.getTotalCollateral(address(market)), 100 * WAD);
    }
    
    function test_Merge() public {
        // Split first
        vm.startPrank(alice);
        usdc.approve(address(collateralizer), 100 * WAD);
        collateralizer.split(address(market), 100 * WAD);
        
        // Merge back
        (address yesToken, address noToken) = collateralizer.getOutcomeTokens(address(market));
        OutcomeToken(yesToken).approve(address(collateralizer), 50 * WAD);
        OutcomeToken(noToken).approve(address(collateralizer), 50 * WAD);
        collateralizer.merge(address(market), 50 * WAD);
        vm.stopPrank();
        
        (uint256 yesBalance, uint256 noBalance) = collateralizer.getBalances(address(market), alice);
        
        assertEq(yesBalance, 50 * WAD);
        assertEq(noBalance, 50 * WAD);
        assertEq(usdc.balanceOf(alice), 950 * WAD); // Got 50 back
    }
    
    function test_RedeemYES() public {
        // Split tokens
        vm.startPrank(alice);
        usdc.approve(address(collateralizer), 100 * WAD);
        collateralizer.split(address(market), 100 * WAD);
        vm.stopPrank();
        
        // Settle market as YES
        vm.prank(adjudicator);
        market.settle(1, 0); // YES wins, no T*
        
        // Redeem YES tokens
        vm.startPrank(alice);
        (address yesToken,) = collateralizer.getOutcomeTokens(address(market));
        OutcomeToken(yesToken).approve(address(collateralizer), 100 * WAD);
        uint256 payout = collateralizer.redeem(address(market), 100 * WAD);
        vm.stopPrank();
        
        assertEq(payout, 100 * WAD);
        assertEq(usdc.balanceOf(alice), 1000 * WAD); // Got all USDC back
    }
    
    function test_RedeemNO() public {
        // Split tokens
        vm.startPrank(alice);
        usdc.approve(address(collateralizer), 100 * WAD);
        collateralizer.split(address(market), 100 * WAD);
        vm.stopPrank();
        
        // Settle market as NO
        vm.prank(adjudicator);
        market.settle(0, 0); // NO wins
        
        // Redeem NO tokens
        vm.startPrank(alice);
        (, address noToken) = collateralizer.getOutcomeTokens(address(market));
        OutcomeToken(noToken).approve(address(collateralizer), 100 * WAD);
        uint256 payout = collateralizer.redeemOutcome(address(market), 0, 100 * WAD);
        vm.stopPrank();
        
        assertEq(payout, 100 * WAD);
    }
    
    function test_RedeemINVALID() public {
        // Split tokens
        vm.startPrank(alice);
        usdc.approve(address(collateralizer), 100 * WAD);
        collateralizer.split(address(market), 100 * WAD);
        vm.stopPrank();
        
        // Settle market as INVALID
        vm.prank(adjudicator);
        market.settle(2, 0); // INVALID
        
        // Redeem YES tokens (should get 50%)
        vm.startPrank(alice);
        (address yesToken,) = collateralizer.getOutcomeTokens(address(market));
        OutcomeToken(yesToken).approve(address(collateralizer), 100 * WAD);
        uint256 payout = collateralizer.redeemOutcome(address(market), 1, 100 * WAD);
        vm.stopPrank();
        
        assertEq(payout, 50 * WAD); // 50% redemption for INVALID
    }
    
    function testFuzz_SplitMerge(uint256 amount) public {
        amount = bound(amount, 1, 1000 * WAD);
        
        vm.startPrank(alice);
        usdc.approve(address(collateralizer), amount);
        collateralizer.split(address(market), amount);
        
        (address yesToken, address noToken) = collateralizer.getOutcomeTokens(address(market));
        OutcomeToken(yesToken).approve(address(collateralizer), amount);
        OutcomeToken(noToken).approve(address(collateralizer), amount);
        collateralizer.merge(address(market), amount);
        vm.stopPrank();
        
        assertEq(usdc.balanceOf(alice), 1000 * WAD); // Back to original
    }
    
    function test_RevertWhen_RedeemBeforeSettlement() public {
        vm.startPrank(alice);
        usdc.approve(address(collateralizer), 100 * WAD);
        collateralizer.split(address(market), 100 * WAD);
        
        vm.expectRevert("Collateralizer: not settled");
        collateralizer.redeem(address(market), 100 * WAD);
        vm.stopPrank();
    }
    
    function test_Invariant_TokenSymmetry() public {
        vm.startPrank(alice);
        usdc.approve(address(collateralizer), 100 * WAD);
        collateralizer.split(address(market), 100 * WAD);
        vm.stopPrank();
        
        (address yesToken, address noToken) = collateralizer.getOutcomeTokens(address(market));
        
        // YES and NO supply must be equal
        assertEq(
            OutcomeToken(yesToken).totalSupply(),
            OutcomeToken(noToken).totalSupply()
        );
    }
}
