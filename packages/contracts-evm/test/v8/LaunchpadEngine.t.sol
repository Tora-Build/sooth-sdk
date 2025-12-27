// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {LaunchpadEngine} from "../../contracts/LaunchpadEngine.sol";
import {AMMEngine} from "../../contracts/AMMEngine.sol";
import {TruthMarket} from "../../contracts/TruthMarket.sol";
import {Collateralizer} from "../../contracts/Collateralizer.sol";
import {TickBook} from "../../contracts/TickBook.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";

contract LaunchpadEngineTest is Test {
    LaunchpadEngine public launchpad;
    AMMEngine public amm;
    TruthMarket public market;
    Collateralizer public collateralizer;
    TickBook public tickBook;
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

    // V8.2 outcome constants
    uint8 constant YES = 0;
    uint8 constant NO = 1;

    function setUp() public {
        // Deploy mock USDC (18 decimals for simplicity)
        usdc = new ERC20Mock();

        // Deploy AMM
        amm = new AMMEngine(address(usdc), owner);

        // Deploy Collateralizer and TickBook
        collateralizer = new Collateralizer(address(usdc));
        tickBook = new TickBook();

        // Deploy Collateralizer and TickBook
        collateralizer = new Collateralizer(address(usdc));
        tickBook = new TickBook();

        // Deploy LaunchpadEngine
        vm.prank(owner);
        launchpad = new LaunchpadEngine(
            address(usdc),
            address(amm),
            address(collateralizer),
            address(tickBook),
            treasury,
            owner
        );

        // Configure AMM router
        vm.prank(owner);
        amm.setRouter(address(launchpad));

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
        uint256 lpTokens = launchpad.createMarket(address(market), INITIAL_LIQUIDITY, "Test Market", "TEST");

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
        launchpad.createMarket(address(market), INITIAL_LIQUIDITY, "Test Market", "TEST");
    }

    function test_RevertWhen_MarketAlreadyExists() public {
        vm.prank(creator);
        launchpad.createMarket(address(market), INITIAL_LIQUIDITY, "Test Market", "TEST");

        vm.prank(creator);
        vm.expectRevert("LaunchpadEngine: already exists");
        launchpad.createMarket(address(market), INITIAL_LIQUIDITY, "Test Market", "TEST");
    }

    // ============================================
    // Trading Tests
    // ============================================

    function test_TradePositions_PreGraduation() public {
        // Create market
        vm.prank(creator);
        launchpad.createMarket(address(market), INITIAL_LIQUIDITY, "Test Market", "TEST");

        // Activate market
        vm.prank(creator);
        market.activate();

        // Trade: Buy 100 YES
        int256 deltaShares = 100 * int256(WAD);
        uint256 maxCost = 1000 * WAD;

        vm.prank(trader1);
        launchpad.tradePositions(address(market), YES, deltaShares, maxCost);

        // Position should be attributed to trader (not LaunchpadEngine)
        (uint256 traderYes, uint256 traderNo) = amm.getPosition(address(market), trader1);
        assertEq(traderYes, uint256(deltaShares), "AMMEngine YES position should be attributed to trader");
        assertEq(traderNo, 0, "AMMEngine NO position should be zero");
        
        (uint256 engineYes, uint256 engineNo) = amm.getPosition(address(market), address(launchpad));
        assertEq(engineYes, 0, "AMMEngine should not hold user YES positions");
        assertEq(engineNo, 0, "AMMEngine should not hold user NO positions");

        // V7 model: Traders get LP from fees (converts traders into stakeholders)
        uint256 traderLP = launchpad.getLPBalance(address(market), trader1);
        assertGt(traderLP, 0, "Trader should have LP tokens from fees");

        // Check bCurrent increased
        (, , uint256 bCurrent, , , ) = launchpad.getMarketState(address(market));
        assertGt(bCurrent, INITIAL_LIQUIDITY, "bCurrent should have increased");

        // AMM liquidity should also have increased (pricing depth matches Launchpad bCurrent)
        uint256 ammLiquidity = amm.getLiquidity(address(market));
        assertGt(ammLiquidity, INITIAL_LIQUIDITY, "AMM liquidity should have increased");
    }

    function test_SellNO_Works() public {
        // Create market
        vm.prank(creator);
        launchpad.createMarket(address(market), INITIAL_LIQUIDITY, "Test Market", "TEST");

        // Activate market
        vm.prank(creator);
        market.activate();

        // Buy 100 NO
        int256 buyNo = 100 * int256(WAD);
        vm.prank(trader1);
        launchpad.tradePositions(address(market), NO, buyNo, 1000 * WAD);

        (uint256 yesAfterBuy, uint256 noAfterBuy) = amm.getPosition(address(market), trader1);
        assertEq(noAfterBuy, uint256(buyNo), "Trader should have NO shares");
        assertEq(yesAfterBuy, 0, "Trader should have no YES shares");

        // Sell 40 NO (negative delta = sell)
        int256 sellNo = -40 * int256(WAD);
        vm.prank(trader1);
        launchpad.tradePositions(address(market), NO, sellNo, 0);

        (uint256 yesAfterSell, uint256 noAfterSell) = amm.getPosition(address(market), trader1);
        assertEq(noAfterSell, 60 * WAD, "NO position should decrease after sell");
        assertEq(yesAfterSell, 0, "YES position should still be zero");

        // Proceeds should be locked to trader
        (uint256 available, uint256 locked) = amm.getBalances(trader1);
        assertGt(available, 0, "Available proceeds should increase");
        assertEq(available, locked, "All proceeds should be locked initially");
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
            (, , , , bool isGrad, ) = launchpad.getMarketState(_market);
            if (isGrad) break;
            
            // Execute trade (buy YES)
            vm.prank(trader);
            try launchpad.tradePositions(_market, YES, int256(batchSize), 100000 * WAD) {
                // Trade succeeded
            } catch {
                // If trade fails (e.g., slippage), try smaller amount
                vm.prank(trader);
                launchpad.tradePositions(_market, YES, int256(batchSize / 2), 100000 * WAD);
            }
        }
        
        // Verify graduation
        (, , , , bool isGraduated, ) = launchpad.getMarketState(_market);
        assertTrue(isGraduated, "Market should be graduated after helper");
    }

    function test_Graduation() public {
        // Create market
        vm.prank(creator);
        launchpad.createMarket(address(market), INITIAL_LIQUIDITY, "Test Market", "TEST");

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

    function test_Graduation_WhenCollateralizerAlreadyRegistered_DoesNotRevert() public {
        // Create + activate market
        vm.prank(creator);
        launchpad.createMarket(address(market), INITIAL_LIQUIDITY, "Test Market", "TEST");
        vm.prank(creator);
        market.activate();

        // Pre-register the market in Collateralizer (simulates an external registerMarket call)
        (address yesToken, address noToken) = collateralizer.registerMarket(address(market), "Test Market", "TEST");

        // Also pre-register in TickBook so LaunchpadEngine's graduation is idempotent there too.
        tickBook.registerMarket(address(market), yesToken, noToken);

        // Now graduate via trading; should NOT revert due to pre-registration.
        _graduateMarket(address(market), trader1);

        (, , , , bool isGraduated, ) = launchpad.getMarketState(address(market));
        assertTrue(isGraduated, "Market should be graduated");
    }

    function test_Graduation_AtomicRegistration() public {
        // Create market
        vm.prank(creator);
        launchpad.createMarket(address(market), INITIAL_LIQUIDITY, "Test Market", "TEST");

        // Activate market
        vm.prank(creator);
        market.activate();

        // Check not registered yet
        assertFalse(collateralizer.isMarketRegistered(address(market)), "Should not be in Collateralizer yet");
        
        bytes32 marketKey = keccak256(abi.encodePacked(address(market), address(0), address(0))); // Placeholder
        // (Actual key needs yes/no addresses, which we don't have yet)

        // Graduate market
        _graduateMarket(address(market), trader1);

        // Verify graduation
        (, , , , bool isGraduated, ) = launchpad.getMarketState(address(market));
        assertTrue(isGraduated, "Market should be graduated");

        // Verify atomic registration in Collateralizer
        assertTrue(collateralizer.isMarketRegistered(address(market)), "Should be atomically registered in Collateralizer");
        (address yes, address no) = collateralizer.getOutcomeTokens(address(market));
        assertNotEq(yes, address(0), "YES token should be deployed");
        assertNotEq(no, address(0), "NO token should be deployed");

        // Verify atomic registration in TickBook
        bytes32 actualKey = keccak256(abi.encodePacked(address(market), yes, no));
        (address tm, address yt, address nt, bool active) = tickBook.getMarketInfo(actualKey);
        assertEq(tm, address(market), "TickBook: incorrect market");
        assertEq(yt, yes, "TickBook: incorrect yes token");
        assertEq(nt, no, "TickBook: incorrect no token");
        assertTrue(active, "TickBook: market should be active");
    }

    function test_FeeDistribution_PostGraduation() public {
        // Create market
        vm.prank(creator);
        launchpad.createMarket(address(market), INITIAL_LIQUIDITY, "Test Market", "TEST");

        vm.prank(creator);
        market.activate();

        // Graduate market using helper
        _graduateMarket(address(market), trader1);

        // Verify graduated
        (, , , , bool isGraduated, ) = launchpad.getMarketState(address(market));
        assertTrue(isGraduated, "Market should be graduated");

        // Trade post-graduation (buy YES)
        uint256 treasuryBalanceBefore = usdc.balanceOf(treasury);

        vm.prank(trader2);
        launchpad.tradePositions(address(market), YES, 100 * int256(WAD), 1000 * WAD);

        // Check treasury received protocol share (20% of fees)
        uint256 treasuryBalanceAfter = usdc.balanceOf(treasury);
        assertGt(treasuryBalanceAfter, treasuryBalanceBefore, "Treasury should receive protocol share");
    }

    // ============================================
    // LP Redemption Tests
    // ============================================

    function test_RedeemLP() public {
        // Create market - creator gets LP from initial deposit
        vm.prank(creator);
        uint256 creatorLP = launchpad.createMarket(address(market), INITIAL_LIQUIDITY, "Test Market", "TEST");

        // Activate and trade (V7 model: trader gets LP from fees, NOT creator)
        vm.prank(creator);
        market.activate();

        vm.prank(trader1);
        launchpad.tradePositions(address(market), YES, 100 * int256(WAD), 1000 * WAD);

        // Creator LP should be unchanged (only got initial deposit LP)
        assertEq(launchpad.getLPBalance(address(market), creator), creatorLP, "Creator LP unchanged after trade");

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
        launchpad.createMarket(address(market), INITIAL_LIQUIDITY, "Test Market", "TEST");

        vm.prank(trader1);
        vm.expectRevert("LaunchpadEngine: insufficient LP");
        launchpad.redeemLP(address(market), 100 * WAD);
    }

    // ============================================
    // Creator Functions Tests
    // ============================================

    function test_IncreaseBBase() public {
        vm.prank(creator);
        launchpad.createMarket(address(market), INITIAL_LIQUIDITY, "Test Market", "TEST");

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
        launchpad.createMarket(address(market), INITIAL_LIQUIDITY, "Test Market", "TEST");

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
        launchpad.createMarket(address(market), INITIAL_LIQUIDITY, "Test Market", "TEST");

        vm.prank(creator);
        market.activate();

        // Trade to accumulate fees (buy YES)
        vm.prank(trader1);
        launchpad.tradePositions(address(market), YES, 100 * int256(WAD), 1000 * WAD);

        (uint256 feesAccrued, uint256 threshold, uint256 progressBps) = 
            launchpad.getGraduationProgress(address(market));

        assertGt(feesAccrued, 0, "Fees should be accrued");
        assertEq(threshold, (INITIAL_LIQUIDITY * 2), "Threshold should be 2x bBase");
        assertGt(progressBps, 0, "Progress should be > 0");
        assertLt(progressBps, 10000, "Progress should be < 100%");
    }

    // ============================================
    // V8.2 Dual-Balance Tests
    // ============================================

    function test_HoldBothYesAndNo() public {
        // Create and activate market
        vm.prank(creator);
        launchpad.createMarket(address(market), INITIAL_LIQUIDITY, "Test Market", "TEST");
        vm.prank(creator);
        market.activate();

        // Buy YES
        vm.prank(trader1);
        launchpad.tradePositions(address(market), YES, 50 * int256(WAD), 500 * WAD);

        // Buy NO (user can now hold both!)
        vm.prank(trader1);
        launchpad.tradePositions(address(market), NO, 30 * int256(WAD), 500 * WAD);

        // Verify user holds both
        (uint256 yesShares, uint256 noShares) = amm.getPosition(address(market), trader1);
        assertEq(yesShares, 50 * WAD, "Should hold 50 YES");
        assertEq(noShares, 30 * WAD, "Should hold 30 NO");
    }

    function test_SellYesIndependently() public {
        // Create and activate market
        vm.prank(creator);
        launchpad.createMarket(address(market), INITIAL_LIQUIDITY, "Test Market", "TEST");
        vm.prank(creator);
        market.activate();

        // Buy both YES and NO
        vm.prank(trader1);
        launchpad.tradePositions(address(market), YES, 100 * int256(WAD), 1000 * WAD);
        vm.prank(trader1);
        launchpad.tradePositions(address(market), NO, 50 * int256(WAD), 500 * WAD);

        // Sell some YES
        vm.prank(trader1);
        launchpad.tradePositions(address(market), YES, -40 * int256(WAD), 0);

        // Check positions
        (uint256 yesShares, uint256 noShares) = amm.getPosition(address(market), trader1);
        assertEq(yesShares, 60 * WAD, "YES should decrease to 60");
        assertEq(noShares, 50 * WAD, "NO should remain 50");
    }
}
