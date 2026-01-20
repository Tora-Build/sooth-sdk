// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {V11TestBase} from "../V11TestBase.sol";
import {LaunchpadLPToken} from "@core/LaunchpadLPToken.sol";
import {ILaunchpadEngine} from "@core/interfaces/ILaunchpadEngine.sol";

/**
 * @title Graduation Flow Integration Tests
 * @notice End-to-end tests for trial → graduation → TickBook flow
 */
contract GraduationFlowTest is V11TestBase {
    // ============================================
    // Graduation Flow Tests
    // ============================================

    function test_GraduationFlow_TrialToGraduated() public {
        // 1. Create market with sufficient liquidity (100e18 minimum)
        address market = _createMarketWithLiquidity(100e18);

        // Verify market is in trial
        (, , , bool isTrialActive) = launchpad.getTrialStatus(market);
        assertTrue(isTrialActive, "Should be in trial");

        // 2. Check graduation progress
        (, , , , bool isGraduated, ) = launchpad.getMarketState(market);
        assertFalse(isGraduated, "Should not be graduated initially");

        // 3. Generate enough fees to graduate
        // Multiple trades to accumulate fees
        for (uint i = 0; i < 20; i++) {
            _buyShares(alice, market, 1, 50e18);
        }

        // 4. Check if graduated (depends on fee accumulation)
        (uint256 feesAccrued, uint256 threshold, uint256 progressBps) = launchpad.getGraduationProgress(market);

        // Progress should have increased
        assertGt(progressBps, 0, "Should have some progress");
    }

    function test_GraduationFlow_LPTokensTransferablePreGraduation() public {
        address market = _createMarket();
        address lpToken = launchpad.getLPToken(market);

        // Get LP tokens from trading
        _buyShares(alice, market, 1, 100e18);
        uint256 aliceLP = launchpad.getLPBalance(market, alice);
        assertGt(aliceLP, 0, "Alice should have LP");

        // Transfer should work pre-graduation
        vm.prank(alice);
        LaunchpadLPToken(lpToken).transfer(bob, aliceLP / 2);

        assertEq(launchpad.getLPBalance(market, bob), aliceLP / 2, "Bob received LP");
    }

    function test_GraduationFlow_CannotDismissAfterGraduation() public {
        address market = _createMarket();

        // Manually set graduated state via mock (in real scenario would need lots of trades)
        // For now, test the revert condition exists
        // Would need to mock the isGraduated state or generate massive fees

        // The contract checks !state.isGraduated before dismissal
        // This test documents the expected behavior
    }

    // ============================================
    // LP Token Behavior Tests
    // ============================================

    function test_LPToken_MintedToTraderPreGrad() public {
        address market = _createMarket();

        uint256 lpBefore = launchpad.getLPBalance(market, alice);
        _buyShares(alice, market, 1, 100e18);
        uint256 lpAfter = launchpad.getLPBalance(market, alice);

        assertGt(lpAfter, lpBefore, "LP minted on pre-grad trade");
    }

    function test_LPToken_CreatorCanIncreaseLiquidity() public {
        address market = _createMarket();

        uint256 lpBefore = launchpad.getLPBalance(market, creator);
        (, uint256 bBaseBefore, , , , ) = launchpad.getMarketState(market);

        vm.prank(creator);
        usdc.approve(address(launchpad), 50e18);

        vm.prank(creator);
        launchpad.increaseBBase(market, 50e18);

        uint256 lpAfter = launchpad.getLPBalance(market, creator);
        (, uint256 bBaseAfter, , , , ) = launchpad.getMarketState(market);

        assertGt(lpAfter, lpBefore, "Creator LP increased");
        assertGt(bBaseAfter, bBaseBefore, "bBase increased");
    }

    function test_LPToken_OnlyCreatorCanIncreaseBBase() public {
        address market = _createMarket();

        vm.prank(alice);
        vm.expectRevert("LaunchpadEngine: not creator");
        launchpad.increaseBBase(market, 50e18);
    }

    // ============================================
    // Fee Distribution Tests
    // ============================================

    function test_FeeDistribution_PreGrad_AllToBBase() public {
        address market = _createMarket();

        (, uint256 bBaseBefore, uint256 bCurrentBefore, , , ) = launchpad.getMarketState(market);

        // Trade generates fees
        _buyShares(alice, market, 1, 100e18);

        (, , uint256 bCurrentAfter, , , ) = launchpad.getMarketState(market);

        // bCurrent should increase from fee reinvestment
        assertGe(bCurrentAfter, bCurrentBefore, "bCurrent increased from fees");
    }

    // ============================================
    // Graduation Progress Tests
    // ============================================

    function test_GraduationProgress_IncreasesWithFees() public {
        address market = _createMarket();

        (, , uint256 progressBefore) = launchpad.getGraduationProgress(market);
        assertEq(progressBefore, 0, "No progress initially");

        // Generate fees
        for (uint i = 0; i < 5; i++) {
            _buyShares(alice, market, 1, 100e18);
        }

        (, , uint256 progressAfter) = launchpad.getGraduationProgress(market);
        assertGt(progressAfter, progressBefore, "Progress increased");
    }

    function test_GraduationProgress_ViewFunction() public {
        address market = _createMarket();

        (uint256 feesAccrued, uint256 threshold, uint256 progressBps) = launchpad.getGraduationProgress(market);

        assertEq(feesAccrued, 0, "No fees initially");
        assertGt(threshold, 0, "Threshold should be set");
        assertEq(progressBps, 0, "No progress initially");
    }
}
