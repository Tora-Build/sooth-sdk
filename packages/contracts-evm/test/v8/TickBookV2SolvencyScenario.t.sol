// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {TickBookV2} from "../../contracts/TickBookV2.sol";
import {TickBookVault} from "../../contracts/TickBookVault.sol";
import {MockUSDC} from "../../contracts/MockUSDC.sol";

// Minimal TruthMarket mock (TickBookV2 requires isLive())
contract MockTruthMarketLiveOnly {
    bool public isLive = true;
    function setLive(bool v) external { isLive = v; }
}

/**
 * @title TickBookV2SolvencyScenarioTest
 * @notice Deterministic scenario test to validate collateral + refund accounting for TickBookV2.
 *
 * This test intentionally avoids “full economic correctness for all ranges” and instead locks in:
 * - marketCollateral increases by maker collateral at placement + taker cost at execution
 * - internal shares minted (YES/NO) are fully backed: marketCollateral >= max(totalYES, totalNO)
 * - maker collateral usage never exceeds deposit
 * - cancel refunds exactly (deposit - used)
 */
contract TickBookV2SolvencyScenarioTest is Test {
    uint256 private constant WAD = 1e18;

    MockUSDC public usdc;
    TickBookVault public vault;
    TickBookV2 public tickBook;
    MockTruthMarketLiveOnly public market;
    bytes32 public marketKey;

    address public maker = address(0xA11CE);
    address public taker = address(0xB0B);

    function setUp() public {
        usdc = new MockUSDC("Mock USDC", "USDC");
        vault = new TickBookVault(address(usdc), address(this));
        tickBook = new TickBookV2(address(vault));
        vault.setTickBook(address(tickBook));

        market = new MockTruthMarketLiveOnly();
        // dummy token metadata
        address yesToken = address(0x1111111111111111111111111111111111111111);
        address noToken = address(0x2222222222222222222222222222222222222222);
        marketKey = tickBook.registerMarket(address(market), yesToken, noToken, 0.5e18);

        usdc.mint(maker, 1_000_000 * WAD);
        usdc.mint(taker, 1_000_000 * WAD);

        vm.prank(maker);
        usdc.approve(address(vault), type(uint256).max);
        vm.prank(taker);
        usdc.approve(address(vault), type(uint256).max);

        vm.prank(maker);
        vault.depositUsdc(500_000 * WAD);
        vm.prank(taker);
        vault.depositUsdc(500_000 * WAD);
    }

    function test_SolvencyAndRefundAccounting_SingleMakerSingleTaker() public {
        // Maker places NO-side liquidity over a modest range.
        // sharesTotal is total shares across the whole range.
        uint16 tickLow = 450;
        uint16 tickHigh = 550;
        uint256 sharesTotal = 10_000 * WAD;

        uint256 collateralBefore = vault.marketCollateralWad(address(market));
        uint256 makerAvailBefore = vault.availableUsdcWad(maker);

        vm.prank(maker);
        (uint256 orderId,,) = tickBook.placeRangeOrder(marketKey, 0, tickLow, tickHigh, sharesTotal);

        TickBookV2.RangeOrder memory o0 = tickBook.getOrder(marketKey, orderId);
        assertEq(o0.sharesTotal, sharesTotal);
        assertGt(o0.liquidity, 0); // density > 0
        assertGt(o0.collateralDepositedWad, 0);

        // Placement moves maker collateral into market collateral
        uint256 collateralAfterPlace = vault.marketCollateralWad(address(market));
        assertEq(collateralAfterPlace, collateralBefore + o0.collateralDepositedWad);

        uint256 makerAvailAfterPlace = vault.availableUsdcWad(maker);
        assertEq(makerAvailAfterPlace, makerAvailBefore - o0.collateralDepositedWad);

        // Taker buys YES (outcome=1). Use quote for maxCost.
        (uint256 fillable, uint256 estCost, ) = tickBook.getQuote(marketKey, 1, 500 * WAD);
        assertGt(fillable, 0);
        uint256 maxCost = (estCost * 110) / 100;

        uint256 collateralBeforeTrade = vault.marketCollateralWad(address(market));
        vm.prank(taker);
        (uint256 filled, uint256 cost,) = tickBook.executeMarketOrder(marketKey, 1, 500 * WAD, maxCost);
        assertGt(filled, 0);
        assertGt(cost, 0);

        // Trade moves taker cost into market collateral
        uint256 collateralAfterTrade = vault.marketCollateralWad(address(market));
        assertEq(collateralAfterTrade, collateralBeforeTrade + cost);

        // Maker claims fills (should get NO shares for taker buying YES)
        vm.prank(maker);
        (uint256 makerFilled, uint256 makerCollateralUsed) = tickBook.claimFills(marketKey, orderId);
        // Allow 1 wei tolerance due to Q128.128 rounding
        assertApproxEqAbs(makerFilled, filled, 1);

        TickBookV2.RangeOrder memory o1 = tickBook.getOrder(marketKey, orderId);
        assertLe(o1.collateralUsedWad, o1.collateralDepositedWad);
        // Claim returns delta; order tracks cumulative
        assertEq(o1.filledShares, makerFilled);
        assertEq(o1.collateralUsedWad, makerCollateralUsed);

        // Internal outcome balances
        (uint256 takerYes, uint256 takerNo) = vault.getInternalOutcomes(address(market), taker);
        (uint256 makerYes, uint256 makerNo) = vault.getInternalOutcomes(address(market), maker);
        assertApproxEqAbs(takerYes, filled, 1);
        assertEq(takerNo, 0);
        assertApproxEqAbs(makerNo, filled, 1);
        assertEq(makerYes, 0);

        // Solvency: market collateral must cover worst-case payout (max outstanding side)
        uint256 totalYes = takerYes + makerYes;
        uint256 totalNo = takerNo + makerNo;
        uint256 maxOutstanding = totalYes > totalNo ? totalYes : totalNo;
        uint256 marketCollateral = vault.marketCollateralWad(address(market));
        assertGe(marketCollateral, maxOutstanding);

        // Cancel remaining order and ensure refund equals deposited - used
        uint256 makerAvailBeforeCancel = vault.availableUsdcWad(maker);
        vm.prank(maker);
        (uint256 refundWad, ) = tickBook.cancelOrder(marketKey, orderId);
        assertEq(refundWad, o1.collateralDepositedWad - o1.collateralUsedWad);

        uint256 makerAvailAfterCancel = vault.availableUsdcWad(maker);
        assertEq(makerAvailAfterCancel, makerAvailBeforeCancel + refundWad);
    }
}


