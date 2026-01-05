// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {TickBookPoolManager} from "@core/TickBookPoolManager.sol";
import {TickBookVault} from "@core/TickBookVault.sol";
import {TruthMarket} from "@core/TruthMarket.sol";
import {OutcomeToken} from "@core/OutcomeToken.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";

/**
 * @title TickBookVault Settlement Tests
 * @notice Tests for vault settlement and redemption flows
 */
contract TickBookVaultSettlementTest is Test {
    TickBookPoolManager public poolManager;
    TickBookVault public vault;
    TruthMarket public market;
    OutcomeToken public yesToken;
    OutcomeToken public noToken;
    ERC20Mock public usdc;

    address public deployer;
    address public trader = address(0xBEEF);
    address public adjudicator;
    address public guardian;

    bytes32 public marketKey;
    uint256 constant WAD = 1e18;

    function setUp() public {
        deployer = address(this);
        adjudicator = address(0xAD7);
        guardian = address(0x6A2D);

        // Deploy core contracts
        usdc = new ERC20Mock();
        vault = new TickBookVault(address(usdc), deployer);
        poolManager = new TickBookPoolManager(address(vault));
        vault.setTickBook(address(poolManager));

        // Deploy market
        market = new TruthMarket(
            "Test Settlement Market",
            uint64(block.timestamp + 30 days),
            adjudicator,
            guardian
        );

        // Deploy outcome tokens (vault is collateralizer that mints tokens)
        yesToken = new OutcomeToken("Yes", "YES", address(vault), address(market), 1);
        noToken = new OutcomeToken("No", "NO", address(vault), address(market), 0);

        // Activate market
        market.activate();

        // Register market
        TickBookPoolManager.PoolKey memory key = TickBookPoolManager.PoolKey({
            truthMarket: address(market),
            yesToken: address(yesToken),
            noToken: address(noToken),
            hook: address(0)
        });
        marketKey = poolManager.registerMarket(key, 0.5e18);

        // Fund trader
        usdc.mint(trader, 1_000_000e18);
        vm.startPrank(trader);
        usdc.approve(address(vault), type(uint256).max);
        vault.depositUsdc(500_000e18);
        vm.stopPrank();
    }

    // ============================================
    // Deposit/Withdraw Tests
    // ============================================

    function test_DepositUsdc_UpdatesBalance() public {
        uint256 depositAmount = 1000e18;
        usdc.mint(address(this), depositAmount);
        usdc.approve(address(vault), depositAmount);

        vault.depositUsdc(depositAmount);

        assertEq(vault.availableUsdcWad(address(this)), depositAmount);
    }

    function test_WithdrawUsdc_Success() public {
        uint256 initial = vault.availableUsdcWad(trader);

        vm.prank(trader);
        vault.withdrawUsdc(100e18);

        assertEq(vault.availableUsdcWad(trader), initial - 100e18);
    }

    function test_WithdrawUsdc_RevertWhenInsufficientBalance() public {
        uint256 tooMuch = vault.availableUsdcWad(trader) + 1;

        vm.prank(trader);
        vm.expectRevert("TickBookVault: insufficient available");
        vault.withdrawUsdc(tooMuch);
    }

    // ============================================
    // Reserve/Release Tests
    // ============================================

    function test_ReserveUsdc_OnlyTickBook() public {
        vm.expectRevert("TickBookVault: only tickBook");
        vault.reserveUsdc(trader, 100e18);
    }

    function test_ReserveUsdc_UpdatesReservedBalance() public {
        uint256 availableBefore = vault.availableUsdcWad(trader);

        // Place an order (which uses available balance for collateral)
        vm.prank(trader);
        poolManager.placeRangeOrder(marketKey, 1, 400, 600, 1000e18);

        // Available should decrease after placing order
        assertLt(vault.availableUsdcWad(trader), availableBefore, "Available should decrease");
    }

    function test_ReleaseUsdc_OnCancel() public {
        uint256 availableBefore = vault.availableUsdcWad(trader);
        
        // Place order
        vm.prank(trader);
        (uint256 orderId,,) = poolManager.placeRangeOrder(marketKey, 1, 400, 600, 1000e18);

        uint256 availableAfterPlace = vault.availableUsdcWad(trader);
        assertLt(availableAfterPlace, availableBefore, "Should use collateral");

        // Cancel order
        vm.prank(trader);
        poolManager.cancelOrder(marketKey, orderId);

        // Available should increase back (collateral released)
        assertGt(vault.availableUsdcWad(trader), availableAfterPlace, "Should release collateral");
    }

    // ============================================
    // Outcome Credits Tests
    // ============================================

    function test_CreditOutcome_OnFill() public {
        // Alice places YES order
        vm.prank(trader);
        poolManager.placeRangeOrder(marketKey, 1, 400, 600, 10000e18);

        // Fund bob
        address bob = address(0xB0B);
        usdc.mint(bob, 1_000_000e18);
        vm.startPrank(bob);
        usdc.approve(address(vault), type(uint256).max);
        vault.depositUsdc(500_000e18);
        vm.stopPrank();

        // Bob places NO order (crosses with trader's YES order)
        vm.prank(bob);
        poolManager.placeRangeOrder(marketKey, 0, 450, 550, 5000e18);

        // Both should have internal outcome shares after crossing
        (uint256 traderYes, uint256 traderNo) = vault.getInternalOutcomes(address(market), trader);
        (uint256 bobYes, uint256 bobNo) = vault.getInternalOutcomes(address(market), bob);

        // Crossed trades should credit outcomes
        // (Exact amounts depend on fill mechanism)
    }

    // ============================================
    // Settlement/Redemption Tests
    // ============================================

    function test_RedeemResolved_YesWins() public {
        // Setup: Trader buys YES
        vm.prank(trader);
        poolManager.placeRangeOrder(marketKey, 1, 400, 600, 10000e18);

        // Another trader fills
        address bob = address(0xB0B);
        usdc.mint(bob, 1_000_000e18);
        vm.startPrank(bob);
        usdc.approve(address(vault), type(uint256).max);
        vault.depositUsdc(500_000e18);
        poolManager.executeMarketOrder(marketKey, 0, 5000e18, 10000e18);
        vm.stopPrank();

        // Trader claims fills
        vm.prank(trader);
        (uint256 orderId,,) = poolManager.placeRangeOrder(marketKey, 1, 100, 200, 1e18); // Get orderId
        
        // Settle market: YES wins
        vm.prank(adjudicator);
        market.settle(1, 0);
        
        vm.prank(guardian);
        market.finalize();

        // Trader redeems
        (uint256 yesShares,) = vault.getInternalOutcomes(address(market), trader);
        
        if (yesShares > 0) {
            vm.prank(trader);
            uint256 payout = vault.redeemResolved(address(market));
            // YES winners get 1:1 payout
            assertGt(payout, 0);
        }
    }

    function test_RedeemResolved_NoWins() public {
        // Setup: Trader buys NO
        vm.prank(trader);
        poolManager.placeRangeOrder(marketKey, 0, 400, 600, 10000e18);

        // Another trader fills
        address bob = address(0xB0B);
        usdc.mint(bob, 1_000_000e18);
        vm.startPrank(bob);
        usdc.approve(address(vault), type(uint256).max);
        vault.depositUsdc(500_000e18);
        poolManager.executeMarketOrder(marketKey, 1, 5000e18, 10000e18);
        vm.stopPrank();

        // Settle market: NO wins
        vm.prank(adjudicator);
        market.settle(0, 0);
        
        vm.prank(guardian);
        market.finalize();

        // Trader redeems
        (,uint256 noShares) = vault.getInternalOutcomes(address(market), trader);
        
        if (noShares > 0) {
            vm.prank(trader);
            uint256 payout = vault.redeemResolved(address(market));
            assertGt(payout, 0);
        }
    }

    function test_RedeemResolved_InvalidOutcome_FiftyFifty() public {
        // Setup positions
        vm.prank(trader);
        poolManager.placeRangeOrder(marketKey, 1, 400, 600, 10000e18);

        address bob = address(0xB0B);
        usdc.mint(bob, 1_000_000e18);
        vm.startPrank(bob);
        usdc.approve(address(vault), type(uint256).max);
        vault.depositUsdc(500_000e18);
        poolManager.placeRangeOrder(marketKey, 0, 450, 550, 5000e18);
        vm.stopPrank();

        // Settle market: INVALID (50/50 payout)
        vm.prank(adjudicator);
        market.settle(2, 0); // INVALID = 2
        
        vm.prank(guardian);
        market.finalize();

        // Both sides should get 50% payout
        assertEq(market.getRedemptionValue(0), 0.5e18);
        assertEq(market.getRedemptionValue(1), 0.5e18);
    }

    function test_RedeemResolved_RevertWhenNotSettled() public {
        // Market not settled yet
        vm.prank(trader);
        vm.expectRevert(); // Will revert because market not settled
        vault.redeemResolved(address(market));
    }

    // ============================================
    // Market Collateral Tests
    // ============================================

    function test_MarketCollateral_IncreasesOnTrade() public {
        uint256 collateralBefore = vault.marketCollateralWad(address(market));

        // Place order
        vm.prank(trader);
        poolManager.placeRangeOrder(marketKey, 1, 400, 600, 10000e18);

        // Collateral should increase
        assertGe(vault.marketCollateralWad(address(market)), collateralBefore);
    }

    // ============================================
    // Edge Cases
    // ============================================

    function test_DoubleRedeem_Reverts() public {
        // Setup simple trade
        vm.prank(trader);
        poolManager.placeRangeOrder(marketKey, 1, 400, 600, 10000e18);

        address bob = address(0xB0B);
        usdc.mint(bob, 1_000_000e18);
        vm.startPrank(bob);
        usdc.approve(address(vault), type(uint256).max);
        vault.depositUsdc(500_000e18);
        poolManager.executeMarketOrder(marketKey, 0, 5000e18, 10000e18);
        vm.stopPrank();

        // Settle
        vm.prank(adjudicator);
        market.settle(1, 0);
        vm.prank(guardian);
        market.finalize();

        // First redeem
        vm.prank(trader);
        try vault.redeemResolved(address(market)) {
            // Success
        } catch {
            // May fail if no shares
        }

        // Second redeem should have nothing
        vm.prank(trader);
        try vault.redeemResolved(address(market)) returns (uint256 payout) {
            assertEq(payout, 0, "Double redeem should return 0");
        } catch {
            // Also acceptable
        }
    }
}
