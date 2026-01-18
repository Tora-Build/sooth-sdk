// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {TickBookVault} from "@core/TickBookVault.sol";
import {TruthMarket} from "@core/TruthMarket.sol";
import {OutcomeToken} from "@core/OutcomeToken.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";

contract TickBookVaultTest is Test {
    TickBookVault public vault;
    ERC20Mock public usdc;
    TruthMarket public market;

    address public owner = address(0x1);
    address public tickBook = address(0x2);
    address public user1 = address(0xA);
    address public user2 = address(0xB);
    address public adjudicator = address(0xAD7);
    address public guardian = address(0x6A2D);

    uint256 constant WAD = 1e18;

    function setUp() public {
        usdc = new ERC20Mock();

        vault = new TickBookVault(address(usdc), owner);

        vm.prank(owner);
        vault.setTickBook(tickBook);

        market = new TruthMarket(
            "Test market?",
            uint64(block.timestamp),
            uint64(block.timestamp + 30 days),
            adjudicator,
            guardian,
            owner
        );

        deal(address(usdc), user1, 10_000 * WAD);
        deal(address(usdc), user2, 10_000 * WAD);
    }

    function test_Constructor_SetsUsdcAndOwner() public view {
        assertEq(address(vault.usdc()), address(usdc));
        assertEq(vault.owner(), owner);
    }

    function test_Constructor_RevertWhenZeroUsdc() public {
        vm.expectRevert("TickBookVault: zero usdc");
        new TickBookVault(address(0), owner);
    }

    function test_SetTickBook_OnlyOwner() public {
        address newTickBook = address(0x999);
        vm.prank(owner);
        vault.setTickBook(newTickBook);
        assertEq(vault.tickBook(), newTickBook);
    }

    function test_SetTickBook_RevertWhenNotOwner() public {
        vm.prank(user1);
        vm.expectRevert();
        vault.setTickBook(address(0x999));
    }

    function test_SetTickBook_RevertWhenZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert("TickBookVault: zero tickBook");
        vault.setTickBook(address(0));
    }

    function test_DepositUsdc_IncreasesAvailable() public {
        uint256 depositAmount = 1000 * WAD;

        vm.startPrank(user1);
        usdc.approve(address(vault), depositAmount);
        vault.depositUsdc(depositAmount);
        vm.stopPrank();

        assertEq(vault.availableUsdcWad(user1), depositAmount);
    }

    function test_DepositUsdc_RevertWhenZeroAmount() public {
        vm.prank(user1);
        vm.expectRevert("TickBookVault: zero amount");
        vault.depositUsdc(0);
    }

    function test_WithdrawUsdc_DecreasesAvailable() public {
        uint256 depositAmount = 1000 * WAD;
        uint256 withdrawWad = 500 * WAD;

        vm.startPrank(user1);
        usdc.approve(address(vault), depositAmount);
        vault.depositUsdc(depositAmount);

        uint256 availableBefore = vault.availableUsdcWad(user1);
        vault.withdrawUsdc(withdrawWad);
        vm.stopPrank();

        assertEq(vault.availableUsdcWad(user1), availableBefore - withdrawWad);
        assertEq(usdc.balanceOf(user1), 10_000 * WAD - depositAmount + withdrawWad);
    }

    function test_WithdrawUsdc_RevertWhenZeroAmount() public {
        vm.prank(user1);
        vm.expectRevert("TickBookVault: zero amount");
        vault.withdrawUsdc(0);
    }

    function test_WithdrawUsdc_RevertWhenInsufficientAvailable() public {
        vm.prank(user1);
        vm.expectRevert("TickBookVault: insufficient available");
        vault.withdrawUsdc(1 * WAD);
    }

    function test_ReserveUsdc_MovesFromAvailableToReserved() public {
        uint256 depositAmount = 1000 * WAD;
        uint256 reserveWad = 300 * WAD;

        vm.startPrank(user1);
        usdc.approve(address(vault), depositAmount);
        vault.depositUsdc(depositAmount);
        vm.stopPrank();

        uint256 availableBefore = vault.availableUsdcWad(user1);

        vm.prank(tickBook);
        vault.reserveUsdc(user1, reserveWad);

        assertEq(vault.availableUsdcWad(user1), availableBefore - reserveWad);
        assertEq(vault.reservedUsdcWad(user1), reserveWad);
    }

    function test_ReserveUsdc_RevertWhenNotTickBook() public {
        vm.prank(user1);
        vm.expectRevert("TickBookVault: only tickBook");
        vault.reserveUsdc(user1, 100 * WAD);
    }

    function test_ReleaseUsdc_MovesFromReservedToAvailable() public {
        uint256 depositAmount = 1000 * WAD;
        uint256 reserveWad = 300 * WAD;
        uint256 releaseWad = 100 * WAD;

        vm.startPrank(user1);
        usdc.approve(address(vault), depositAmount);
        vault.depositUsdc(depositAmount);
        vm.stopPrank();

        vm.prank(tickBook);
        vault.reserveUsdc(user1, reserveWad);

        uint256 reservedBefore = vault.reservedUsdcWad(user1);
        uint256 availableBefore = vault.availableUsdcWad(user1);

        vm.prank(tickBook);
        vault.releaseUsdc(user1, releaseWad);

        assertEq(vault.reservedUsdcWad(user1), reservedBefore - releaseWad);
        assertEq(vault.availableUsdcWad(user1), availableBefore + releaseWad);
    }

    function test_SpendReservedToMarket_MovesToMarketCollateral() public {
        uint256 depositAmount = 1000 * WAD;
        uint256 reserveWad = 300 * WAD;
        uint256 spendWad = 200 * WAD;

        vm.startPrank(user1);
        usdc.approve(address(vault), depositAmount);
        vault.depositUsdc(depositAmount);
        vm.stopPrank();

        vm.prank(tickBook);
        vault.reserveUsdc(user1, reserveWad);

        vm.prank(tickBook);
        vault.spendReservedToMarket(user1, address(market), spendWad);

        assertEq(vault.reservedUsdcWad(user1), reserveWad - spendWad);
        assertEq(vault.marketCollateralWad(address(market)), spendWad);
    }

    function test_SpendAvailableToMarket_MovesToMarketCollateral() public {
        uint256 depositAmount = 1000 * WAD;
        uint256 spendWad = 200 * WAD;

        vm.startPrank(user1);
        usdc.approve(address(vault), depositAmount);
        vault.depositUsdc(depositAmount);
        vm.stopPrank();

        uint256 availableBefore = vault.availableUsdcWad(user1);

        vm.prank(tickBook);
        vault.spendAvailableToMarket(user1, address(market), spendWad);

        assertEq(vault.availableUsdcWad(user1), availableBefore - spendWad);
        assertEq(vault.marketCollateralWad(address(market)), spendWad);
    }

    function test_CreditOutcome_IncreasesYesShares() public {
        uint256 sharesWad = 100 * WAD;

        vm.prank(tickBook);
        vault.creditOutcome(address(market), user1, 1, sharesWad);

        (uint256 yes, uint256 no) = vault.getInternalOutcomes(address(market), user1);
        assertEq(yes, sharesWad);
        assertEq(no, 0);
    }

    function test_CreditOutcome_IncreasesNoShares() public {
        uint256 sharesWad = 100 * WAD;

        vm.prank(tickBook);
        vault.creditOutcome(address(market), user1, 0, sharesWad);

        (uint256 yes, uint256 no) = vault.getInternalOutcomes(address(market), user1);
        assertEq(yes, 0);
        assertEq(no, sharesWad);
    }

    function test_CreditOutcome_RevertWhenInvalidOutcome() public {
        vm.prank(tickBook);
        vm.expectRevert("TickBookVault: invalid outcome");
        vault.creditOutcome(address(market), user1, 2, 100 * WAD);
    }

    function test_LockOutcome_MovesFromInternalToLocked() public {
        uint256 sharesWad = 100 * WAD;
        uint256 lockWad = 50 * WAD;

        vm.prank(tickBook);
        vault.creditOutcome(address(market), user1, 1, sharesWad);

        vm.prank(tickBook);
        vault.lockOutcome(address(market), user1, 1, lockWad);

        (uint256 yes, ) = vault.getInternalOutcomes(address(market), user1);
        uint256 locked = vault.getLockedOutcome(address(market), user1, 1);

        assertEq(yes, sharesWad - lockWad);
        assertEq(locked, lockWad);
    }

    function test_LockOutcome_RevertWhenInsufficientShares() public {
        vm.prank(tickBook);
        vm.expectRevert("TickBookVault: insufficient YES");
        vault.lockOutcome(address(market), user1, 1, 100 * WAD);
    }

    function test_UnlockOutcome_MovesFromLockedToInternal() public {
        uint256 sharesWad = 100 * WAD;
        uint256 lockWad = 50 * WAD;
        uint256 unlockWad = 30 * WAD;

        vm.prank(tickBook);
        vault.creditOutcome(address(market), user1, 1, sharesWad);

        vm.prank(tickBook);
        vault.lockOutcome(address(market), user1, 1, lockWad);

        vm.prank(tickBook);
        vault.unlockOutcome(address(market), user1, 1, unlockWad);

        (uint256 yes, ) = vault.getInternalOutcomes(address(market), user1);
        uint256 locked = vault.getLockedOutcome(address(market), user1, 1);

        assertEq(yes, sharesWad - lockWad + unlockWad);
        assertEq(locked, lockWad - unlockWad);
    }

    function test_UnlockOutcome_RevertWhenInsufficientLocked() public {
        vm.prank(tickBook);
        vm.expectRevert("TickBookVault: insufficient locked YES");
        vault.unlockOutcome(address(market), user1, 1, 100 * WAD);
    }

    function test_TransferLockedOutcome_MovesFromSellerTobuyer() public {
        uint256 sharesWad = 100 * WAD;
        uint256 lockWad = 50 * WAD;
        uint256 transferWad = 30 * WAD;

        vm.prank(tickBook);
        vault.creditOutcome(address(market), user1, 1, sharesWad);

        vm.prank(tickBook);
        vault.lockOutcome(address(market), user1, 1, lockWad);

        vm.prank(tickBook);
        vault.transferLockedOutcome(address(market), user1, user2, 1, transferWad);

        uint256 sellerLocked = vault.getLockedOutcome(address(market), user1, 1);
        (uint256 buyerYes, ) = vault.getInternalOutcomes(address(market), user2);

        assertEq(sellerLocked, lockWad - transferWad);
        assertEq(buyerYes, transferWad);
    }

    function test_TransferLockedOutcome_RevertWhenInsufficientLocked() public {
        vm.prank(tickBook);
        vm.expectRevert("TickBookVault: insufficient locked YES");
        vault.transferLockedOutcome(address(market), user1, user2, 1, 100 * WAD);
    }

    function test_CreditUsdcAvailable_IncreasesAvailable() public {
        uint256 creditWad = 100 * WAD;

        vm.prank(tickBook);
        vault.creditUsdcAvailable(user1, creditWad);

        assertEq(vault.availableUsdcWad(user1), creditWad);
    }

    function test_RefundMarketToAvailable_MovesFromMarketToUser() public {
        uint256 depositAmount = 1000 * WAD;
        uint256 spendWad = 200 * WAD;
        uint256 refundWad = 100 * WAD;

        vm.startPrank(user1);
        usdc.approve(address(vault), depositAmount);
        vault.depositUsdc(depositAmount);
        vm.stopPrank();

        vm.prank(tickBook);
        vault.spendAvailableToMarket(user1, address(market), spendWad);

        uint256 marketBefore = vault.marketCollateralWad(address(market));
        uint256 availableBefore = vault.availableUsdcWad(user1);

        vm.prank(tickBook);
        vault.refundMarketToAvailable(address(market), user1, refundWad);

        assertEq(vault.marketCollateralWad(address(market)), marketBefore - refundWad);
        assertEq(vault.availableUsdcWad(user1), availableBefore + refundWad);
    }

    function test_TransferFee_MovesFromMarketToRecipient() public {
        uint256 depositAmount = 1000 * WAD;
        uint256 spendWad = 200 * WAD;
        uint256 feeWad = 10 * WAD;
        address feeRecipient = address(0xFEE);

        vm.startPrank(user1);
        usdc.approve(address(vault), depositAmount);
        vault.depositUsdc(depositAmount);
        vm.stopPrank();

        vm.prank(tickBook);
        vault.spendAvailableToMarket(user1, address(market), spendWad);

        uint256 marketBefore = vault.marketCollateralWad(address(market));

        vm.prank(tickBook);
        vault.transferFee(address(market), feeRecipient, feeWad);

        assertEq(vault.marketCollateralWad(address(market)), marketBefore - feeWad);
        assertEq(usdc.balanceOf(feeRecipient), feeWad); // 18 decimals -> 18 decimals
    }

    function test_TransferFee_RevertWhenZeroRecipient() public {
        vm.prank(tickBook);
        vm.expectRevert("TickBookVault: zero recipient");
        vault.transferFee(address(market), address(0), 10 * WAD);
    }

    function test_RedeemResolved_YesWins() public {
        uint256 sharesWad = 100 * WAD;
        uint256 collateralWad = 100 * WAD;

        vm.startPrank(user1);
        usdc.approve(address(vault), 1000 * WAD);
        vault.depositUsdc(1000 * WAD);
        vm.stopPrank();

        vm.prank(tickBook);
        vault.spendAvailableToMarket(user1, address(market), collateralWad);

        vm.prank(tickBook);
        vault.creditOutcome(address(market), user2, 1, sharesWad);

        vm.prank(adjudicator);
        market.settle(1, 0);

        vm.prank(user2);
        uint256 payout = vault.redeemResolved(address(market));

        assertEq(payout, sharesWad);
        assertEq(vault.availableUsdcWad(user2), sharesWad);
    }

    function test_RedeemResolved_NoWins() public {
        uint256 sharesWad = 100 * WAD;
        uint256 collateralWad = 100 * WAD;

        vm.startPrank(user1);
        usdc.approve(address(vault), 1000 * WAD);
        vault.depositUsdc(1000 * WAD);
        vm.stopPrank();

        vm.prank(tickBook);
        vault.spendAvailableToMarket(user1, address(market), collateralWad);

        vm.prank(tickBook);
        vault.creditOutcome(address(market), user2, 0, sharesWad);

        vm.prank(adjudicator);
        market.settle(0, 0);

        vm.prank(user2);
        uint256 payout = vault.redeemResolved(address(market));

        assertEq(payout, sharesWad);
    }

    function test_RedeemResolved_InvalidOutcome() public {
        uint256 yesSharesWad = 100 * WAD;
        uint256 noSharesWad = 60 * WAD;
        uint256 collateralWad = 160 * WAD;

        vm.startPrank(user1);
        usdc.approve(address(vault), 1000 * WAD);
        vault.depositUsdc(1000 * WAD);
        vm.stopPrank();

        vm.prank(tickBook);
        vault.spendAvailableToMarket(user1, address(market), collateralWad);

        vm.prank(tickBook);
        vault.creditOutcome(address(market), user2, 1, yesSharesWad);
        vm.prank(tickBook);
        vault.creditOutcome(address(market), user2, 0, noSharesWad);

        vm.prank(adjudicator);
        market.settle(2, 0);

        vm.prank(user2);
        uint256 payout = vault.redeemResolved(address(market));

        // 100 YES * 0.5 + 60 NO * 0.5 = 50 + 30 = 80
        assertEq(payout, 80 * WAD);
    }

    function test_RedeemResolved_RevertWhenNotSettled() public {
        vm.prank(tickBook);
        vault.creditOutcome(address(market), user2, 1, 100 * WAD);

        vm.prank(user2);
        vm.expectRevert("TickBookVault: not settled");
        vault.redeemResolved(address(market));
    }

    function test_RedeemResolved_RevertWhenNoPosition() public {
        vm.prank(adjudicator);
        market.settle(1, 0);

        vm.prank(user2);
        vm.expectRevert("TickBookVault: no position");
        vault.redeemResolved(address(market));
    }

    function test_OnlyTickBook_ModifierBlocksUnauthorized() public {
        vm.prank(user1);
        vm.expectRevert("TickBookVault: only tickBook");
        vault.reserveUsdc(user1, 100 * WAD);

        vm.prank(user1);
        vm.expectRevert("TickBookVault: only tickBook");
        vault.releaseUsdc(user1, 100 * WAD);

        vm.prank(user1);
        vm.expectRevert("TickBookVault: only tickBook");
        vault.creditOutcome(address(market), user1, 1, 100 * WAD);

        vm.prank(user1);
        vm.expectRevert("TickBookVault: only tickBook");
        vault.lockOutcome(address(market), user1, 1, 100 * WAD);

        vm.prank(user1);
        vm.expectRevert("TickBookVault: only tickBook");
        vault.unlockOutcome(address(market), user1, 1, 100 * WAD);

        vm.prank(user1);
        vm.expectRevert("TickBookVault: only tickBook");
        vault.transferLockedOutcome(address(market), user1, user2, 1, 100 * WAD);

        vm.prank(user1);
        vm.expectRevert("TickBookVault: only tickBook");
        vault.creditUsdcAvailable(user1, 100 * WAD);
    }
}
