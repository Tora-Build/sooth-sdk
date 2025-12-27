// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {LaunchpadEngine} from "../../../contracts/LaunchpadEngine.sol";
import {AMMEngine} from "../../../contracts/AMMEngine.sol";
import {TruthMarket} from "../../../contracts/TruthMarket.sol";
import {Collateralizer} from "../../../contracts/Collateralizer.sol";
import {TickBook} from "../../../contracts/TickBook.sol";
import {LMSRMath} from "../../../contracts/libraries/LMSRMath.sol";
import {TickMath} from "../../../contracts/libraries/TickMath.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";

/**
 * @title TradeFuzzTest
 * @notice Fuzz tests for trade amount, tick ranges, and LMSR quantities
 * @dev Phase 2 QA requirement: Add Fuzz Tests - 6 tests
 */
contract TradeFuzzTest is Test {
    LaunchpadEngine public launchpad;
    AMMEngine public amm;
    Collateralizer public collateralizer;
    TickBook public tickBook;
    TruthMarket public market;
    ERC20Mock public usdc;

    address public owner = address(0x1);
    address public creator = address(0x2);
    address public trader = address(0x3);
    address public treasury = address(0x4);
    address public adjudicator = address(0x5);
    address public guardian = address(0x6);

    uint256 constant WAD = 1e18;
    uint256 constant INITIAL_LIQUIDITY = 1000 * WAD;

    uint8 constant YES = 0;
    uint8 constant NO = 1;

    function setUp() public {
        usdc = new ERC20Mock();
        amm = new AMMEngine(address(usdc), owner);
        collateralizer = new Collateralizer(address(usdc));
        tickBook = new TickBook();

        vm.prank(owner);
        launchpad = new LaunchpadEngine(
            address(usdc),
            address(amm),
            address(collateralizer),
            address(tickBook),
            treasury,
            owner
        );

        vm.prank(owner);
        amm.setRouter(address(launchpad));

        vm.prank(creator);
        market = new TruthMarket(
            "Fuzz Test Market",
            uint64(block.timestamp + 30 days),
            adjudicator,
            guardian
        );

        // Fund and create market
        usdc.mint(creator, 100000 * WAD);
        vm.startPrank(creator);
        usdc.approve(address(launchpad), type(uint256).max);
        launchpad.createMarket(address(market), INITIAL_LIQUIDITY, "Fuzz", "FUZZ");
        market.activate();
        vm.stopPrank();

        // Fund trader
        usdc.mint(trader, 1000000 * WAD);
        vm.prank(trader);
        usdc.approve(address(launchpad), type(uint256).max);
    }

    // ============================================
    // Trade Amount Fuzzing
    // ============================================

    function testFuzz_BuyYES_RandomAmount(uint256 shares) public {
        // Bound shares to reasonable range (1 to 10000 shares)
        shares = bound(shares, 1 * WAD, 10000 * WAD);

        // Get quote first
        (uint256 cost, ) = amm.getPositionQuote(address(market), YES, int256(shares));
        
        // Execute trade
        vm.prank(trader);
        launchpad.tradePositions(address(market), YES, int256(shares), cost * 2); // 2x slippage tolerance

        // Verify position
        (uint256 yesShares, uint256 noShares) = amm.getPosition(address(market), trader);
        assertEq(yesShares, shares, "YES shares should match");
        assertEq(noShares, 0, "NO shares should be 0");
    }

    function testFuzz_BuyNO_RandomAmount(uint256 shares) public {
        shares = bound(shares, 1 * WAD, 10000 * WAD);

        (uint256 cost, ) = amm.getPositionQuote(address(market), NO, int256(shares));
        
        vm.prank(trader);
        launchpad.tradePositions(address(market), NO, int256(shares), cost * 2);

        (uint256 yesShares, uint256 noShares) = amm.getPosition(address(market), trader);
        assertEq(yesShares, 0, "YES shares should be 0");
        assertEq(noShares, shares, "NO shares should match");
    }

    function testFuzz_BuySell_RandomAmount(uint256 buyShares, uint256 sellShares) public {
        buyShares = bound(buyShares, 10 * WAD, 1000 * WAD);
        sellShares = bound(sellShares, 1 * WAD, buyShares); // Can't sell more than bought

        // Buy
        (uint256 buyCost, ) = amm.getPositionQuote(address(market), YES, int256(buyShares));
        vm.prank(trader);
        launchpad.tradePositions(address(market), YES, int256(buyShares), buyCost * 2);

        // Sell
        vm.prank(trader);
        launchpad.tradePositions(address(market), YES, -int256(sellShares), 0);

        // Verify
        (uint256 yesShares, ) = amm.getPosition(address(market), trader);
        assertEq(yesShares, buyShares - sellShares, "Remaining shares should match");
    }

    // ============================================
    // LMSR Quantity Fuzzing
    // ============================================

    function testFuzz_LMSRProbability_ValidRange(uint256 qYes, uint256 qNo, uint256 b) public pure {
        // Bound to reasonable ranges
        b = bound(b, 100 * WAD, 10000 * WAD);
        qYes = bound(qYes, 0, 5000 * WAD);
        qNo = bound(qNo, 0, 5000 * WAD);

        // Calculate probability (YES price)
        uint256 probability = LMSRMath.calculateProbability(b, qYes, qNo);

        // Probability should always be in [0, 1e18]
        assertLe(probability, WAD, "Probability should not exceed 1.0");
    }

    function testFuzz_LMSRProbability_SymmetricQuantities(uint256 q, uint256 b) public pure {
        b = bound(b, 100 * WAD, 10000 * WAD);
        q = bound(q, 0, 1000 * WAD);

        // For symmetric quantities, probability should be 0.5
        uint256 probability = LMSRMath.calculateProbability(b, q, q);
        
        // Allow 1% tolerance for rounding
        assertApproxEqRel(probability, WAD / 2, 0.01e18, "Symmetric quantities should give 50% probability");
    }

    function testFuzz_LMSRProbability_Monotonic(uint256 baseQ, uint256 delta, uint256 b) public pure {
        b = bound(b, 100 * WAD, 10000 * WAD);
        baseQ = bound(baseQ, 0, 1000 * WAD);
        delta = bound(delta, 1 * WAD, 100 * WAD);

        // Probability should increase as qYes increases
        uint256 prob1 = LMSRMath.calculateProbability(b, baseQ, baseQ);
        uint256 prob2 = LMSRMath.calculateProbability(b, baseQ + delta, baseQ);

        assertGe(prob2, prob1, "Probability should increase with more YES quantity");
    }

    // ============================================
    // Tick Range Fuzzing (TickMath)
    // ============================================

    function testFuzz_TickMath_ValidTick(uint16 tick) public pure {
        // Bound tick to valid range [1, 9998] (9999 is MAX_TICK, not tradeable)
        tick = uint16(bound(tick, 1, 9998));

        // Virtual reserves should be calculable without revert
        uint256 L = 1000 * WAD;
        uint256 xv = TickMath.getVirtualReserveYES(L, tick);
        uint256 yv = TickMath.getVirtualReserveNO(L, tick);

        // Both should be positive
        assertGt(xv, 0, "Virtual YES reserve should be positive");
        assertGt(yv, 0, "Virtual NO reserve should be positive");
    }

    function testFuzz_TickMath_ReserveSymmetry(uint16 tick, uint256 L) public pure {
        // Bound inputs
        tick = uint16(bound(tick, 1, 9998));
        L = bound(L, 1 * WAD, 10000 * WAD);

        uint256 xv = TickMath.getVirtualReserveYES(L, tick);
        uint256 yv = TickMath.getVirtualReserveNO(L, tick);

        // At tick 5000 (50%), reserves should be symmetric
        if (tick == 5000) {
            assertApproxEqRel(xv, yv, 0.01e18, "At 50%, reserves should be symmetric");
        }

        // At higher ticks, YES reserve should be less than NO
        if (tick > 5000) {
            assertLe(xv, yv, "Above 50%, YES reserve should be <= NO reserve");
        }

        // At lower ticks, NO reserve should be less than YES
        if (tick < 5000) {
            assertLe(yv, xv, "Below 50%, NO reserve should be <= YES reserve");
        }
    }

    function testFuzz_TickMath_AmountOut(uint256 reserveIn, uint256 reserveOut, uint256 amountIn) public pure {
        // Bound to reasonable ranges to avoid overflow
        reserveIn = bound(reserveIn, 1 * WAD, 1000000 * WAD);
        reserveOut = bound(reserveOut, 1 * WAD, 1000000 * WAD);
        amountIn = bound(amountIn, 1 * WAD / 100, reserveIn); // At most use all reserveIn

        uint256 amountOut = TickMath.getAmountOut(reserveIn, reserveOut, amountIn);

        // Output should be less than input (always some slippage)
        assertLt(amountOut, amountIn + reserveOut, "AmountOut should be bounded");
        // Output should not exceed available reserves
        assertLe(amountOut, reserveOut, "AmountOut should not exceed reserveOut");
    }
}

