// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {TickBookPoolManager} from "@core/TickBookPoolManager.sol";
import {TickBookVault} from "@core/TickBookVault.sol";
import {TruthMarket} from "@core/TruthMarket.sol";
import {OutcomeToken} from "@core/OutcomeToken.sol";
import {ProtocolConfig} from "@core/ProtocolConfig.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";

/**
 * @title SpotSellTickSpaceTest
 * @notice Tests for V10.4 spot sell tick space conversion bug fix
 * @dev Verifies that NO spot sells correctly cross with NO range orders
 *      despite the overlap being calculated in YES-equivalent tick space
 * 
 * Bug: _fillSpotLiquidity iterated through YES-equivalent ticks (500-999)
 *      but NO spot sells are stored at native NO ticks (150-152)
 *      
 * Fix: Convert overlap range to native tick space before iteration:
 *      - For NO spot sells: iterLow = 1000 - overlapHigh, iterHigh = 1000 - overlapLow
 */
contract SpotSellTickSpaceTest is Test {
    TickBookPoolManager public poolManager;
    TickBookVault public vault;
    ProtocolConfig public protocolConfig;
    TruthMarket public market;
    OutcomeToken public yesToken;
    OutcomeToken public noToken;
    ERC20Mock public usdc;

    address public alice = address(0xA11CE); // Has NO shares to sell
    address public bob = address(0xB0B);     // Places NO range order

    bytes32 public marketKey;

    function setUp() public {
        usdc = new ERC20Mock();
        protocolConfig = new ProtocolConfig(address(this));
        vault = new TickBookVault(address(usdc), address(protocolConfig), address(this));
        poolManager = new TickBookPoolManager(address(vault), address(protocolConfig));
        vault.setTickBook(address(poolManager));

        market = new TruthMarket(
            "Test Market",
            uint64(block.timestamp),
            uint64(block.timestamp + 30 days),
            address(this),
            address(protocolConfig),
            address(this)
        );
        yesToken = new OutcomeToken("Yes Token", "YES", address(this), address(market), 1);
        noToken = new OutcomeToken("No Token", "NO", address(this), address(market), 0);

        
        // Register market at 50% initial probability
        marketKey = poolManager.registerMarket(
            address(market),
            address(yesToken),
            address(noToken),
            0.5e18,
            address(0)
        );

        // Fund Alice with NO shares (she has NO tokens to sell)
        vm.prank(address(poolManager));
        vault.creditOutcome(address(market), alice, 0, 1000e18); // 1000 NO shares

        // Fund Bob with USDC for placing orders
        usdc.mint(bob, 100_000e18);
        vm.prank(bob);
        usdc.approve(address(vault), type(uint256).max);
        vm.prank(bob);
        vault.depositUsdc(50_000e18);
    }

    /**
     * @notice Test that NO spot sells at low ticks cross with NO range orders
     * @dev This is the main regression test for the tick space conversion bug
     *      
     *      Scenario:
     *      - Alice places NO spot sell at ticks 150-160 (15.0-16.0% NO price)
     *      - Bob places NO range order at ticks 1-500 (willing to pay 0.1-50% for NO)
     *      
     *      Expected: Bob's order should cross with Alice's spot sell because
     *      Bob is willing to pay up to 50% for NO, and Alice is selling at ~15.5%
     *      
     *      Bug: The overlap was calculated as YES ticks 500-999, and iteration
     *      looked for NO spot sells at those ticks, missing spot sells at 150-160
     */
    function test_NOSpotSell_CrossesWithNORangeOrder() public {
        // 1. Alice places NO spot sell at ticks 150-160 (selling NO at 15.0-16.0%)
        // Max range is 50 ticks, so 11 ticks is fine
        vm.prank(alice);
        uint256 sellId = poolManager.placeSpotSell(
            marketKey,
            0,          // NO outcome
            100e18,     // 100 NO shares
            150,        // tickLower
            160         // tickUpper (11 tick range)
        );
        assertGt(sellId, 0, "Spot sell should be created");
        
        // Verify spot sell is active
        TickBookPoolManager.SpotSellOrder memory spotBefore = poolManager.getSpotSellOrder(marketKey, sellId);
        assertTrue(spotBefore.active, "Spot sell should be active");
        assertEq(spotBefore.sharesFilled, 0, "Spot sell should have 0 filled initially");

        // 2. Bob places NO range order at ticks 1-500 (buying NO at 0.1-50%)
        // This should cross with Alice's spot sell because:
        // - Bob willing to pay up to 50% for NO
        // - Alice selling NO at 15.0-16.0%
        vm.prank(bob);
        (uint256 orderId, uint256 filledShares, , ) = poolManager.placeOrder(
            marketKey,
            0,          // NO outcome
            500e18,     // 500 NO shares wanted
            1,          // tickLower
            500,        // tickUpper
            500e18      // maxCost (increased for fees)
        );

        // 3. Verify crossing occurred
        assertGt(filledShares, 0, "NO range order SHOULD cross with NO spot sell");
        
        // Check spot sell was filled
        TickBookPoolManager.SpotSellOrder memory spotAfter = poolManager.getSpotSellOrder(marketKey, sellId);
        assertGt(spotAfter.sharesFilled, 0, "Spot sell should have been partially or fully filled");
        
        // Bob should have received NO shares
        (uint256 bobYes, uint256 bobNo) = vault.getInternalOutcomes(address(market), bob);
        assertGt(bobNo, 0, "Bob should have received NO shares from crossing");
    }

    /**
     * @notice Test with spot sell at higher NO tick (still within range)
     */
    function test_NOSpotSell_HigherTick_StillCrosses() public {
        // Alice places NO spot sell at ticks 400-430 (40-43% NO price)
        // Max range is 50 ticks, so 31 ticks is fine
        vm.prank(alice);
        uint256 sellId = poolManager.placeSpotSell(
            marketKey,
            0,          // NO outcome
            200e18,     // 200 NO shares
            400,        // tickLower
            430         // tickUpper (31 tick range)
        );
        
        // Bob places NO range order at ticks 1-500 (willing to pay up to 50%)
        vm.prank(bob);
        (uint256 orderId, uint256 filledShares, , ) = poolManager.placeOrder(
            marketKey,
            0,          // NO
            1000e18,    // shares
            1,          // tickLower
            500,        // tickUpper
            2000e18     // maxCost (generous buffer for collateral + fees)
        );

        // Should cross - spot sell at 400-430 is within buyer's range of 1-500
        assertGt(filledShares, 0, "Should cross with spot sell at ticks 400-430");
        
        TickBookPoolManager.SpotSellOrder memory spot = poolManager.getSpotSellOrder(marketKey, sellId);
        assertGt(spot.sharesFilled, 0, "Spot sell at 400-430 should be filled");
    }

    /**
     * @notice Test that YES spot sells still work correctly (no regression)
     */
    function test_YESSpotSell_StillWorks() public {
        // Fund Alice with YES shares instead
        vm.prank(address(poolManager));
        vault.creditOutcome(address(market), alice, 1, 1000e18);

        // Alice places YES spot sell at tick 600 (60% YES price)
        vm.prank(alice);
        uint256 sellId = poolManager.placeSpotSell(
            marketKey,
            1,          // YES outcome
            100e18,     // 100 YES shares
            600,        // tickLower
            600         // tickUpper
        );

        // Bob places YES range order at ticks 500-700 (willing to pay 50-70%)
        vm.prank(bob);
        (uint256 orderId, uint256 filledShares, , ) = poolManager.placeOrder(
            marketKey,
            1,          // YES
            500e18,     // shares
            500,        // tickLower
            700,        // tickUpper
            400e18      // maxCost
        );

        // Should cross
        assertGt(filledShares, 0, "YES order should cross with YES spot sell");
        
        TickBookPoolManager.SpotSellOrder memory spot = poolManager.getSpotSellOrder(marketKey, sellId);
        assertGt(spot.sharesFilled, 0, "YES spot sell should be filled");
    }

    /**
     * @notice Test that NO spot sell outside buyer's range does NOT cross
     */
    function test_NOSpotSell_OutsideRange_DoesNotCross() public {
        // Alice places NO spot sell at ticks 600-620 (60-62% NO price)
        // Max range is 50 ticks, so 21 ticks is fine
        vm.prank(alice);
        uint256 sellId = poolManager.placeSpotSell(
            marketKey,
            0,          // NO outcome
            100e18,     // 100 NO shares
            600,        // tickLower
            620         // tickUpper (21 tick range)
        );

        // Bob places NO range order at ticks 1-500 (willing to pay only up to 50%)
        vm.prank(bob);
        (uint256 orderId, uint256 filledShares, , ) = poolManager.placeOrder(
            marketKey,
            0,          // NO
            500e18,     // shares
            1,          // tickLower
            500,        // tickUpper
            1000e18     // maxCost (generous buffer for collateral)
        );

        // Should NOT cross - spot sell at 600-620 is above buyer's max of 500
        // The spot sell remains unfilled
        TickBookPoolManager.SpotSellOrder memory spot = poolManager.getSpotSellOrder(marketKey, sellId);
        assertEq(spot.sharesFilled, 0, "Spot sell outside range should NOT be filled");
    }

    /**
     * @notice Test multiple NO spot sells at different ticks
     */
    function test_MultipleNOSpotSells_AllWithinRange() public {
        // Fund Alice with more NO
        vm.prank(address(poolManager));
        vault.creditOutcome(address(market), alice, 0, 2000e18);

        // Alice places multiple spot sells at different ticks
        // Max range is 50 ticks each
        vm.startPrank(alice);
        uint256 sellId1 = poolManager.placeSpotSell(marketKey, 0, 50e18, 100, 110);   // 10-11% (11 ticks)
        uint256 sellId2 = poolManager.placeSpotSell(marketKey, 0, 75e18, 200, 220);   // 20-22% (21 ticks)
        uint256 sellId3 = poolManager.placeSpotSell(marketKey, 0, 100e18, 400, 430);  // 40-43% (31 ticks)
        vm.stopPrank();

        // Bob places wide NO range order
        vm.prank(bob);
        (uint256 orderId, uint256 filledShares, , ) = poolManager.placeOrder(
            marketKey,
            0,          // NO
            1000e18,    // shares
            1,          // tickLower
            500,        // tickUpper
            2000e18     // maxCost (generous buffer for collateral + fees)
        );

        // All spot sells should be crossed
        assertGt(filledShares, 0, "Should cross with multiple spot sells");
        
        TickBookPoolManager.SpotSellOrder memory spot1 = poolManager.getSpotSellOrder(marketKey, sellId1);
        TickBookPoolManager.SpotSellOrder memory spot2 = poolManager.getSpotSellOrder(marketKey, sellId2);
        TickBookPoolManager.SpotSellOrder memory spot3 = poolManager.getSpotSellOrder(marketKey, sellId3);
        
        assertGt(spot1.sharesFilled, 0, "Spot sell 1 should be filled");
        assertGt(spot2.sharesFilled, 0, "Spot sell 2 should be filled");
        assertGt(spot3.sharesFilled, 0, "Spot sell 3 should be filled");
    }

    /**
     * @notice Regression: multiple spot sells at the same ticks should not revert while crossing
     */
    function test_MultipleSpotSellsSameTick_NoRevert() public {
        // Fund Alice with more NO for two overlapping spot sells
        vm.prank(address(poolManager));
        vault.creditOutcome(address(market), alice, 0, 500e18);

        vm.startPrank(alice);
        uint256 sellId1 = poolManager.placeSpotSell(marketKey, 0, 100e18, 150, 160);
        uint256 sellId2 = poolManager.placeSpotSell(marketKey, 0, 100e18, 150, 160);
        vm.stopPrank();

        // Single order crosses both spot sells in one transaction
        vm.prank(bob);
        (, uint256 filledShares, , ) = poolManager.placeOrder(
            marketKey,
            0,          // NO
            300e18,     // shares
            1,          // tickLower
            500,        // tickUpper
            50_000e18   // maxCost
        );

        assertGt(filledShares, 0, "Should cross overlapping spot sells");

        TickBookPoolManager.SpotSellOrder memory spot1 = poolManager.getSpotSellOrder(marketKey, sellId1);
        TickBookPoolManager.SpotSellOrder memory spot2 = poolManager.getSpotSellOrder(marketKey, sellId2);

        assertGt(spot1.sharesFilled, 0, "Spot sell 1 should be filled");
        assertGt(spot2.sharesFilled, 0, "Spot sell 2 should be filled");
    }

    /**
     * @notice Regression: multiple YES spot sells at the same ticks should not revert while crossing
     */
    function test_MultipleYESSpotSellsSameTick_NoRevert() public {
        // Fund Alice with YES for two overlapping spot sells
        vm.prank(address(poolManager));
        vault.creditOutcome(address(market), alice, 1, 500e18);

        vm.startPrank(alice);
        uint256 sellId1 = poolManager.placeSpotSell(marketKey, 1, 100e18, 840, 850);
        uint256 sellId2 = poolManager.placeSpotSell(marketKey, 1, 100e18, 840, 850);
        vm.stopPrank();

        // Single order crosses both spot sells in one transaction
        vm.prank(bob);
        (, uint256 filledShares, , ) = poolManager.placeOrder(
            marketKey,
            1,          // YES
            300e18,     // shares
            800,        // tickLower
            900,        // tickUpper
            50_000e18   // maxCost
        );

        assertGt(filledShares, 0, "Should cross overlapping YES spot sells");

        TickBookPoolManager.SpotSellOrder memory spot1 = poolManager.getSpotSellOrder(marketKey, sellId1);
        TickBookPoolManager.SpotSellOrder memory spot2 = poolManager.getSpotSellOrder(marketKey, sellId2);

        assertGt(spot1.sharesFilled, 0, "YES spot sell 1 should be filled");
        assertGt(spot2.sharesFilled, 0, "YES spot sell 2 should be filled");
    }

    /**
     * @notice Fuzz test: NO spot sell at any tick within buyer's range should cross
     */
    function testFuzz_NOSpotSell_WithinRange_AlwaysCrosses(
        uint16 spotTickLower,
        uint16 spotTickUpper,
        uint16 buyerTickUpper
    ) public {
        // Bound inputs to valid ranges
        // Max spot range is 50 ticks
        spotTickLower = uint16(bound(spotTickLower, 1, 400));
        spotTickUpper = uint16(bound(spotTickUpper, spotTickLower, spotTickLower + 49)); // Max 50 tick range
        buyerTickUpper = uint16(bound(buyerTickUpper, spotTickUpper + 1, 999));

        // Alice places NO spot sell
        vm.prank(alice);
        uint256 sellId = poolManager.placeSpotSell(
            marketKey,
            0,
            100e18,
            spotTickLower,
            spotTickUpper
        );

        // Bob places NO range order that covers the spot sell
        vm.prank(bob);
        (uint256 orderId, uint256 filledShares, , ) = poolManager.placeOrder(
            marketKey,
            0,
            200e18,
            1,
            buyerTickUpper,
            1000e18  // generous max cost
        );

        // Should always cross when spot sell is within buyer's range
        TickBookPoolManager.SpotSellOrder memory spot = poolManager.getSpotSellOrder(marketKey, sellId);
        assertGt(spot.sharesFilled, 0, "Spot sell within range should ALWAYS be filled");
    }
}
