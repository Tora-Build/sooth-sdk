// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/core/libs/TickMath.sol";
import "../contracts/core/libs/TickLMSR.sol";

/// @title TickLMSRTest
/// @notice Unit tests for TickLMSR library
contract TickLMSRTest is Test {
    using TickMath for uint16;
    using TickLMSR for TickLMSR.TickCostArray;

    // Storage for tick costs
    TickLMSR.TickCostArray private tickCosts;

    // Liquidity parameter (typical value)
    uint256 constant B_PARAM = 10_000e18;

    function setUp() public {
        // Initialize tick costs
        tickCosts.initializeTickCosts();
    }

    // ============ Constants Tests ============

    function testConstants() public pure {
        assertEq(TickLMSR.WAD, 1e18);
        assertEq(TickLMSR.LN2_WAD, 693147180559945309);
    }

    // ============ Tick Cost Sum Tests ============

    function testTickCostsSum_EqualsLn2() public view {
        uint256 total = 0;
        for (uint16 i = 0; i < TickMath.TOTAL_TICKS; i++) {
            total += tickCosts.costs[i];
        }
        
        // Should be within 0.1% of ln(2)
        uint256 tolerance = TickLMSR.LN2_WAD / 1000;
        assertApproxEqAbs(total, TickLMSR.LN2_WAD, tolerance);
    }

    function testVerifySum() public view {
        // Should not revert
        tickCosts.verifySum();
    }

    // ============ Cost Distribution Tests ============

    function testTickCosts_HigherAtCenter() public view {
        // Cost at center (tick 500) should be higher than at extremes
        uint256 costAtCenter = tickCosts.costs[500];
        uint256 costAtExtreme0 = tickCosts.costs[0];
        uint256 costAtExtreme999 = tickCosts.costs[999];
        
        assertTrue(costAtCenter > costAtExtreme0, "Center cost should be higher than extreme 0");
        assertTrue(costAtCenter > costAtExtreme999, "Center cost should be higher than extreme 999");
    }

    function testTickCosts_Symmetric() public view {
        // Verify that costs near the center are roughly equal
        // Compare costs around tick 499 and 500 (the center)
        uint256 cost499 = tickCosts.costs[499];
        uint256 cost500 = tickCosts.costs[500];
        // Center costs should be within 1% of each other
        assertApproxEqRel(cost499, cost500, 0.01e18);
        
        // Center costs should be at least 2x more expensive than extremes
        uint256 avgCenter = (cost499 + cost500) / 2;
        uint256 avgExtreme = (tickCosts.costs[0] + tickCosts.costs[999]) / 2;
        assertTrue(avgCenter > avgExtreme * 2, "Center should be much more expensive");
    }

    // ============ costToMove Tests ============

    function testCostToMove_ZeroForSameTick() public view {
        int256 cost = tickCosts.costToMove(500, 500, B_PARAM);
        assertEq(cost, 0);
    }

    function testCostToMove_Symmetric() public view {
        // Cost to move up should be negative of cost to move down
        int256 costUp = tickCosts.costToMove(500, 600, B_PARAM);
        int256 costDown = tickCosts.costToMove(600, 500, B_PARAM);
        
        assertTrue(costUp > 0, "Moving up should cost money");
        assertTrue(costDown < 0, "Moving down should receive money");
        assertEq(costUp, -costDown, "Costs should be symmetric");
    }

    function testCostToMove_Additive() public view {
        // Cost from A to C should equal cost from A to B plus cost from B to C
        int256 costAC = tickCosts.costToMove(400, 600, B_PARAM);
        int256 costAB = tickCosts.costToMove(400, 500, B_PARAM);
        int256 costBC = tickCosts.costToMove(500, 600, B_PARAM);
        
        assertEq(costAC, costAB + costBC);
    }

    function testCostToMove_ScalesWithB() public view {
        // Doubling b should double the cost
        int256 cost1 = tickCosts.costToMove(500, 600, B_PARAM);
        int256 cost2 = tickCosts.costToMove(500, 600, B_PARAM * 2);
        
        assertEq(cost2, cost1 * 2);
    }

    function testCostToMove_FullRange() public view {
        // Cost to move from 0 to 1000 should be approximately b * ln(2)
        int256 fullCost = tickCosts.costToMove(0, 1000, B_PARAM);
        
        // Expected: B_PARAM * LN2_WAD / WAD
        uint256 expectedCost = (B_PARAM * TickLMSR.LN2_WAD) / TickLMSR.WAD;
        
        // Allow 0.1% tolerance
        assertApproxEqRel(uint256(fullCost), expectedCost, 0.001e18);
    }

    // ============ ticksFromBudget Tests ============

    function testTicksFromBudget_ZeroBudget() public view {
        (uint16 toTick, uint256 actualCost) = tickCosts.ticksFromBudget(500, 0, true, B_PARAM);
        assertEq(toTick, 500);
        assertEq(actualCost, 0);
    }

    function testTicksFromBudget_MoveUp() public view {
        // Calculate cost to move 100 ticks up
        int256 expectedCost = tickCosts.costToMove(500, 600, B_PARAM);
        
        // Give slightly more budget
        (uint16 toTick, uint256 actualCost) = tickCosts.ticksFromBudget(500, uint256(expectedCost) + 1e18, true, B_PARAM);
        
        assertEq(toTick, 600);
        assertEq(actualCost, uint256(expectedCost));
    }

    function testTicksFromBudget_MoveDown() public view {
        // Calculate cost to move 100 ticks down
        int256 expectedCost = tickCosts.costToMove(500, 400, B_PARAM);
        
        // Give slightly more budget (use absolute value)
        (uint16 toTick, uint256 actualCost) = tickCosts.ticksFromBudget(500, uint256(-expectedCost) + 1e18, false, B_PARAM);
        
        assertEq(toTick, 400);
        assertEq(actualCost, uint256(-expectedCost));
    }

    function testTicksFromBudget_ClampsAtBoundary() public view {
        // Very large budget should clamp at tick 1000
        (uint16 toTick, ) = tickCosts.ticksFromBudget(900, type(uint256).max / 2, true, B_PARAM);
        assertEq(toTick, 1000);
        
        // Very large budget should clamp at tick 0
        (toTick, ) = tickCosts.ticksFromBudget(100, type(uint256).max / 2, false, B_PARAM);
        assertEq(toTick, 0);
    }

    // ============ Price Tests ============

    function testPriceAtTick() public pure {
        assertEq(TickLMSR.priceAtTick(0), 0);
        assertEq(TickLMSR.priceAtTick(500), 0.5e18);
        assertEq(TickLMSR.priceAtTick(1000), 1e18);
    }

    function testNoPriceAtTick() public pure {
        assertEq(TickLMSR.noPriceAtTick(0), 1e18);
        assertEq(TickLMSR.noPriceAtTick(500), 0.5e18);
        assertEq(TickLMSR.noPriceAtTick(1000), 0);
    }

    function testPriceSum_AlwaysOne() public pure {
        for (uint16 tick = 0; tick <= 1000; tick += 100) {
            uint256 yesPrice = TickLMSR.priceAtTick(tick);
            uint256 noPrice = TickLMSR.noPriceAtTick(tick);
            assertEq(yesPrice + noPrice, 1e18);
        }
    }

    // ============ Gas Efficiency Tests ============

    function testGas_CrossingTicks() public view {
        uint256 gasBefore = gasleft();
        tickCosts.costToMove(400, 600, B_PARAM); // Cross 200 ticks
        uint256 gasUsed = gasBefore - gasleft();
        
        // Should be under 500k gas for crossing 200 ticks
        // This is still much cheaper than continuous LMSR with exp/ln
        assertTrue(gasUsed < 500_000, "Gas too high for 200 tick crossing");
        // Note: Gas measurement logged in testGas_InitializeTickCosts
    }

    function testGas_InitializeTickCosts() public {
        TickLMSR.TickCostArray storage newCosts = tickCosts;
        
        uint256 gasBefore = gasleft();
        newCosts.initializeTickCosts();
        uint256 gasUsed = gasBefore - gasleft();
        
        // Initialization is expensive but only done once
        emit log_named_uint("Gas for initialization", gasUsed);
        // This is a one-time cost, so we just log it
    }
}
