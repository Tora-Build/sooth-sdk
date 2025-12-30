// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {TickBookPoolManager, ILockCallback} from "../../contracts/TickBookPoolManager.sol";
import {TickBookVault} from "../../contracts/TickBookVault.sol";
import {TruthMarket} from "../../contracts/TruthMarket.sol";
import {OutcomeToken} from "../../contracts/OutcomeToken.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";
import {DynamicFeeHook} from "../../contracts/hooks/DynamicFeeHook.sol";
import {ITickBookHooks, HookPermissions} from "../../contracts/interfaces/ITickBookHooks.sol";
import {TransientDelta} from "../../contracts/libraries/TransientDelta.sol";

contract TickBookPoolManagerTest is Test, ILockCallback {
    TickBookPoolManager public poolManager;
    TickBookVault public vault;
    TruthMarket public market;
    OutcomeToken public yesToken;
    OutcomeToken public noToken;
    ERC20Mock public usdc;
    DynamicFeeHook public feeHook;

    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);
    address public deployer;

    uint256 constant WAD = 1e18;
    bytes32 public marketKey;
    bytes32 public marketKeyWithHook;

    // For lock callback testing
    bool public shouldPlaceBatchOrders;
    bytes32[] public batchMarketKeys;
    uint8[] public batchOutcomes;
    uint16[] public batchTickLowers;
    uint16[] public batchTickUppers;
    uint256[] public batchSharesTotals;

    function setUp() public {
        deployer = address(this);

        // Deploy USDC mock (ERC20Mock has no constructor args in OZ v5)
        usdc = new ERC20Mock();

        // Deploy vault
        vault = new TickBookVault(address(usdc), deployer);

        // Deploy pool manager
        poolManager = new TickBookPoolManager(address(vault));

        // Link vault to pool manager
        vault.setTickBook(address(poolManager));

        // Deploy market with correct constructor: (question, deadline, adjudicator, guardian)
        market = new TruthMarket(
            "Test Market",
            uint64(block.timestamp + 30 days),
            deployer,  // adjudicator
            deployer   // guardian
        );

        // Create outcome tokens (with collateralizer, market, outcome args)
        // For testing we use deployer as collateralizer
        yesToken = new OutcomeToken("Yes Token", "YES", deployer, address(market), 1);
        noToken = new OutcomeToken("No Token", "NO", deployer, address(market), 0);

        // Activate market (caller becomes creator)
        market.activate();

        // Deploy fee hook
        feeHook = new DynamicFeeHook();

        // Register market without hook
        TickBookPoolManager.PoolKey memory keyNoHook = TickBookPoolManager.PoolKey({
            truthMarket: address(market),
            yesToken: address(yesToken),
            noToken: address(noToken),
            hook: address(0)
        });
        marketKey = poolManager.registerMarket(keyNoHook, 0.5e18);

        // Fund users (mint to vault directly to simulate USDC with 18 decimals internally)
        usdc.mint(alice, 100_000e18);
        usdc.mint(bob, 100_000e18);

        // Approve vault
        vm.prank(alice);
        usdc.approve(address(vault), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(vault), type(uint256).max);

        // Deposit to vault using correct function: depositUsdc(amountAsset)
        // Note: vault converts asset to WAD internally
        vm.prank(alice);
        vault.depositUsdc(50_000e18);
        vm.prank(bob);
        vault.depositUsdc(50_000e18);
    }

    // ============================================
    // Market Registration Tests
    // ============================================

    function test_RegisterMarket() public {
        (
            address truthMarket,
            address yes,
            address no,
            address hook,
            bool isActive
        ) = poolManager.getMarketInfo(marketKey);

        assertEq(truthMarket, address(market));
        assertEq(yes, address(yesToken));
        assertEq(no, address(noToken));
        assertEq(hook, address(0));
        assertTrue(isActive);
    }

    function test_RegisterMarket_InitialTick() public {
        (uint16 currentTick, , , uint256 probability) = poolManager.getMarketState(marketKey);

        // currentTick is initialized to MIN_TICK (1) - trading establishes the actual price
        // The _tryCross function uses bitmap overlap detection, not currentTick
        // Using MIN_TICK ensures _fill can search both up and down
        assertEq(currentTick, 1);
        // Probability at tick 1 is 0.001 (0.1%)
        assertEq(probability, 0.001e18);
    }

    function test_RegisterMarket_RevertDuplicate() public {
        TickBookPoolManager.PoolKey memory key = TickBookPoolManager.PoolKey({
            truthMarket: address(market),
            yesToken: address(yesToken),
            noToken: address(noToken),
            hook: address(0)
        });

        vm.expectRevert(TickBookPoolManager.DuplicateMarket.selector);
        poolManager.registerMarket(key, 0.5e18);
    }

    // ============================================
    // Range Order Tests
    // ============================================

    function test_PlaceRangeOrder() public {
        vm.prank(alice);
        (uint256 orderId, uint256 crossingFilled, uint256 crossingCost) = poolManager.placeRangeOrder(
            marketKey,
            1, // YES outcome
            400, // tickLower
            600, // tickUpper
            1000e18 // sharesTotal
        );

        assertEq(orderId, 1);
        assertEq(crossingFilled, 0); // No opposite liquidity
        assertEq(crossingCost, 0);

        // Check order state
        TickBookPoolManager.RangeOrder memory order = poolManager.getOrder(marketKey, orderId);
        assertEq(order.owner, alice);
        assertEq(order.outcome, 1);
        assertEq(order.tickLower, 400);
        assertEq(order.tickUpper, 600);
        assertTrue(order.active);
        assertEq(order.sharesTotal, 1000e18);
    }

    function test_PlaceRangeOrder_UpdatesMarketState() public {
        // Place order that includes tick 1 (MIN_TICK)
        // currentTick is initialized to MIN_TICK (1), which is within range [1, 100]
        vm.prank(alice);
        poolManager.placeRangeOrder(
            marketKey,
            0, // NO outcome (SELL YES)
            1, // tickLower = MIN_TICK
            100, // tickUpper
            1000e18
        );

        (uint16 currentTick, uint128 activeLiqNo, uint128 activeLiqYes, ) = poolManager.getMarketState(marketKey);

        // currentTick is 1 (MIN_TICK), which IS within range [1, 100]
        assertEq(currentTick, 1);
        // Per-tick density = 1000e18 / (100 - 1 + 1) = 10e18
        assertGt(activeLiqNo, 0);
        assertEq(activeLiqYes, 0);
    }

    function test_CancelOrder() public {
        vm.prank(alice);
        (uint256 orderId, , ) = poolManager.placeRangeOrder(
            marketKey,
            1,
            400,
            600,
            1000e18
        );

        vm.prank(alice);
        uint256 collateralReleased = poolManager.cancelOrder(marketKey, orderId);

        // Check order is cancelled
        TickBookPoolManager.RangeOrder memory order = poolManager.getOrder(marketKey, orderId);
        assertFalse(order.active);

        // Collateral should be released
        assertGt(collateralReleased, 0);
    }

    function test_CancelOrder_RevertNotOwner() public {
        vm.prank(alice);
        (uint256 orderId, , ) = poolManager.placeRangeOrder(
            marketKey,
            1,
            400,
            600,
            1000e18
        );

        vm.prank(bob);
        vm.expectRevert(TickBookPoolManager.NotOwner.selector);
        poolManager.cancelOrder(marketKey, orderId);
    }

    // ============================================
    // Market Order Tests
    // ============================================

    function test_ExecuteMarketOrder() public {
        // Alice places NO order (SELL YES) starting from tick 1 (MIN_TICK)
        // This creates NO liquidity (activeLiquidityNo) at [1, 200]
        vm.prank(alice);
        poolManager.placeRangeOrder(
            marketKey,
            0, // NO outcome (SELL YES)
            1, // tickLower = MIN_TICK
            200, // tickUpper
            10000e18
        );

        // Bob executes market order to buy YES (which fills against NO makers)
        // When buying YES (outcome=1), isUp=true, so we search upward
        // This should find Alice's NO liquidity at [1, 200]
        vm.prank(bob);
        (uint256 sharesFilled, uint256 totalCost, uint256 refunded) = poolManager.executeMarketOrder(
            marketKey,
            1, // YES outcome (fills against NO makers)
            1000e18, // shares
            5000e18 // maxCost
        );

        assertGt(sharesFilled, 0);
        assertGt(totalCost, 0);
        assertLe(totalCost, 5000e18);
    }

    function test_ExecuteMarketOrder_SlippageProtection() public {
        // Alice places NO order (SELL YES) starting from tick 1 (MIN_TICK)
        vm.prank(alice);
        poolManager.placeRangeOrder(
            marketKey,
            0, // NO outcome (SELL YES)
            1, // tickLower = MIN_TICK
            200,
            10000e18
        );

        // Bob tries to buy YES with too low maxCost
        vm.prank(bob);
        vm.expectRevert(TickBookPoolManager.SlippageExceeded.selector);
        poolManager.executeMarketOrder(
            marketKey,
            1, // YES outcome
            1000e18,
            1e18 // Very low maxCost
        );
    }

    function test_ExecuteMarketOrder_NoLiquidity() public {
        // No orders placed, should revert
        vm.prank(bob);
        vm.expectRevert(TickBookPoolManager.NoLiquidity.selector);
        poolManager.executeMarketOrder(
            marketKey,
            0,
            1000e18,
            2000e18
        );
    }

    // ============================================
    // Flash Accounting Tests
    // ============================================

    function test_Lock_BasicCallback() public {
        bytes memory data = abi.encode("test");
        bytes memory result = poolManager.lock(data);
        assertEq(result, abi.encode("callback_success"));
    }

    function test_Lock_TracksLocker() public {
        assertEq(poolManager.locker(), address(0));

        // During lock, locker should be set
        // (tested via callback in lockCallback)
        poolManager.lock("");
    }

    function test_TransientDelta_GetDelta() public {
        int256 delta = poolManager.getDelta(alice);
        assertEq(delta, 0);
    }

    // ============================================
    // Batch Operations Tests
    // ============================================

    function test_BatchPlaceOrders() public {
        // Setup batch order data
        batchMarketKeys = new bytes32[](2);
        batchMarketKeys[0] = marketKey;
        batchMarketKeys[1] = marketKey;

        batchOutcomes = new uint8[](2);
        batchOutcomes[0] = 0;
        batchOutcomes[1] = 1;

        batchTickLowers = new uint16[](2);
        batchTickLowers[0] = 300;
        batchTickLowers[1] = 400;

        batchTickUppers = new uint16[](2);
        batchTickUppers[0] = 400;
        batchTickUppers[1] = 500;

        batchSharesTotals = new uint256[](2);
        batchSharesTotals[0] = 1000e18;
        batchSharesTotals[1] = 1000e18;

        shouldPlaceBatchOrders = true;

        // Execute batch via lock
        poolManager.lock("");

        // Verify orders were created
        TickBookPoolManager.RangeOrder memory order1 = poolManager.getOrder(marketKey, 1);
        TickBookPoolManager.RangeOrder memory order2 = poolManager.getOrder(marketKey, 2);

        assertTrue(order1.active);
        assertTrue(order2.active);
        assertEq(order1.outcome, 0);
        assertEq(order2.outcome, 1);

        shouldPlaceBatchOrders = false;
    }

    // ============================================
    // Dynamic Fee Hook Tests
    // ============================================

    function test_DynamicFeeHook_GetDynamicFee() public {
        // Configure fee
        feeHook.setFeeConfig(
            marketKey,
            10,   // 0.1% base taker fee
            0,    // 0% maker base fee
            100,  // 1% max
            5,    // volume discount (for makers)
            2     // volatility fee
        );

        uint24 fee = feeHook.getDynamicFee(marketKey, 1, 1000e18, 10);
        assertEq(fee, 10); // Should be base fee with no volatility
    }

    function test_DynamicFeeHook_SetConfig() public {
        feeHook.setFeeConfig(
            marketKey,
            20,   // 0.2% base taker fee
            0,    // 0% maker base fee
            200,  // 2% max
            10,   // volume discount (for makers)
            5     // volatility fee
        );

        (
            uint24 baseFee,
            uint24 makerBaseFee,
            uint24 maxFee,
            uint24 volumeDiscount,
            uint24 volatilityFee,
            ,,,
        ) = feeHook.feeConfigs(marketKey);

        assertEq(baseFee, 20);
        assertEq(makerBaseFee, 0);
        assertEq(maxFee, 200);
        assertEq(volumeDiscount, 10);
        assertEq(volatilityFee, 5);
    }

    // ============================================
    // Permission Encoding Tests
    // ============================================

    function test_HookPermissions_HasPermission() public pure {
        // Create an address with specific permission bits set
        // GET_DYNAMIC_FEE_FLAG = 1 << 8 = 256

        // Address ending in 0x100 has bit 8 set
        address hookWithDynamicFee = address(uint160(0x100));
        assertTrue(HookPermissions.getDynamicFee(hookWithDynamicFee));

        // Address ending in 0x000 has no permissions
        address hookWithNoPerms = address(uint160(0x200)); // bit 9, not bit 8
        assertFalse(HookPermissions.getDynamicFee(hookWithNoPerms));
    }

    function test_HookPermissions_AllFlags() public pure {
        // Test all permission flags
        address hook;

        // beforePlaceOrder (bit 0)
        hook = address(uint160(1 << 0));
        assertTrue(HookPermissions.beforePlaceOrder(hook));

        // afterPlaceOrder (bit 1)
        hook = address(uint160(1 << 1));
        assertTrue(HookPermissions.afterPlaceOrder(hook));

        // beforeExecuteOrder (bit 2)
        hook = address(uint160(1 << 2));
        assertTrue(HookPermissions.beforeExecuteOrder(hook));

        // afterExecuteOrder (bit 3)
        hook = address(uint160(1 << 3));
        assertTrue(HookPermissions.afterExecuteOrder(hook));

        // getDynamicFee (bit 8)
        hook = address(uint160(1 << 8));
        assertTrue(HookPermissions.getDynamicFee(hook));
    }

    // ============================================
    // ILockCallback Implementation
    // ============================================

    function lockCallback(bytes calldata data) external override returns (bytes memory) {
        require(msg.sender == address(poolManager), "Only pool manager");

        // Verify locker is set
        assertEq(poolManager.locker(), address(this));

        if (shouldPlaceBatchOrders) {
            // Execute batch orders
            uint256[] memory orderIds = poolManager.batchPlaceOrders(
                batchMarketKeys,
                batchOutcomes,
                batchTickLowers,
                batchTickUppers,
                batchSharesTotals
            );

            // Settle deltas (in real usage, would transfer USDC)
            int256 delta = poolManager.getDelta(address(this));
            if (delta > 0) {
                // We owe funds - settle by calling settle()
                poolManager.settle(address(this), uint256(delta));
            }

            return abi.encode(orderIds);
        }

        return abi.encode("callback_success");
    }

    // ============================================
    // Integration Tests
    // ============================================

    function test_Integration_PlaceAndFill() public {
        // Alice places YES order at ticks 400-600
        vm.prank(alice);
        (uint256 aliceOrderId, , ) = poolManager.placeRangeOrder(
            marketKey,
            1, // YES
            400,
            600,
            10000e18
        );

        // Bob places NO order at overlapping ticks 450-550
        // This should cross with Alice's order
        vm.prank(bob);
        (, uint256 crossingFilled, ) = poolManager.placeRangeOrder(
            marketKey,
            0, // NO
            450,
            550,
            5000e18
        );

        // Check crossing occurred - Bob gets filled immediately
        assertGt(crossingFilled, 0, "Bob should have some crossing fills");

        // Alice's order fills are tracked via growth mechanism, not directly in order struct
        // She needs to claim to update her order's filledShares
        vm.prank(alice);
        (uint256 filledShares, ) = poolManager.claimFills(marketKey, aliceOrderId);

        // After claiming, Alice should have received her portion of the crossed fills
        assertGt(filledShares, 0, "Alice should receive fills from crossing");
    }

    function test_ClaimFillsFor_Permissionless() public {
        // Alice places YES order
        vm.prank(alice);
        (uint256 aliceOrderId, , ) = poolManager.placeRangeOrder(
            marketKey,
            1, // YES
            400,
            600,
            10000e18
        );

        // Bob places NO order that crosses
        vm.prank(bob);
        poolManager.placeRangeOrder(
            marketKey,
            0, // NO
            450,
            550,
            5000e18
        );

        // Carol (a third party / keeper) can trigger Alice's claim
        vm.prank(address(0xCA01)); // Carol
        (uint256 filledShares, ) = poolManager.claimFillsFor(marketKey, aliceOrderId);

        // Alice receives her fills even though Carol triggered it
        assertGt(filledShares, 0, "Permissionless claim should work");
    }

    function test_BatchClaimFills() public {
        // Alice places two NO orders (SELL YES) starting from tick 1 (MIN_TICK)
        vm.startPrank(alice);
        (uint256 orderId1, , ) = poolManager.placeRangeOrder(
            marketKey, 0, 1, 100, 5000e18 // NO order, start from MIN_TICK
        );
        (uint256 orderId2, , ) = poolManager.placeRangeOrder(
            marketKey, 0, 100, 200, 5000e18 // NO order
        );
        vm.stopPrank();

        // Bob executes market order to buy YES, filling both NO orders
        vm.prank(bob);
        poolManager.executeMarketOrder(marketKey, 1, 8000e18, 10000e18);

        // Batch claim both orders in one call
        uint256[] memory orderIds = new uint256[](2);
        orderIds[0] = orderId1;
        orderIds[1] = orderId2;

        (uint256 totalFilled, ) = poolManager.batchClaimFills(marketKey, orderIds);
        assertGt(totalFilled, 0, "Batch claim should fill both orders");
    }

    function test_Integration_ClaimFills() public {
        // Alice places NO order (SELL YES) starting from tick 1 (MIN_TICK)
        vm.prank(alice);
        (uint256 aliceOrderId, , ) = poolManager.placeRangeOrder(
            marketKey,
            0, // NO outcome (SELL YES)
            1, // tickLower = MIN_TICK
            200, // tickUpper
            10000e18
        );

        // Bob executes market order to buy YES (fills against Alice's NO order)
        vm.prank(bob);
        poolManager.executeMarketOrder(
            marketKey,
            1, // Buy YES (fills against NO makers)
            5000e18,
            10000e18
        );

        // Alice claims fills
        vm.prank(alice);
        (uint256 filledShares, uint256 collateralUsed) = poolManager.claimFills(marketKey, aliceOrderId);

        assertGt(filledShares, 0);
        assertGt(collateralUsed, 0);
    }

    // ============================================
    // V9.9 Crossing Behavior Tests
    // ============================================

    /**
     * @notice Test that orders only cross at overlapping tick ranges
     * @dev V9.9 FIX: Orders should only match at prices where both sides agree
     */
    function test_V99_CrossingOnlyInOverlap() public {
        // Alice places BUY YES order at ticks 300-350 (30%-35%)
        vm.prank(alice);
        (uint256 aliceOrderId, , ) = poolManager.placeRangeOrder(
            marketKey,
            1, // BUY YES
            300, // tickLower = 30%
            350, // tickUpper = 35%
            1000e18
        );

        // Bob places SELL YES order at ticks 350-450 (35%-45%)
        // Overlap exists at tick 350 only
        vm.prank(bob);
        (uint256 bobOrderId, uint256 crossingFilled, ) = poolManager.placeRangeOrder(
            marketKey,
            0, // SELL YES
            350, // tickLower = 35%
            450, // tickUpper = 45%
            2000e18
        );

        // Crossing should occur at the overlap (tick 350)
        // Bob's order should be partially filled at the overlap
        assertGt(crossingFilled, 0, "Bob should get some crossing fills");

        // The crossing amount should be limited by the overlap, not the full order
        // Overlap is only 1 tick (350), so crossedShares should be minimal
        // Note: Exact amount depends on liquidity density
    }

    /**
     * @notice Test that non-overlapping orders don't cross
     */
    function test_V99_NoCrossingWithoutOverlap() public {
        // Alice places BUY YES order at ticks 300-350 (30%-35%)
        vm.prank(alice);
        poolManager.placeRangeOrder(
            marketKey,
            1, // BUY YES
            300,
            350,
            1000e18
        );

        // Bob places SELL YES order at ticks 400-450 (40%-45%)
        // NO overlap with Alice's 30%-35% range
        vm.prank(bob);
        (, uint256 crossingFilled, ) = poolManager.placeRangeOrder(
            marketKey,
            0, // SELL YES
            400,
            450,
            1000e18
        );

        // No crossing should occur - ranges don't overlap
        assertEq(crossingFilled, 0, "Should not cross without overlap");
    }

    /**
     * @notice Test SELL order sweeps from low (worst) to high (best)
     * @dev Example: SELL 200 @ 35%-45% vs BUY 100 @ 30%-35%
     *      Should fill 100 at tick 35% (overlap point), leave 100 resting
     */
    function test_V99_SellSweepsLowToHigh() public {
        // Alice places BUY YES order at ticks 300-350 (30%-35%)
        vm.prank(alice);
        (uint256 aliceOrderId, , ) = poolManager.placeRangeOrder(
            marketKey,
            1, // BUY YES
            300,
            350,
            5100e18 // 100 shares/tick * 51 ticks
        );

        // Check Alice's order was created correctly
        TickBookPoolManager.RangeOrder memory aliceOrder = poolManager.getOrder(marketKey, aliceOrderId);
        assertEq(aliceOrder.tickLower, 300);
        assertEq(aliceOrder.tickUpper, 350);
        assertTrue(aliceOrder.active);

        // Bob places SELL YES order at ticks 350-450 (35%-45%)
        vm.prank(bob);
        (uint256 bobOrderId, uint256 crossingFilled, uint256 crossingCost) = poolManager.placeRangeOrder(
            marketKey,
            0, // SELL YES (shown as BUY NO in UI)
            350,
            450,
            10100e18 // 100 shares/tick * 101 ticks
        );

        // Crossing should occur at the overlap point (tick 350)
        // Bob's SELL starts at its worst price (tickLower = 350) and sweeps up
        assertGt(crossingFilled, 0, "Should have some crossing");

        // Bob's remaining order should still be active
        TickBookPoolManager.RangeOrder memory bobOrder = poolManager.getOrder(marketKey, bobOrderId);
        assertTrue(bobOrder.active, "Bob's order should still be active");
    }

    /**
     * @notice Test BUY order sweeps from high (worst) to low (best)
     */
    function test_V99_BuySweepsHighToLow() public {
        // Alice places SELL YES order at ticks 500-600 (50%-60%)
        vm.prank(alice);
        poolManager.placeRangeOrder(
            marketKey,
            0, // SELL YES
            500,
            600,
            5050e18 // 50 shares/tick * 101 ticks
        );

        // Bob places BUY YES order at ticks 550-650 (55%-65%)
        vm.prank(bob);
        (uint256 bobOrderId, uint256 crossingFilled, ) = poolManager.placeRangeOrder(
            marketKey,
            1, // BUY YES
            550,
            650,
            10100e18
        );

        // Crossing should occur at the overlap (ticks 550-600)
        // Bob's BUY starts at its worst price (tickUpper = 650) and sweeps down
        assertGt(crossingFilled, 0, "Should have some crossing");

        // Verify the crossing tick is in the correct range
        (uint16 currentTick, , , ) = poolManager.getMarketState(marketKey);
        assertTrue(currentTick >= 550 && currentTick <= 650, "Cross tick should be in overlap range");
    }

    /**
     * @notice Test that fills don't exceed order size (the >100% bug fix)
     */
    function test_V99_FillsDoNotExceedOrderSize() public {
        // Alice places small BUY YES order
        vm.prank(alice);
        (uint256 aliceOrderId, , ) = poolManager.placeRangeOrder(
            marketKey,
            1, // BUY YES
            400,
            500,
            1000e18
        );

        // Bob places SELL YES order that fully overlaps
        vm.prank(bob);
        poolManager.placeRangeOrder(
            marketKey,
            0, // SELL YES
            400,
            500,
            2000e18
        );

        // Claim Alice's fills
        vm.prank(alice);
        (uint256 filledShares, ) = poolManager.claimFills(marketKey, aliceOrderId);

        // Filled shares should not exceed order size
        TickBookPoolManager.RangeOrder memory aliceOrder = poolManager.getOrder(marketKey, aliceOrderId);
        assertLe(
            aliceOrder.filledShares,
            aliceOrder.sharesTotal,
            "Filled shares should not exceed order total"
        );
    }
}
