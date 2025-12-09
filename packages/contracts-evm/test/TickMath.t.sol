// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/core/libs/TickMath.sol";

/// @title TickMathTest
/// @notice Unit tests for TickMath library
contract TickMathTest is Test {
    using TickMath for uint16;

    // ============ Constants Tests ============

    function testConstants() public pure {
        assertEq(TickMath.TOTAL_TICKS, 1000);
        assertEq(TickMath.PROB_PRECISION, 1e18);
        assertEq(TickMath.TICK_SIZE, 1e15); // 0.1% per tick
    }

    // ============ tickToProb Tests ============

    function testTickToProb_Boundary_Zero() public pure {
        // Tick 0 = 0% probability
        uint256 prob = TickMath.tickToProb(0);
        assertEq(prob, 0);
    }

    function testTickToProb_Boundary_Max() public pure {
        // Tick 1000 = 100% probability
        uint256 prob = TickMath.tickToProb(1000);
        assertEq(prob, 1e18);
    }

    function testTickToProb_Midpoint() public pure {
        // Tick 500 = 50% probability
        uint256 prob = TickMath.tickToProb(500);
        assertEq(prob, 0.5e18);
    }

    function testTickToProb_QuarterPoints() public pure {
        // Tick 250 = 25%
        assertEq(TickMath.tickToProb(250), 0.25e18);
        // Tick 750 = 75%
        assertEq(TickMath.tickToProb(750), 0.75e18);
    }

    // Note: Library revert tests cannot be directly tested with vm.expectRevert
    // as library functions are inlined. Revert behavior is tested indirectly
    // through contract integration tests.

    // ============ probToTick Tests ============

    function testProbToTick_Boundary_Zero() public pure {
        // 0% probability = Tick 0
        uint16 tick = TickMath.probToTick(0);
        assertEq(tick, 0);
    }

    function testProbToTick_Boundary_Max() public pure {
        // 100% probability = Tick 1000
        uint16 tick = TickMath.probToTick(1e18);
        assertEq(tick, 1000);
    }

    function testProbToTick_Midpoint() public pure {
        // 50% probability = Tick 500
        uint16 tick = TickMath.probToTick(0.5e18);
        assertEq(tick, 500);
    }

    function testProbToTick_RoundsDown() public pure {
        // 50.05% = 0.5005e18 should round down to tick 500
        uint16 tick = TickMath.probToTick(0.5005e18);
        assertEq(tick, 500);
    }

    // Note: Library revert tests cannot be directly tested with vm.expectRevert
    // as library functions are inlined. Revert behavior is tested indirectly
    // through contract integration tests.

    // ============ probToTickRound Tests ============

    function testProbToTickRound_RoundsToNearest() public pure {
        // 50.04% should round down to tick 500
        assertEq(TickMath.probToTickRound(0.5004e18), 500);
        // 50.06% should round up to tick 501
        assertEq(TickMath.probToTickRound(0.5006e18), 501);
    }

    function testProbToTickRound_ClampsToMax() public pure {
        // Exactly 100% should clamp to 1000
        assertEq(TickMath.probToTickRound(1e18), 1000);
    }

    // ============ Roundtrip Tests ============

    function testRoundtrip_TickToProb_ProbToTick() public pure {
        for (uint16 tick = 0; tick <= 1000; tick += 100) {
            uint256 prob = TickMath.tickToProb(tick);
            uint16 backTick = TickMath.probToTick(prob);
            assertEq(backTick, tick, "Roundtrip failed");
        }
    }

    // ============ Navigation Tests ============

    function testNextTickUp() public pure {
        assertEq(TickMath.nextTickUp(0), 1);
        assertEq(TickMath.nextTickUp(500), 501);
        assertEq(TickMath.nextTickUp(999), 1000);
        assertEq(TickMath.nextTickUp(1000), 1000); // Clamped
    }

    function testNextTickDown() public pure {
        assertEq(TickMath.nextTickDown(1000), 999);
        assertEq(TickMath.nextTickDown(500), 499);
        assertEq(TickMath.nextTickDown(1), 0);
        assertEq(TickMath.nextTickDown(0), 0); // Clamped
    }

    function testIsAdjacent() public pure {
        assertTrue(TickMath.isAdjacent(500, 501));
        assertTrue(TickMath.isAdjacent(501, 500));
        assertFalse(TickMath.isAdjacent(500, 502));
        assertFalse(TickMath.isAdjacent(500, 500));
    }

    function testTickDistance() public pure {
        assertEq(TickMath.tickDistance(0, 1000), 1000);
        assertEq(TickMath.tickDistance(1000, 0), 1000);
        assertEq(TickMath.tickDistance(500, 500), 0);
        assertEq(TickMath.tickDistance(400, 600), 200);
    }

    function testMidTick() public pure {
        assertEq(TickMath.midTick(), 500);
    }

    // ============ Tick Spacing Verification ============

    function testTickSpacing_10bps() public pure {
        // Adjacent ticks should differ by 0.1% (10 bps)
        uint256 prob500 = TickMath.tickToProb(500);
        uint256 prob501 = TickMath.tickToProb(501);
        
        // Difference should be 0.001 = 1e15
        assertEq(prob501 - prob500, 1e15);
    }
}
