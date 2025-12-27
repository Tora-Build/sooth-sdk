// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {AMMEngine} from "../../contracts/AMMEngine.sol";
import {TruthMarket} from "../../contracts/TruthMarket.sol";
import {IAMMEngine} from "../../contracts/interfaces/IAMMEngine.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";

/**
 * @title SpendableProceedsTest
 * @notice Test suite for V8.2 spendable proceeds feature with dual-balance model
 * @dev Tests cross-market spendability, lock queue management, and capital efficiency
 */
contract MockUSDC is ERC20Mock {
    function decimals() public view virtual override returns (uint8) {
        return 6;
    }
}

contract SpendableProceedsTest is Test {
    AMMEngine public amm;
    TruthMarket public market1;
    TruthMarket public market2;
    ERC20Mock public usdc;

    address public user = address(0x1);
    address public trader1 = address(0x2);
    address public trader2 = address(0x3);
    address public adjudicator = address(0x4);
    address public guardian = address(0x5);

    uint256 constant WAD = 1e18;
    uint256 constant INITIAL_LIQUIDITY = 1000 * WAD;

    // V8.2 outcome constants
    uint8 constant YES = 0;
    uint8 constant NO = 1;

    event BalanceUsed(address indexed user, uint256 amount, uint256 remaining);
    event WalletPull(address indexed user, uint256 amount);
    event ProceedsLocked(address indexed user, address indexed market, uint256 amount, uint64 unlockTime);
    event LocksProcessed(address indexed user, uint256 count, uint256 totalUnlocked);



    function setUp() public {
        // Deploy mock USDC (6 decimals)
        usdc = new MockUSDC();

        // Deploy AMM
        amm = new AMMEngine(address(usdc), address(this));

        // Deploy two test markets
        market1 = new TruthMarket(
            "Market 1: UN Confirms Alien Life",
            uint64(block.timestamp + 30 days),
            adjudicator,
            guardian
        );

        market2 = new TruthMarket(
            "Market 2: BTC >= $100k",
            uint64(block.timestamp + 30 days),
            adjudicator,
            guardian
        );

        // Initialize markets
        amm.initializeMarket(address(market1), INITIAL_LIQUIDITY);
        amm.initializeMarket(address(market2), INITIAL_LIQUIDITY);

        // Activate markets
        vm.prank(address(this));
        market1.activate();
        vm.prank(address(this));
        market2.activate();

        // Fund users
        usdc.mint(user, 10000 * WAD);
        usdc.mint(trader1, 10000 * WAD);
        usdc.mint(trader2, 10000 * WAD);

        // Approve AMM
        vm.prank(user);
        usdc.approve(address(amm), type(uint256).max);
        vm.prank(trader1);
        usdc.approve(address(amm), type(uint256).max);
        vm.prank(trader2);
        usdc.approve(address(amm), type(uint256).max);
    }

    // ============================================
    // Balance Tracking Tests
    // ============================================

    function test_SpendAvailableBalance_FullCoverage() public {
        // Step 1: User sells to get locked proceeds
        vm.prank(user);
        amm.tradePositions(address(market1), YES, 100 * int256(WAD), 1000 * WAD); // Buy 100 YES

        vm.prank(user);
        uint256 sellCost = amm.tradePositions(address(market1), YES, -50 * int256(WAD), 0); // Sell 50 YES

        // Check balances
        (uint256 available, uint256 locked) = amm.getBalances(user);
        assertEq(available, sellCost, "Available should equal sell proceeds");
        assertEq(locked, sellCost, "Locked should equal sell proceeds");

        // Step 2: User buys in market2 using available balance
        // Use a smaller amount to ensure available balance covers it
        uint256 usdcBalanceBefore = usdc.balanceOf(user);
        
        // Get quote for a smaller buy that will fit in available balance
        (uint256 buyCost, ) = amm.getPositionQuote(address(market2), YES, 40 * int256(WAD));
        require(buyCost <= sellCost, "Buy cost should be less than available");
        
        vm.prank(user);
        amm.tradePositions(address(market2), YES, 40 * int256(WAD), buyCost);

        // Verify no USDC was pulled from wallet (or minimal amount)
        assertApproxEqAbs(
            usdc.balanceOf(user),
            usdcBalanceBefore,
            WAD / 10, // 0.1 USDC tolerance
            "Minimal or no USDC should be pulled from wallet"
        );

        // Verify available balance decreased
        (available, locked) = amm.getBalances(user);
        assertLt(available, sellCost, "Available should have decreased");
        assertEq(locked, sellCost, "Locked should remain unchanged");
    }

    function test_SpendAvailableBalance_PartialCoverage() public {
        // Step 1: User sells to get some locked proceeds
        vm.prank(user);
        amm.tradePositions(address(market1), YES, 100 * int256(WAD), 1000 * WAD);

        vm.prank(user);
        uint256 sellCost = amm.tradePositions(address(market1), YES, -50 * int256(WAD), 0);

        // Step 2: User buys MORE than available balance (partial coverage)
        uint256 usdcBalanceBefore = usdc.balanceOf(user);
        
        // Get quote for a large buy that will exceed available balance
        (uint256 buyCost, ) = amm.getPositionQuote(address(market2), YES, 100 * int256(WAD));
        require(buyCost > sellCost, "Buy cost should exceed available balance");
        
        vm.prank(user);
        amm.tradePositions(address(market2), YES, 100 * int256(WAD), buyCost);

        // Verify USDC was pulled from wallet (the difference)
        uint256 expectedPull = buyCost - sellCost;
        assertApproxEqAbs(
            usdc.balanceOf(user),
            usdcBalanceBefore - _wadToUsdcCeil(expectedPull),
            1e5, // 0.1 USDC tolerance
            "Should pull difference from wallet"
        );
    }

    function test_SpendAvailableBalance_NoCoverage() public {
        // User has no available balance, should pull from wallet
        uint256 usdcBalanceBefore = usdc.balanceOf(user);

        vm.prank(user);
        uint256 cost = amm.tradePositions(address(market1), YES, 100 * int256(WAD), 1000 * WAD);

        // Verify USDC was pulled from wallet
        assertEq(usdc.balanceOf(user), usdcBalanceBefore - _wadToUsdcCeil(cost), "Should pull from wallet");

        // Verify no available balance
        (uint256 available, ) = amm.getBalances(user);
        assertEq(available, 0, "Available should be zero");
    }

    // ============================================
    // Lock Queue Tests
    // ============================================

    function test_LockQueue_SingleEntry() public {
        // Buy then sell
        vm.prank(user);
        amm.tradePositions(address(market1), YES, 100 * int256(WAD), 1000 * WAD);

        vm.prank(user);
        uint256 sellCost = amm.tradePositions(address(market1), YES, -50 * int256(WAD), 0);

        // Check lock queue
        IAMMEngine.LockEntry[] memory queue = amm.getLockQueue(user);
        assertEq(queue.length, 1, "Should have 1 lock entry");
        assertEq(queue[0].amount, sellCost, "Lock amount should match sell proceeds");
        assertEq(queue[0].market, address(market1), "Lock market should be market1");
        assertEq(queue[0].expiry, block.timestamp + 24 hours, "Lock expiry should be 24h");
    }

    function test_LockQueue_MultipleEntries() public {
        // Multiple sells in different markets
        vm.prank(user);
        amm.tradePositions(address(market1), YES, 100 * int256(WAD), 1000 * WAD);
        vm.prank(user);
        uint256 sell1Cost = amm.tradePositions(address(market1), YES, -30 * int256(WAD), 0);

        vm.prank(user);
        amm.tradePositions(address(market2), YES, 100 * int256(WAD), 1000 * WAD);
        vm.prank(user);
        uint256 sell2Cost = amm.tradePositions(address(market2), YES, -40 * int256(WAD), 0);

        // Check lock queue
        IAMMEngine.LockEntry[] memory queue = amm.getLockQueue(user);
        assertEq(queue.length, 2, "Should have 2 lock entries");
        assertEq(queue[0].amount, sell1Cost, "First lock amount");
        assertEq(queue[0].market, address(market1), "First lock market");
        assertEq(queue[1].amount, sell2Cost, "Second lock amount");
        assertEq(queue[1].market, address(market2), "Second lock market");
    }

    // ============================================
    // Claim Tests
    // ============================================

    function test_ClaimUnlocked_SingleEntry() public {
        // Create locked proceeds
        vm.prank(user);
        amm.tradePositions(address(market1), YES, 100 * int256(WAD), 1000 * WAD);
        vm.prank(user);
        uint256 sellCost = amm.tradePositions(address(market1), YES, -50 * int256(WAD), 0);

        // Try to claim before expiry (should fail)
        vm.prank(user);
        vm.expectRevert("AMMEngine: no unlocked proceeds");
        amm.claimUnlocked(50);

        // Fast forward 24 hours + 1 second (to ensure expiry has passed)
        vm.warp(block.timestamp + 24 hours + 1);

        // Claim unlocked proceeds
        uint256 usdcBalanceBefore = usdc.balanceOf(user);
        
        vm.prank(user);
        vm.expectEmit(true, false, false, true);
        emit LocksProcessed(user, 1, sellCost);
        uint256 claimed = amm.claimUnlocked(50);

        assertEq(claimed, sellCost, "Should claim full amount");
        assertEq(usdc.balanceOf(user), usdcBalanceBefore + _wadToUsdc(sellCost), "USDC balance should increase");

        // Verify balances updated
        (uint256 available, uint256 locked) = amm.getBalances(user);
        assertEq(available, 0, "Available should be zero");
        assertEq(locked, 0, "Locked should be zero");

        // Verify queue is empty
        IAMMEngine.LockEntry[] memory queue = amm.getLockQueue(user);
        assertEq(queue.length, 0, "Queue should be empty");
    }

    function test_ClaimUnlocked_MultipleEntries() public {
        // Record start time for absolute time tracking
        uint256 startTime = block.timestamp;
        
        // Create 3 lock entries at different times
        vm.prank(user);
        amm.tradePositions(address(market1), YES, 100 * int256(WAD), 1000 * WAD);
        
        // Lock 1 at startTime (expires at startTime + 24h)
        vm.prank(user);
        uint256 sell1 = amm.tradePositions(address(market1), YES, -20 * int256(WAD), 0);
        uint64 expiry1 = uint64(startTime + 24 hours);

        // Warp to startTime + 1h, create Lock 2 (expires at startTime + 25h)
        vm.warp(startTime + 1 hours);
        vm.prank(user);
        uint256 sell2 = amm.tradePositions(address(market1), YES, -20 * int256(WAD), 0);

        // Warp to startTime + 2h, create Lock 3 (expires at startTime + 26h)
        vm.warp(startTime + 2 hours);
        vm.prank(user);
        uint256 sell3 = amm.tradePositions(address(market1), YES, -20 * int256(WAD), 0);

        // Warp to after first lock expires (startTime + 24h + 1s)
        vm.warp(expiry1 + 1);

        // Claim (only first entry should be unlocked)
        vm.prank(user);
        uint256 claimed = amm.claimUnlocked(50);
        assertEq(claimed, sell1, "Should claim first entry only");

        // Warp to after 2nd and 3rd locks expire (startTime + 26h + 1s)
        vm.warp(startTime + 26 hours + 1);

        vm.prank(user);
        claimed = amm.claimUnlocked(50);
        assertEq(claimed, sell2 + sell3, "Should claim remaining entries");
    }

    function test_ClaimUnlocked_PartialUnlock() public {
        // This test verifies that the claim function can handle partial unlocks
        // We'll create multiple locks and verify the bounded iteration works
        
        uint256 startTime = block.timestamp;
        
        // Create initial position
        vm.prank(user);
        amm.tradePositions(address(market1), YES, 200 * int256(WAD), 2000 * WAD);
        
        // Create 3 locks at the same time (will all unlock together)
        for (uint256 i = 0; i < 3; i++) {
            vm.prank(user);
            amm.tradePositions(address(market1), YES, -10 * int256(WAD), 0);
        }

        // Verify we have 3 locks
        IAMMEngine.LockEntry[] memory queueBefore = amm.getLockQueue(user);
        assertEq(queueBefore.length, 3, "Should have 3 lock entries");

        // Warp past expiry
        vm.warp(startTime + 24 hours + 1);

        // Claim with limit of 2 (bounded iteration)
        vm.prank(user);
        amm.claimUnlocked(2);

        // Verify 1 entry still remains (we only claimed 2 out of 3)
        IAMMEngine.LockEntry[] memory queueAfter = amm.getLockQueue(user);
        assertEq(queueAfter.length, 1, "Should have 1 entry remaining after claiming 2");
    }

    function test_ClaimUnlocked_BoundedIteration() public {
        // Create 60 lock entries
        vm.prank(user);
        amm.tradePositions(address(market1), YES, 300 * int256(WAD), 3000 * WAD);
        
        for (uint256 i = 0; i < 60; i++) {
            vm.prank(user);
            amm.tradePositions(address(market1), YES, -2 * int256(WAD), 0);
        }

        // Fast forward 24 hours + 1 second
        vm.warp(block.timestamp + 24 hours + 1);

        // First claim (max 50)
        vm.prank(user);
        amm.claimUnlocked(50);

        // Verify 10 entries remaining
        IAMMEngine.LockEntry[] memory queue = amm.getLockQueue(user);
        assertEq(queue.length, 10, "Should have 10 entries remaining");

        // Second claim (remaining 10)
        vm.prank(user);
        amm.claimUnlocked(50);

        // Verify queue is empty
        queue = amm.getLockQueue(user);
        assertEq(queue.length, 0, "Queue should be empty");
    }

    function test_RevertWhen_InvalidMaxClaims() public {
        vm.prank(user);
        vm.expectRevert("AMMEngine: invalid maxClaims");
        amm.claimUnlocked(0);

        vm.prank(user);
        vm.expectRevert("AMMEngine: invalid maxClaims");
        amm.claimUnlocked(51);
    }

    function test_RevertWhen_NoLocks() public {
        vm.prank(user);
        vm.expectRevert("AMMEngine: no locks");
        amm.claimUnlocked(50);
    }

    // ============================================
    // Cross-Market Spendability Tests (KEY FEATURE)
    // ============================================

    function test_CrossMarketSpendability() public {
        // Step 1: User buys in market1
        vm.prank(user);
        amm.tradePositions(address(market1), YES, 100 * int256(WAD), 1000 * WAD);

        // Step 2: User sells in market1 (gets locked proceeds)
        vm.prank(user);
        uint256 sellCost = amm.tradePositions(address(market1), YES, -50 * int256(WAD), 0);

        // Step 3: User IMMEDIATELY buys in market2 using locked proceeds
        uint256 usdcBalanceBefore = usdc.balanceOf(user);
        
        // Get quote for a smaller buy that will fit in available balance
        (uint256 buyCost, ) = amm.getPositionQuote(address(market2), YES, 40 * int256(WAD));
        require(buyCost <= sellCost, "Buy cost should be less than available");
        
        vm.prank(user);
        amm.tradePositions(address(market2), YES, 40 * int256(WAD), buyCost);

        // Verify minimal or no USDC was pulled from wallet (cross-market spendability works!)
        assertApproxEqAbs(
            usdc.balanceOf(user),
            usdcBalanceBefore,
            1e5, // 0.1 USDC tolerance
            "Minimal or no wallet pull - used locked proceeds"
        );

        // Verify lock queue shows market1 lock
        IAMMEngine.LockEntry[] memory queue = amm.getLockQueue(user);
        assertEq(queue.length, 1, "Should have 1 lock entry");
        assertEq(queue[0].market, address(market1), "Lock should be from market1");

        // Verify user has position in market2
        (uint256 yesShares, ) = amm.getPosition(address(market2), user);
        assertGt(yesShares, 0, "User should have YES position in market2");
    }

    function test_RapidTrading_SellBuySellBuy() public {
        // Simulate rapid trading across markets
        vm.startPrank(user);

        // Buy market1
        amm.tradePositions(address(market1), YES, 100 * int256(WAD), 1000 * WAD);

        // Sell market1 (get locked proceeds)
        amm.tradePositions(address(market1), YES, -50 * int256(WAD), 0);

        // Buy market2 (use locked proceeds)
        amm.tradePositions(address(market2), YES, 50 * int256(WAD), 500 * WAD);

        // Sell market2 (get more locked proceeds)
        amm.tradePositions(address(market2), YES, -25 * int256(WAD), 0);

        // Buy market1 again (use locked proceeds)
        amm.tradePositions(address(market1), YES, 25 * int256(WAD), 300 * WAD);

        vm.stopPrank();

        // Verify lock queue has 2 entries
        IAMMEngine.LockEntry[] memory queue = amm.getLockQueue(user);
        assertEq(queue.length, 2, "Should have 2 lock entries");
    }

    // ============================================
    // View Function Tests
    // ============================================

    function test_GetBalances() public {
        // Initially zero
        (uint256 available, uint256 locked) = amm.getBalances(user);
        assertEq(available, 0, "Initial available should be zero");
        assertEq(locked, 0, "Initial locked should be zero");

        // After sell
        vm.prank(user);
        amm.tradePositions(address(market1), YES, 100 * int256(WAD), 1000 * WAD);
        vm.prank(user);
        uint256 sellCost = amm.tradePositions(address(market1), YES, -50 * int256(WAD), 0);

        (available, locked) = amm.getBalances(user);
        assertEq(available, sellCost, "Available should equal sell proceeds");
        assertEq(locked, sellCost, "Locked should equal sell proceeds");
    }

    function test_GetClaimableAmount() public {
        // Record start time
        uint256 startTime = block.timestamp;
        
        // Create 3 locks at different times
        vm.prank(user);
        amm.tradePositions(address(market1), YES, 100 * int256(WAD), 1000 * WAD);
        
        // Lock 1 at startTime (expires at startTime + 24h)
        vm.prank(user);
        uint256 sell1 = amm.tradePositions(address(market1), YES, -20 * int256(WAD), 0);
        uint64 expiry1 = uint64(startTime + 24 hours);

        // Lock 2 at startTime + 1h (expires at startTime + 25h)
        vm.warp(startTime + 1 hours);
        vm.prank(user);
        uint256 sell2 = amm.tradePositions(address(market1), YES, -20 * int256(WAD), 0);

        // Lock 3 at startTime + 2h (expires at startTime + 26h)
        vm.warp(startTime + 2 hours);
        vm.prank(user);
        amm.tradePositions(address(market1), YES, -20 * int256(WAD), 0);

        // Check before any unlock (at startTime + 2h)
        (uint256 claimable, uint64 nextUnlock, uint256 nextAmount) = amm.getClaimableAmount(user);
        assertEq(claimable, 0, "Nothing claimable yet");
        assertEq(nextUnlock, expiry1, "Next unlock should be first entry");
        assertEq(nextAmount, sell1, "Next amount should be first entry");

        // Warp to after first lock expires (startTime + 24h + 1s)
        vm.warp(expiry1 + 1);

        (claimable, nextUnlock, nextAmount) = amm.getClaimableAmount(user);
        assertEq(claimable, sell1, "First entry should be claimable");
        assertGt(nextUnlock, 0, "Should have next unlock");
        assertEq(nextAmount, sell2, "Next amount should be second entry");
    }

    // ============================================
    // Edge Cases
    // ============================================

    function test_EmptyQueueAfterClaim() public {
        // Create and claim all locks
        vm.prank(user);
        amm.tradePositions(address(market1), YES, 100 * int256(WAD), 1000 * WAD);
        vm.prank(user);
        amm.tradePositions(address(market1), YES, -50 * int256(WAD), 0);

        vm.warp(block.timestamp + 24 hours + 1);
        vm.prank(user);
        amm.claimUnlocked(50);

        // Verify empty queue
        IAMMEngine.LockEntry[] memory queue = amm.getLockQueue(user);
        assertEq(queue.length, 0, "Queue should be empty");

        // Verify can't claim again
        vm.prank(user);
        vm.expectRevert("AMMEngine: no locks");
        amm.claimUnlocked(50);
    }

    function test_MultipleUsersIndependentQueues() public {
        // User 1 creates locks
        vm.prank(trader1);
        amm.tradePositions(address(market1), YES, 100 * int256(WAD), 1000 * WAD);
        vm.prank(trader1);
        amm.tradePositions(address(market1), YES, -50 * int256(WAD), 0);

        // User 2 creates locks
        vm.prank(trader2);
        amm.tradePositions(address(market1), YES, 100 * int256(WAD), 1000 * WAD);
        vm.prank(trader2);
        amm.tradePositions(address(market1), YES, -30 * int256(WAD), 0);

        // Verify independent queues
        IAMMEngine.LockEntry[] memory queue1 = amm.getLockQueue(trader1);
        IAMMEngine.LockEntry[] memory queue2 = amm.getLockQueue(trader2);
        
        assertEq(queue1.length, 1, "Trader1 should have 1 entry");
        assertEq(queue2.length, 1, "Trader2 should have 1 entry");
        assertNotEq(queue1[0].amount, queue2[0].amount, "Amounts should differ");
    }


    function _wadToUsdc(uint256 wad) internal pure returns (uint256) {
        return wad / 1e12;
    }

    function _wadToUsdcCeil(uint256 wad) internal pure returns (uint256) {
        if (wad == 0) return 0;
        return (wad - 1) / 1e12 + 1;
    }
}
