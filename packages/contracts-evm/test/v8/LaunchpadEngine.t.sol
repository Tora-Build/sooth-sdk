// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {LaunchpadEngine} from "../../contracts/LaunchpadEngine.sol";
import {AMMEngine} from "../../contracts/AMMEngine.sol";
import {TruthMarket} from "../../contracts/TruthMarket.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";

contract LaunchpadEngineTest is Test {
    LaunchpadEngine public launchpad;
    AMMEngine public amm;
    TruthMarket public market;
    ERC20Mock public usdc;

    address public owner = address(0x1);
    address public creator = address(0x2);
    address public trader1 = address(0x3);
    address public trader2 = address(0x4);
    address public treasury = address(0x5);
    address public adjudicator = address(0x6);
    address public guardian = address(0x7);

    uint256 constant WAD = 1e18;
    uint256 constant LN2 = 693147180559945309; // ln(2) in WAD
    uint256 constant INITIAL_LIQUIDITY = 1000 * WAD; // $1,000

    function setUp() public {
        // Deploy mock USDC (18 decimals for simplicity)
        usdc = new ERC20Mock();

        // Deploy AMM
        amm = new AMMEngine(address(usdc));

        // Deploy LaunchpadEngine
        vm.prank(owner);
        launchpad = new LaunchpadEngine(
            address(usdc),
            address(amm),
            treasury,
            owner
        );

        // Deploy TruthMarket
        vm.prank(creator);
        market = new TruthMarket(
            "Will aliens be confirmed by 2025?",
            uint64(block.timestamp + 30 days),
            adjudicator,
            guardian
        );

        // Fund users
        usdc.mint(creator, 10000 * WAD);
        usdc.mint(trader1, 10000 * WAD);
        usdc.mint(trader2, 10000 * WAD);

        // Approve launchpad
        vm.prank(creator);
        usdc.approve(address(launchpad), type(uint256).max);
        vm.prank(trader1);
        usdc.approve(address(launchpad), type(uint256).max);
        vm.prank(trader2);
        usdc.approve(address(launchpad), type(uint256).max);
    }

    // ============================================
    // Market Creation Tests
    // ============================================

    function test_CreateMarket() public {
        uint256 deposit = (INITIAL_LIQUIDITY * LN2) / WAD;

        vm.prank(creator);
        uint256 lpTokens = launchpad.createMarket(address(market), INITIAL_LIQUIDITY);

        // Check LP tokens minted
        assertEq(lpTokens, deposit, "LP tokens should equal deposit");
        assertEq(launchpad.getLPBalance(address(market), creator), deposit, "Creator should have LP tokens");

        // Check market state
        (
            address marketCreator,
            uint256 bBase,
            uint256 bCurrent,
            uint256 totalLPSupply,
            bool isGraduated,
            uint256 floorValue
        ) = launchpad.getMarketState(address(market));

        assertEq(marketCreator, creator, "Creator should be set");
        assertEq(bBase, INITIAL_LIQUIDITY, "bBase should be initial liquidity");
        assertEq(bCurrent, INITIAL_LIQUIDITY, "bCurrent should be initial liquidity");
        assertEq(totalLPSupply, deposit, "Total LP supply should equal deposit");
        assertFalse(isGraduated, "Market should not be graduated");
    }

    function test_RevertWhen_NonCreatorCreatesMarket() public {
        vm.prank(trader1); // Not the creator
        vm.expectRevert("LaunchpadEngine: not creator");
        launchpad.createMarket(address(market), INITIAL_LIQUIDITY);
    }

    function test_RevertWhen_MarketAlreadyExists() public {
        vm.prank(creator);
        launchpad.createMarket(address(market), INITIAL_LIQUIDITY);

        vm.prank(creator);
        vm.expectRevert("LaunchpadEngine: already exists");
        launchpad.createMarket(address(market), INITIAL_LIQUIDITY);
    }

    // ============================================
    // Trading Tests
    // ============================================

    function test_TradePositions_PreGraduation() public {
        // Create market
        vm.prank(creator);
        launchpad.createMarket(address(market), INITIAL_LIQUIDITY);

        // Activate market
        vm.prank(creator);
        market.activate();

        // Trade
        int256 deltaShares = 100 * int256(WAD); // Buy 100 YES
        uint256 maxCost = 1000 * WAD;

        vm.prank(trader1);
        uint256 actualCost = launchpad.tradePositions(address(market), deltaShares, maxCost);

        // Check trader received LP tokens (pre-grad: 100% of fees)
        uint256 traderLP = launchpad.getLPBalance(address(market), trader1);
        assertGt(traderLP, 0, "Trader should have LP tokens");

        // Check bCurrent increased
        (, , uint256 bCurrent, , , ) = launchpad.getMarketState(address(market));
        assertGt(bCurrent, INITIAL_LIQUIDITY, "bCurrent should have increased");
    }

    // Helper function to graduate a market by trading until threshold is reached
    function _graduateMarket(address _market, address trader) internal {
        // Fund trader generously
        usdc.mint(trader, 1000000 * WAD);
        
        // Get graduation threshold
        (, uint256 threshold, ) = launchpad.getGraduationProgress(_market);
        
        // Trade in batches until graduated
        uint256 batchSize = 500 * WAD; // Trade 500 shares at a time
        uint256 maxIterations = 100; // Safety limit
        
        for (uint256 i = 0; i < maxIterations; i++) {
            // Check if already graduated
            (, , , , bool isGraduated, ) = launchpad.getMarketState(_market);
            if (isGraduated) break;
            
            // Execute trade
            vm.prank(trader);
            try launchpad.tradePositions(_market, int256(batchSize), 100000 * WAD) {
                // Trade succeeded
            } catch {
                // If trade fails (e.g., slippage), try smaller amount
                vm.prank(trader);
                launchpad.tradePositions(_market, int256(batchSize / 2), 100000 * WAD);
            }
        }
        
        // Verify graduation
        (, , , , bool isGraduated, ) = launchpad.getMarketState(_market);
        assertTrue(isGraduated, "Market should be graduated after helper");
    }

    function test_Graduation() public {
        // Create market
        vm.prank(creator);
        launchpad.createMarket(address(market), INITIAL_LIQUIDITY);

        // Activate market
        vm.prank(creator);
        market.activate();

        // Use helper to graduate
        _graduateMarket(address(market), trader1);

        // Verify graduation
        (, , , , bool isGraduated, ) = launchpad.getMarketState(address(market));
        assertTrue(isGraduated, "Market should be graduated");
        
        // Verify graduation progress is 100%
        (, , uint256 progressBps) = launchpad.getGraduationProgress(address(market));
        assertEq(progressBps, 10000, "Progress should be 100%");
    }

    function test_FeeDistribution_PostGraduation() public {
        // Create market
        vm.prank(creator);
        launchpad.createMarket(address(market), INITIAL_LIQUIDITY);

        vm.prank(creator);
        market.activate();

        // Graduate market using helper
        _graduateMarket(address(market), trader1);

        // Verify graduated
        (, , , , bool isGraduated, ) = launchpad.getMarketState(address(market));
        assertTrue(isGraduated, "Market should be graduated");

        // Trade post-graduation
        uint256 treasuryBalanceBefore = usdc.balanceOf(treasury);

        vm.prank(trader2);
        launchpad.tradePositions(address(market), 100 * int256(WAD), 1000 * WAD);

        // Check treasury received protocol share (20% of fees)
        uint256 treasuryBalanceAfter = usdc.balanceOf(treasury);
        assertGt(treasuryBalanceAfter, treasuryBalanceBefore, "Treasury should receive protocol share");
    }

    // ============================================
    // LP Redemption Tests
    // ============================================

    function test_RedeemLP() public {
        // Create market
        vm.prank(creator);
        uint256 creatorLP = launchpad.createMarket(address(market), INITIAL_LIQUIDITY);

        // Activate and trade
        vm.prank(creator);
        market.activate();

        vm.prank(trader1);
        launchpad.tradePositions(address(market), 100 * int256(WAD), 1000 * WAD);

        // Creator redeems half their LP
        uint256 redeemAmount = creatorLP / 2;
        uint256 usdcBalanceBefore = usdc.balanceOf(creator);

        vm.prank(creator);
        uint256 usdcReceived = launchpad.redeemLP(address(market), redeemAmount);

        // Check USDC received
        assertGt(usdcReceived, 0, "Should receive USDC");
        assertEq(usdc.balanceOf(creator), usdcBalanceBefore + usdcReceived, "USDC balance should increase");

        // Check LP tokens burned
        assertEq(launchpad.getLPBalance(address(market), creator), creatorLP - redeemAmount, "LP tokens should be burned");
    }

    function test_RevertWhen_InsufficientLP() public {
        vm.prank(creator);
        launchpad.createMarket(address(market), INITIAL_LIQUIDITY);

        vm.prank(trader1);
        vm.expectRevert("LaunchpadEngine: insufficient LP");
        launchpad.redeemLP(address(market), 100 * WAD);
    }

    // ============================================
    // Creator Functions Tests
    // ============================================

    function test_IncreaseBBase() public {
        vm.prank(creator);
        launchpad.createMarket(address(market), INITIAL_LIQUIDITY);

        uint256 additionalAmount = 500 * WAD;
        uint256 creatorLPBefore = launchpad.getLPBalance(address(market), creator);

        vm.prank(creator);
        launchpad.increaseBBase(address(market), additionalAmount);

        // Check bBase increased
        (, uint256 bBase, uint256 bCurrent, , , ) = launchpad.getMarketState(address(market));
        assertEq(bBase, INITIAL_LIQUIDITY + additionalAmount, "bBase should increase");
        assertEq(bCurrent, INITIAL_LIQUIDITY + additionalAmount, "bCurrent should increase");

        // Check creator received LP tokens
        assertEq(
            launchpad.getLPBalance(address(market), creator),
            creatorLPBefore + additionalAmount,
            "Creator should receive LP tokens"
        );
    }

    function test_RevertWhen_NonCreatorIncreasesBBase() public {
        vm.prank(creator);
        launchpad.createMarket(address(market), INITIAL_LIQUIDITY);

        vm.prank(trader1);
        vm.expectRevert("LaunchpadEngine: not creator");
        launchpad.increaseBBase(address(market), 500 * WAD);
    }

    // ============================================
    // Governance Tests
    // ============================================

    function test_SetPreGradFee() public {
        vm.prank(owner);
        launchpad.setPreGradFee(300); // 3%

        assertEq(launchpad.preGradFeeBps(), 300, "Pre-grad fee should be updated");
    }

    function test_SetPostGradFee() public {
        vm.prank(owner);
        launchpad.setPostGradFee(50); // 0.5%

        assertEq(launchpad.postGradFeeBps(), 50, "Post-grad fee should be updated");
    }

    function test_SetFeeDistribution() public {
        vm.prank(owner);
        launchpad.setFeeDistribution(4000, 4000, 2000); // 40/40/20

        assertEq(launchpad.bBaseShareBps(), 4000, "bBase share should be updated");
        assertEq(launchpad.lpYieldShareBps(), 4000, "LP yield share should be updated");
        assertEq(launchpad.protocolShareBps(), 2000, "Protocol share should be updated");
    }

    function test_RevertWhen_FeeDistributionDoesNotSumTo100() public {
        vm.prank(owner);
        vm.expectRevert("LaunchpadEngine: must sum to 100%");
        launchpad.setFeeDistribution(5000, 4000, 2000); // Sums to 110%
    }

    function test_SetGraduationMultiplier() public {
        vm.prank(owner);
        launchpad.setGraduationMultiplier(3); // 3× bBase

        assertEq(launchpad.graduationMultiplier(), 3, "Graduation multiplier should be updated");
    }

    function test_RevertWhen_NonOwnerSetsParameters() public {
        vm.prank(trader1);
        vm.expectRevert();
        launchpad.setPreGradFee(300);

        vm.prank(trader1);
        vm.expectRevert();
        launchpad.setPostGradFee(50);

        vm.prank(trader1);
        vm.expectRevert();
        launchpad.setFeeDistribution(4000, 4000, 2000);

        vm.prank(trader1);
        vm.expectRevert();
        launchpad.setGraduationMultiplier(3);
    }

    // ============================================
    // View Functions Tests
    // ============================================

    function test_GetGraduationProgress() public {
        vm.prank(creator);
        launchpad.createMarket(address(market), INITIAL_LIQUIDITY);

        vm.prank(creator);
        market.activate();

        // Trade to accumulate fees
        vm.prank(trader1);
        launchpad.tradePositions(address(market), 100 * int256(WAD), 1000 * WAD);

        (uint256 feesAccrued, uint256 threshold, uint256 progressBps) = 
            launchpad.getGraduationProgress(address(market));

        assertGt(feesAccrued, 0, "Fees should be accrued");
        assertEq(threshold, (INITIAL_LIQUIDITY * 2), "Threshold should be 2x bBase");
        assertGt(progressBps, 0, "Progress should be > 0");
        assertLt(progressBps, 10000, "Progress should be < 100%");
    }
}
