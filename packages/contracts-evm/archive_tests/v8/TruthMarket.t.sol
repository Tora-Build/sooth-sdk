// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {TruthMarket} from "../../contracts/TruthMarket.sol";

contract TruthMarketTest is Test {
    TruthMarket public market;
    
    address public creator = address(0x1);
    address public adjudicator = address(0x2);
    address public guardian = address(0x3);
    
    uint256 constant WAD = 1e18;
    
    function setUp() public {
        vm.prank(creator);
        market = new TruthMarket(
            "Will ETH > $5000 by EOY?",
            uint64(block.timestamp + 30 days),
            adjudicator,
            guardian
        );
    }
    
    function test_InitialState() public {
        assertEq(market.question(), "Will ETH > $5000 by EOY?");
        assertEq(market.creator(), creator);
        assertEq(market.deadline(), block.timestamp + 30 days);
        assertFalse(market.isLive());
        assertFalse(market.isSettled());
    }
    
    function test_Activate() public {
        vm.prank(creator);
        market.activate();
        
        assertTrue(market.isLive());
    }
    
    function test_RevertWhen_NonCreatorActivates() public {
        vm.prank(address(0x999));
        vm.expectRevert("TruthMarket: not creator");
        market.activate();
    }
    
    function test_SettleYES() public {
        vm.prank(creator);
        market.activate();
        
        vm.prank(adjudicator);
        market.settle(1, 0); // YES, no T*
        
        assertTrue(market.isSettled());
        assertEq(market.winningOutcome(), 1);
        assertEq(market.tStar(), 0);
    }
    
    function test_SettleNO() public {
        vm.prank(creator);
        market.activate();
        
        vm.prank(adjudicator);
        market.settle(0, 0); // NO, no T*
        
        assertTrue(market.isSettled());
        assertEq(market.winningOutcome(), 0);
    }
    
    function test_SettleWithTStar() public {
        vm.prank(creator);
        market.activate();
        
        // Warp forward to avoid underflow
        vm.warp(block.timestamp + 7 days);
        uint64 truthTime = uint64(block.timestamp - 1 days);
        
        vm.prank(adjudicator);
        market.settle(1, truthTime);
        
        assertEq(market.tStar(), truthTime);
    }
    
    function test_RevertWhen_TStarInFuture() public {
        vm.prank(creator);
        market.activate();
        
        uint64 futureTime = uint64(block.timestamp + 1 days);
        
        vm.prank(adjudicator);
        vm.expectRevert("TruthMarket: tStar in future");
        market.settle(1, futureTime);
    }
    
    function test_Finalize() public {
        vm.prank(creator);
        market.activate();
        
        vm.prank(adjudicator);
        market.settle(1, 0);
        
        vm.prank(adjudicator);
        market.finalize();
        
        assertTrue(market.isSettled());
    }
    
    function test_GuardianVeto() public {
        vm.prank(creator);
        market.activate();
        
        vm.prank(adjudicator);
        market.settle(1, 0);
        
        // Guardian vetoes
        vm.prank(guardian);
        market.veto();
        
        assertFalse(market.isSettled());
        assertEq(market.winningOutcome(), 0);
    }
    
    function test_RedemptionValueYES() public {
        vm.prank(creator);
        market.activate();
        
        vm.prank(adjudicator);
        market.settle(1, 0); // YES wins
        
        assertEq(market.getRedemptionValue(1), WAD); // YES = 1.0
        assertEq(market.getRedemptionValue(0), 0);   // NO = 0.0
    }
    
    function test_RedemptionValueNO() public {
        vm.prank(creator);
        market.activate();
        
        vm.prank(adjudicator);
        market.settle(0, 0); // NO wins
        
        assertEq(market.getRedemptionValue(0), WAD); // NO = 1.0
        assertEq(market.getRedemptionValue(1), 0);   // YES = 0.0
    }
    
    function test_RedemptionValueINVALID() public {
        vm.prank(creator);
        market.activate();
        
        vm.prank(adjudicator);
        market.settle(2, 0); // INVALID
        
        assertEq(market.getRedemptionValue(0), WAD / 2); // NO = 0.5
        assertEq(market.getRedemptionValue(1), WAD / 2); // YES = 0.5
    }
    
    function test_RevertWhen_NonAdjudicatorSettles() public {
        vm.prank(creator);
        market.activate();
        
        vm.prank(address(0x999));
        vm.expectRevert("TruthMarket: not adjudicator");
        market.settle(1, 0);
    }
    
    function test_RevertWhen_InvalidOutcome() public {
        vm.prank(creator);
        market.activate();
        
        vm.prank(adjudicator);
        vm.expectRevert("TruthMarket: invalid outcome");
        market.settle(3, 0); // Invalid outcome
    }
    
    function testFuzz_SettleWithTStar(uint64 tStar) public {
        vm.prank(creator);
        market.activate();
        
        // Bound tStar to valid range
        tStar = uint64(bound(tStar, 0, block.timestamp));
        
        vm.prank(adjudicator);
        market.settle(1, tStar);
        
        assertEq(market.tStar(), tStar);
    }
}
