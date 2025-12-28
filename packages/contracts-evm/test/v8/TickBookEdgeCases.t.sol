// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {TruthMarket} from "../../contracts/TruthMarket.sol";
import {Collateralizer} from "../../contracts/Collateralizer.sol";
import {TickBook} from "../../contracts/TickBook.sol";
import {TickBookVault} from "../../contracts/TickBookVault.sol";
import {ITickBook} from "../../contracts/interfaces/ITickBook.sol";
import {ITickBookVault} from "../../contracts/interfaces/ITickBookVault.sol";
import {OutcomeToken} from "../../contracts/OutcomeToken.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";
import {TickMath} from "../../contracts/libraries/TickMath.sol";

/**
 * @title TickBookEdgeCasesTest
 * @notice Vault-native TickBook edge-case tests
 * @dev Tests 1,000 tick resolution + USDC collateral reservation model
 */
contract TickBookEdgeCasesTest is Test {
    TruthMarket public market;
    Collateralizer public collateralizer;
    TickBookVault public vault;
    TickBook public tickBook;
    ERC20Mock public usdc;
    
    address public creator = address(0x1);
    address public adjudicator = address(0x2);
    address public alice = address(0x10);
    address public bob = address(0x11);
    
    address public yesToken;
    address public noToken;
    bytes32 public marketKey;
    
    uint256 constant WAD = 1e18;

    function setUp() public {
        usdc = new ERC20Mock();
        collateralizer = new Collateralizer(address(usdc));
        vault = new TickBookVault(address(usdc), address(this));
        tickBook = new TickBook(address(vault));
        vault.setTickBook(address(tickBook));
        
        vm.prank(creator);
        market = new TruthMarket("Test Market", uint64(block.timestamp + 30 days), adjudicator, address(0x3));
        vm.prank(creator);
        market.activate();
        
        (yesToken, noToken) = collateralizer.registerMarket(address(market), "YES", "YES");
        marketKey = tickBook.registerMarket(address(market), yesToken, noToken);
        
        usdc.mint(alice, 100000 * WAD);
        usdc.mint(bob, 100000 * WAD);
        
        // Deposit into vault for tests
        vm.startPrank(alice);
        usdc.approve(address(vault), type(uint256).max);
        vault.depositUsdc(50000 * WAD);
        vm.stopPrank();
        
        vm.startPrank(bob);
        usdc.approve(address(vault), type(uint256).max);
        vault.depositUsdc(50000 * WAD);
        vm.stopPrank();
    }

    // ============================================
    // Market Order Tests
    // ============================================

    function test_MarketOrder_BuyYES() public {
        // Alice places limit order (NO side) at tick 400
        // When buying YES, taker matches NO-side orders
        uint16 tick = 400;
        uint256 shares = 100 * WAD;
        
        vm.prank(alice);
        tickBook.placeLimitOrder(marketKey, 0, tick, tick, shares); // outcome=0=NO (counter-party)
        
        // Bob market buys YES
        vm.startPrank(bob);
        (uint256 yesReceived,) = tickBook.executeMarketOrder(marketKey, 1, shares, 500);
        vm.stopPrank();
        
        assertTrue(yesReceived > 0, "Should receive YES shares");
    }

    function test_MarketOrder_BuyNO() public {
        // Alice places limit order (YES side) at tick 600
        // When buying NO, taker matches YES-side orders (from high tick downward)
        uint16 tick = 600;
        uint256 shares = 100 * WAD;
        
        vm.prank(alice);
        tickBook.placeLimitOrder(marketKey, 1, tick, tick, shares); // outcome=1=YES (counter-party)
        
        // Bob market buys NO with limitTick <= maker tick
        vm.startPrank(bob);
        (uint256 noReceived,) = tickBook.executeMarketOrder(marketKey, 0, shares, 600);
        vm.stopPrank();
        
        assertTrue(noReceived > 0, "Should receive NO shares");
    }

    // ============================================
    // Limit Order Tests
    // ============================================

    function test_PlaceLimitOrder_BuyYES() public {
        uint16 tick = 400; // 40%
        uint256 shares = 100 * WAD;
        
        uint256 usdcBefore = vault.availableUsdcWad(alice);
        
        vm.prank(alice);
        tickBook.placeLimitOrder(marketKey, 1, tick, tick, shares); // outcome=1=YES
        
        uint256 usdcAfter = vault.availableUsdcWad(alice);
        uint256 reserved = vault.reservedUsdcWad(alice);
        
        assertTrue(usdcAfter < usdcBefore, "USDC should decrease");
        assertTrue(reserved > 0, "Reserved should increase");
        
        // Order should reserve tick * shares / 1000 USDC = 0.4 * shares
        uint256 expectedReserve = (uint256(tick) * shares) / 1000;
        assertEq(reserved, expectedReserve, "Reserved should equal price * shares");
    }

    function test_CancelLimitOrder_ReleasesUsdc() public {
        uint16 tick = 400;
        uint256 shares = 100 * WAD;
        
        vm.startPrank(alice);
        (uint256 firstOrderId,) = tickBook.placeLimitOrder(marketKey, 1, tick, tick, shares);
        
        uint256 reservedBefore = vault.reservedUsdcWad(alice);
        assertTrue(reservedBefore > 0, "Should have reserved USDC");
        
        tickBook.cancelOrder(marketKey, firstOrderId);
        
        uint256 reservedAfter = vault.reservedUsdcWad(alice);
        assertEq(reservedAfter, 0, "Reserved should be released");
        vm.stopPrank();
    }

    // ============================================
    // Edge Tick Tests (1,000 tick resolution)
    // ============================================

    function test_TickNearMax() public {
        uint16 tick = 950; // 95%
        uint256 shares = 10 * WAD;
        
        vm.prank(alice);
        tickBook.placeLimitOrder(marketKey, 1, tick, tick, shares);
        
        ITickBook.TickData memory data = tickBook.getTick(marketKey, tick);
        assertEq(data.yesDepth, shares, "YES depth should match");
    }

    function test_TickNearMin() public {
        uint16 tick = 50; // 5%
        uint256 shares = 10 * WAD;
        
        vm.prank(alice);
        tickBook.placeLimitOrder(marketKey, 0, tick, tick, shares);
        
        ITickBook.TickData memory data = tickBook.getTick(marketKey, tick);
        assertEq(data.noDepth, shares, "NO depth should match");
    }

    function test_InitialTick_Is500() public view {
        (uint16 tick, uint256 probability) = tickBook.getCurrentTick(marketKey);
        assertEq(tick, 500, "Initial tick should be 500 (50%)");
        assertEq(probability, 5e17, "Initial probability should be 0.5");
    }

    // ============================================
    // Revert Condition Tests
    // ============================================

    function test_RevertWhen_ZeroShares() public {
        vm.prank(alice);
        vm.expectRevert("TickBook: zero shares");
        tickBook.placeLimitOrder(marketKey, 1, 400, 400, 0);
    }

    function test_RevertWhen_MarketNotActive() public {
        bytes32 fakeKey = keccak256("fake");
        vm.prank(bob);
        vm.expectRevert("TickBook: not active");
        tickBook.executeMarketOrder(fakeKey, 1, 1 * WAD, 700);
    }

    function test_RevertWhen_RegisterMarketTwice() public {
        vm.expectRevert("TickBook: already registered");
        tickBook.registerMarket(address(market), yesToken, noToken);
    }

    function test_RevertWhen_RegisterZeroAddresses() public {
        TruthMarket market2 = new TruthMarket("Test2", uint64(block.timestamp + 30 days), adjudicator, address(0x3));
        
        vm.expectRevert("TickBook: zero yes token");
        tickBook.registerMarket(address(market2), address(0), noToken);
        
        vm.expectRevert("TickBook: zero no token");
        tickBook.registerMarket(address(market2), yesToken, address(0));
        
        vm.expectRevert("TickBook: zero market");
        tickBook.registerMarket(address(0), yesToken, noToken);
    }

    // ============================================
    // View Function Tests
    // ============================================

    function test_GetMarketInfo() public view {
        (address tm, address yt, address nt, bool active) = tickBook.getMarketInfo(marketKey);
        
        assertEq(tm, address(market), "Market should match");
        assertEq(yt, yesToken, "YES token should match");
        assertEq(nt, noToken, "NO token should match");
        assertTrue(active, "Market should be active");
    }

    function test_GetAccruedFees() public view {
        uint256 fees = tickBook.getAccruedFees(marketKey, alice);
        assertEq(fees, 0, "Accrued fees should be 0 (not implemented)");
    }

    function test_ClaimFees() public {
        uint256 claimed = tickBook.claimFees(marketKey);
        assertEq(claimed, 0, "Claimed fees should be 0 (not implemented)");
    }
}
