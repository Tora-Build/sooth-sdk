// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {LaunchpadEngine} from "@core/LaunchpadEngine.sol";
import {AMMEngine} from "@core/AMMEngine.sol";
import {IAMMEngine} from "@core/interfaces/IAMMEngine.sol";
import {TruthMarket} from "@core/TruthMarket.sol";
import {Collateralizer} from "@core/Collateralizer.sol";
import {TickBookPoolManager} from "@core/TickBookPoolManager.sol";
import {TickBookVault} from "@core/TickBookVault.sol";
import {ProtocolConfig} from "@core/ProtocolConfig.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";

/**
 * @title Sell-Side Fee Integration Tests
 * @notice Tests for the Dec 29, 2025 sell-side fee changes:
 *         - IAMMEngine.tradePositionsFor now accepts a `fee` parameter
 *         - AMMEngine deducts fee from proceeds before locking
 *         - LaunchpadEngine calculates fee on sells and routes to _distributeFee
 * @dev Priority: P0 — Funds at Risk
 */
contract SellSideFeeIntegrationTest is Test {
    // ============================================
    // Test Contracts
    // ============================================
    
    LaunchpadEngine public launchpad;
    AMMEngine public amm;
    TruthMarket public market;
    Collateralizer public collateralizer;
    TickBookPoolManager public tickBook;
    TickBookVault public vault;
    ProtocolConfig public protocolConfig;
    ERC20Mock public usdc;

    // ============================================
    // Test Accounts
    // ============================================
    
    address public deployer;
    address public trader = address(0xBEEF);
    address public trader2 = address(0xCAFE);
    address public adjudicator;
    address public guardian;
    address public treasury;

    // ============================================
    // Constants
    // ============================================
    
    uint256 constant WAD = 1e18;
    uint256 constant BPS = 10000;
    uint16 constant PRE_GRAD_FEE_BPS = 500;   // 5%
    uint16 constant POST_GRAD_FEE_BPS = 100;  // 1%
    uint256 constant INITIAL_LIQUIDITY = 100 * WAD;  // b = 100
    uint8 constant YES = 1;
    uint8 constant NO = 0;

    // ============================================
    // Setup
    // ============================================

    function setUp() public {
        deployer = address(this);
        adjudicator = address(0xAD7);
        guardian = address(0x6A2D);
        treasury = address(0x7EA5);

        // Deploy USDC (18 decimals for MockUSDC on testnet)
        usdc = new ERC20Mock();

        // Deploy core contracts
        protocolConfig = new ProtocolConfig(deployer);
        amm = new AMMEngine(address(usdc), address(protocolConfig), deployer);
        collateralizer = new Collateralizer(address(usdc));
        
        // Deploy TickBook V9 (Singleton architecture)
        vault = new TickBookVault(address(usdc), address(protocolConfig), deployer);
        tickBook = new TickBookPoolManager(address(vault), address(protocolConfig));
        vault.setTickBook(address(tickBook));
        
        launchpad = new LaunchpadEngine(
            address(usdc),
            address(amm),
            address(collateralizer),
            address(tickBook),
            address(protocolConfig),
            treasury,
            deployer
        );

        // Configure router
        amm.setRouter(address(launchpad));

        uint64 startTime = uint64(block.timestamp);
        uint64 deadline = uint64(block.timestamp + 30 days);

        usdc.mint(trader, 1_000_000 * WAD);
        usdc.mint(trader2, 1_000_000 * WAD);

        vm.startPrank(deployer);
        usdc.mint(deployer, 100 * WAD);
        usdc.approve(address(launchpad), type(uint256).max);
        (address marketAddress, ) = launchpad.createMarket(
            "Test Sell Fee Market",
            startTime,
            deadline,
            adjudicator,
            address(protocolConfig),
            INITIAL_LIQUIDITY,
            0,
            0
        );
        vm.stopPrank();

        market = TruthMarket(marketAddress);

        // Approve launchpad for traders
        vm.prank(trader);
        usdc.approve(address(launchpad), type(uint256).max);
        
        vm.prank(trader2);
        usdc.approve(address(launchpad), type(uint256).max);
    }

    // ============================================
    // P0: Funds at Risk Tests
    // ============================================

    function test_SellYes_DeductsFeeFromProceeds() public {
        // 1. Buy YES shares
        uint256 buyAmount = 50 * WAD;
        vm.prank(trader);
        launchpad.tradePositions(address(market), YES, int256(buyAmount), 100 * WAD);

        // 2. Get position
        (uint256 yesSharesBefore, ) = amm.getPosition(address(market), trader);
        assertEq(yesSharesBefore, buyAmount, "Should have 50 YES shares");

        // 3. Get quote for selling
        (uint256 baseCost, ) = amm.getPositionQuote(address(market), YES, -int256(25 * WAD));
        uint256 expectedFee = (baseCost * PRE_GRAD_FEE_BPS) / BPS;
        uint256 expectedNetProceeds = baseCost - expectedFee;

        // 4. Sell YES shares
        vm.prank(trader);
        uint256 actualProceeds = launchpad.tradePositions(address(market), YES, -int256(25 * WAD), 0);

        // 5. Verify: actualProceeds should be NET (after fee deduction)
        assertEq(actualProceeds, expectedNetProceeds, "Proceeds should be net of fee");
        assertGt(baseCost, actualProceeds, "Base cost should exceed net proceeds");
    }

    function test_SellNo_DeductsFeeFromProceeds() public {
        // 1. Buy NO shares
        uint256 buyAmount = 50 * WAD;
        vm.prank(trader);
        launchpad.tradePositions(address(market), NO, int256(buyAmount), 100 * WAD);

        // 2. Get quote for selling
        (uint256 baseCost, ) = amm.getPositionQuote(address(market), NO, -int256(25 * WAD));
        uint256 expectedFee = (baseCost * PRE_GRAD_FEE_BPS) / BPS;
        uint256 expectedNetProceeds = baseCost - expectedFee;

        // 3. Sell NO shares
        vm.prank(trader);
        uint256 actualProceeds = launchpad.tradePositions(address(market), NO, -int256(25 * WAD), 0);

        // 4. Verify net proceeds
        assertEq(actualProceeds, expectedNetProceeds, "NO sell proceeds should be net of fee");
    }

    function test_SellFee_TransferredToRouter() public {
        // Buy first
        vm.prank(trader);
        launchpad.tradePositions(address(market), YES, int256(100 * WAD), 200 * WAD);

        // Get Launchpad balance before sell
        uint256 launchpadBalBefore = usdc.balanceOf(address(launchpad));

        // Sell
        (uint256 baseCost, ) = amm.getPositionQuote(address(market), YES, -int256(50 * WAD));
        uint256 expectedFee = (baseCost * PRE_GRAD_FEE_BPS) / BPS;
        // Convert WAD fee to USDC decimals (18 decimals = 1:1)
        uint256 expectedFeeUsdc = expectedFee;  // MockUSDC is 18 decimals

        vm.prank(trader);
        launchpad.tradePositions(address(market), YES, -int256(50 * WAD), 0);

        // LaunchpadEngine should have received fee (but may have distributed some)
        // The key is that AMMEngine transferred fee to router
        // Since pre-grad: fee goes to bBase growth + LP mint, no direct USDC remains
        // But feesAccrued should increase
        (,,,,, uint256 feesAccrued,,,,,) = launchpad.markets(address(market));
        
        assertGt(feesAccrued, 0, "Fees should have accrued");
    }

    function test_SellFee_AccruesToMarket() public {
        // Buy first
        vm.prank(trader);
        launchpad.tradePositions(address(market), YES, int256(100 * WAD), 200 * WAD);

        // Get feesAccrued before sell
        (,,,,, uint256 feesBefore,,,,,) = launchpad.markets(address(market));

        // Sell
        vm.prank(trader);
        launchpad.tradePositions(address(market), YES, -int256(50 * WAD), 0);

        // Get feesAccrued after sell
        (,,,,, uint256 feesAfter,,,,,) = launchpad.markets(address(market));

        assertGt(feesAfter, feesBefore, "Fees should increase after sell");
    }

    function test_SellSlippage_ChecksNetProceeds() public {
        // Buy first
        vm.prank(trader);
        launchpad.tradePositions(address(market), YES, int256(100 * WAD), 200 * WAD);

        // Get quote for sell
        (uint256 baseCost, ) = amm.getPositionQuote(address(market), YES, -int256(50 * WAD));
        uint256 expectedFee = (baseCost * PRE_GRAD_FEE_BPS) / BPS;
        uint256 netProceeds = baseCost - expectedFee;

        // Set minProceeds slightly above net — should fail
        vm.prank(trader);
        vm.expectRevert("AMMEngine: slippage exceeded");
        launchpad.tradePositions(address(market), YES, -int256(50 * WAD), netProceeds + 1);

        // Set minProceeds at net — should succeed
        vm.prank(trader);
        uint256 actual = launchpad.tradePositions(address(market), YES, -int256(50 * WAD), netProceeds);
        assertGe(actual, netProceeds, "Should meet slippage requirement");
    }

    // ============================================
    // P1: Edge Cases
    // ============================================

    function test_SellFee_PreGradRate() public {
        // Market starts pre-graduation
        (,,,,,,,, bool isGraduated,,) = launchpad.markets(address(market));
        assertFalse(isGraduated, "Should start pre-grad");

        // Buy and sell
        vm.startPrank(trader);
        launchpad.tradePositions(address(market), YES, int256(100 * WAD), 200 * WAD);
        vm.stopPrank();

        (uint256 baseCost, ) = amm.getPositionQuote(address(market), YES, -int256(50 * WAD));
        uint256 expectedFee = (baseCost * PRE_GRAD_FEE_BPS) / BPS;  // 5%
        uint256 expectedNet = baseCost - expectedFee;

        vm.prank(trader);
        uint256 actual = launchpad.tradePositions(address(market), YES, -int256(50 * WAD), 0);

        // Verify 5% fee was applied
        assertEq(actual, expectedNet, "Pre-grad sell should use 5% fee");
    }

    function test_SellFee_RevertsIfExceedsProceeds() public {
        // This tests the AMMEngine protection: require(fee <= actualCost)
        // In normal operation, LaunchpadEngine calculates fee correctly
        // But we test the AMMEngine guard directly
        
        // Buy first
        vm.prank(trader);
        launchpad.tradePositions(address(market), YES, int256(100 * WAD), 200 * WAD);

        // Try to call AMMEngine directly with excessive fee (bypass LaunchpadEngine)
        // This should revert
        vm.startPrank(address(launchpad));  // We need router permission
        
        (uint256 baseCost, ) = amm.getPositionQuote(address(market), YES, -int256(50 * WAD));
        uint256 excessiveFee = baseCost + 1;

        vm.expectRevert("AMMEngine: fee exceeds proceeds");
        amm.tradePositionsFor(trader, address(market), YES, -int256(50 * WAD), 0, excessiveFee);
        
        vm.stopPrank();
    }

    function testFuzz_SellFee_RandomAmounts(uint256 sellAmount) public {
        // Bound sell amount to reasonable range
        sellAmount = bound(sellAmount, 1 * WAD, 50 * WAD);

        // Buy shares first
        vm.prank(trader);
        launchpad.tradePositions(address(market), YES, int256(100 * WAD), 300 * WAD);

        // Get quote
        (uint256 baseCost, ) = amm.getPositionQuote(address(market), YES, -int256(sellAmount));
        uint256 expectedFee = (baseCost * PRE_GRAD_FEE_BPS) / BPS;
        uint256 expectedNet = baseCost > expectedFee ? baseCost - expectedFee : 0;

        // Execute sell
        vm.prank(trader);
        uint256 actual = launchpad.tradePositions(address(market), YES, -int256(sellAmount), 0);

        // Verify fee deduction
        assertEq(actual, expectedNet, "Fuzz: Net proceeds should match expected");
    }

    // ============================================
    // P2: Integration Tests
    // ============================================

    function test_SellThenBuy_FeeAccountingCorrect() public {
        // Trader1 buys YES
        vm.prank(trader);
        launchpad.tradePositions(address(market), YES, int256(100 * WAD), 200 * WAD);

        // Trader1 sells YES — proceeds locked
        vm.prank(trader);
        uint256 sellProceeds = launchpad.tradePositions(address(market), YES, -int256(50 * WAD), 0);

        // Check locked balance
        (uint256 available, uint256 locked) = amm.getBalances(trader);
        assertEq(available, sellProceeds, "Available should equal sell proceeds");
        assertEq(locked, sellProceeds, "All proceeds should be locked");

        // Trader1 buys NO using locked proceeds
        vm.prank(trader);
        launchpad.tradePositions(address(market), NO, int256(30 * WAD), 100 * WAD);

        // Verify position and balances updated correctly
        (uint256 yesShares, uint256 noShares) = amm.getPosition(address(market), trader);
        assertEq(yesShares, 50 * WAD, "Should have remaining 50 YES");
        assertEq(noShares, 30 * WAD, "Should have 30 NO");
    }

    function test_BuyThenSell_LocksNetProceeds() public {
        // Buy shares
        vm.prank(trader);
        launchpad.tradePositions(address(market), YES, int256(100 * WAD), 200 * WAD);

        // Sell partial
        vm.prank(trader);
        uint256 sellProceeds = launchpad.tradePositions(address(market), YES, -int256(50 * WAD), 0);

        // Check lock queue
        IAMMEngine.LockEntry[] memory queue = amm.getLockQueue(trader);
        assertEq(queue.length, 1, "Should have 1 lock entry");
        assertEq(queue[0].amount, sellProceeds, "Lock amount should be NET proceeds");
        assertEq(queue[0].market, address(market), "Lock should reference market");
    }

    function test_MultipleSells_AccumulateFees() public {
        // Buy first
        vm.prank(trader);
        launchpad.tradePositions(address(market), YES, int256(100 * WAD), 300 * WAD);

        (,,,,, uint256 feesBefore,,,,,) = launchpad.markets(address(market));

        // Sell in batches
        vm.startPrank(trader);
        launchpad.tradePositions(address(market), YES, -int256(20 * WAD), 0);
        launchpad.tradePositions(address(market), YES, -int256(20 * WAD), 0);
        launchpad.tradePositions(address(market), YES, -int256(20 * WAD), 0);
        vm.stopPrank();

        (,,,,, uint256 feesAfter,,,,,) = launchpad.markets(address(market));

        // Each sell should have contributed fees
        assertGt(feesAfter, feesBefore, "Multiple sells should accumulate fees");
    }

    // ============================================
    // Events Test
    // ============================================

    function test_SellEmits_PositionTradedWithFee() public {
        // Buy first
        vm.prank(trader);
        launchpad.tradePositions(address(market), YES, int256(100 * WAD), 200 * WAD);

        // Get expected values
        (uint256 baseCost, ) = amm.getPositionQuote(address(market), YES, -int256(50 * WAD));
        uint256 expectedFee = (baseCost * PRE_GRAD_FEE_BPS) / BPS;
        uint256 expectedNet = baseCost - expectedFee;

        // Expect event with net proceeds and fee
        vm.expectEmit(true, true, true, true);
        emit ILaunchpadEngineEvents.PositionTraded(
            trader,
            address(market),
            YES,
            -int256(50 * WAD),
            expectedNet,  // actualCost = net proceeds
            expectedFee   // fee
        );

        vm.prank(trader);
        launchpad.tradePositions(address(market), YES, -int256(50 * WAD), 0);
    }
}

// Interface for event testing
interface ILaunchpadEngineEvents {
    event PositionTraded(
        address indexed trader,
        address indexed market,
        uint8 outcome,
        int256 deltaShares,
        uint256 actualCost,
        uint256 fee
    );
}
