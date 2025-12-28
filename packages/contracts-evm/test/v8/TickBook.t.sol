// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {TruthMarket} from "../../contracts/TruthMarket.sol";
import {Collateralizer} from "../../contracts/Collateralizer.sol";
import {TickBook} from "../../contracts/TickBook.sol";
import {TickBookVault} from "../../contracts/TickBookVault.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";
import {TickMath} from "../../contracts/libraries/TickMath.sol";

contract TickBookTest is Test {
    TruthMarket public market;
    Collateralizer public collateralizer;
    TickBook public tickBook;
    TickBookVault public vault;
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
        
        usdc.mint(alice, 10000 * WAD);
        usdc.mint(bob, 10000 * WAD);

        vm.startPrank(alice);
        usdc.approve(address(vault), type(uint256).max);
        vault.depositUsdc(10000 * WAD);
        vm.stopPrank();

        vm.startPrank(bob);
        usdc.approve(address(vault), type(uint256).max);
        vault.depositUsdc(10000 * WAD);
        vm.stopPrank();
    }

    function test_PlaceLimitOrder_ReservesCollateral() public {
        uint16 tick = 600; // 60.0% YES
        uint256 shares = 10 * WAD;

        uint256 pWad = TickMath.tickToProbability(tick);
        uint256 expectedReserve = (shares * pWad) / WAD; // YES order reserves P * q

        uint256 availBefore = vault.availableUsdcWad(alice);
        uint256 resBefore = vault.reservedUsdcWad(alice);

        vm.startPrank(alice);
        tickBook.placeLimitOrder(marketKey, 1, tick, tick, shares);
        vm.stopPrank();

        assertEq(vault.availableUsdcWad(alice), availBefore - expectedReserve);
        assertEq(vault.reservedUsdcWad(alice), resBefore + expectedReserve);
    }

    function test_CancelOrder_ReleasesCollateral() public {
        uint16 tick = 600;
        uint256 shares = 10 * WAD;

        vm.startPrank(alice);
        (uint256 firstId, uint256 count) = tickBook.placeLimitOrder(marketKey, 1, tick, tick, shares);
        assertEq(count, 1);

        uint256 availMid = vault.availableUsdcWad(alice);
        uint256 resMid = vault.reservedUsdcWad(alice);

        tickBook.cancelOrder(marketKey, firstId);
        vm.stopPrank();

        assertGt(vault.availableUsdcWad(alice), availMid);
        assertLt(vault.reservedUsdcWad(alice), resMid);
    }

    function test_MarketOrder_BuyYES_MatchesNO() public {
        // Alice provides NO-side liquidity at tick 400 (YES price 40.0% => NO price 60.0%)
        uint16 tick = 400;
        uint256 shares = 10 * WAD;

        vm.startPrank(alice);
        tickBook.placeLimitOrder(marketKey, 0, tick, tick, shares);
        vm.stopPrank();

        // Bob buys YES up to tick 500
        vm.startPrank(bob);
        (uint256 filled, uint16 finalTick) = tickBook.executeMarketOrder(marketKey, 1, shares, 500);
        vm.stopPrank();

        assertEq(filled, shares);
        assertEq(finalTick, tick);

        (uint256 yesBob, uint256 noBob) = vault.getInternalOutcomes(address(market), bob);
        (uint256 yesAlice, uint256 noAlice) = vault.getInternalOutcomes(address(market), alice);
        assertEq(yesBob, shares);
        assertEq(noBob, 0);
        assertEq(yesAlice, 0);
        assertEq(noAlice, shares);

        // Collateral backing equals filled shares (complete-set backing)
        assertEq(vault.marketCollateralWad(address(market)), shares);
    }
}
