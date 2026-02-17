// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Test.sol";
import {TickBitmap} from "@core/libraries/TickBitmap.sol";

contract TickBitmapHarness {
    using TickBitmap for TickBitmap.Bitmap;

    TickBitmap.Bitmap private _bitmap;

    function setBit(uint16 tick) external {
        _bitmap.setBit(tick);
    }

    function clearBit(uint16 tick) external {
        _bitmap.clearBit(tick);
    }

    function findNextDown(uint16 startTick) external view returns (uint16) {
        return _bitmap.findNextDown(startTick);
    }

    function isSet(uint16 tick) external view returns (bool) {
        return _bitmap.isSet(tick);
    }
}

contract TickBitmapTest is Test {
    TickBitmapHarness internal harness;

    function setUp() public {
        harness = new TickBitmapHarness();
    }

    function test_findNextDown_returns_highest_set_tick() public {
        harness.setBit(108);
        harness.setBit(276);
        harness.setBit(601);
        harness.setBit(944);

        assertEq(harness.findNextDown(1000), 944, "best tick from top");
        assertEq(harness.findNextDown(944), 601, "exclusive at same tick");
        assertEq(harness.findNextDown(700), 601, "mid-range descent");
        assertEq(harness.findNextDown(602), 601, "boundary above set tick");
        assertEq(harness.findNextDown(277), 276, "second word lookup");
        assertEq(harness.findNextDown(109), 108, "low lookup");
    }

    function test_findNextDown_matches_reference_scan_dense_distribution() public {
        bool[1000] memory expected;
        uint16[32] memory ticks = [
            uint16(12), 47, 89, 108, 133, 171, 199, 216,
            233, 250, 276, 301, 339, 365, 399, 457,
            503, 541, 579, 601, 617, 703, 719, 751,
            803, 817, 865, 901, 944, 971, 989, 999
        ];

        for (uint256 i = 0; i < ticks.length; i++) {
            harness.setBit(ticks[i]);
            expected[ticks[i]] = true;
        }

        for (uint16 start = 1000; start > 1; start--) {
            uint16 expectedTick = 1000;
            for (uint16 t = start - 1; ; t--) {
                if (expected[t]) {
                    expectedTick = t;
                    break;
                }
                if (t == 0) break;
            }

            uint16 actualTick = harness.findNextDown(start);
            assertEq(
                actualTick,
                expectedTick,
                string.concat("findNextDown mismatch start=", vm.toString(uint256(start)))
            );
        }
    }

    function test_clearBit_does_not_drop_other_bits_in_same_word() public {
        harness.setBit(276);
        harness.setBit(281);
        harness.setBit(301);

        assertEq(harness.findNextDown(1000), 301, "highest before clear");

        harness.clearBit(301);

        assertTrue(harness.isSet(281), "adjacent bit should remain set");
        assertTrue(harness.isSet(276), "lower bit should remain set");
        assertEq(harness.findNextDown(1000), 281, "next highest after clear");
    }

    function test_findNextDown_handles_word_boundaries_and_sparse_extremes() public {
        uint16[8] memory ticks = [uint16(1), 255, 256, 511, 512, 767, 768, 999];

        for (uint256 i = 0; i < ticks.length; i++) {
            harness.setBit(ticks[i]);
        }

        assertEq(harness.findNextDown(1000), 999, "top boundary");
        assertEq(harness.findNextDown(999), 768, "after top word transition");
        assertEq(harness.findNextDown(768), 767, "same-word predecessor");
        assertEq(harness.findNextDown(767), 512, "cross to prior word");
        assertEq(harness.findNextDown(512), 511, "word edge predecessor");
        assertEq(harness.findNextDown(511), 256, "middle transition");
        assertEq(harness.findNextDown(256), 255, "adjacent lower word");
        assertEq(harness.findNextDown(255), 1, "lowest sparse tick");
        assertEq(harness.findNextDown(1), 1000, "no lower tick");
    }
}
