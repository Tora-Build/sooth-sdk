// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {SoothBook} from "@core/SoothBook.sol";
import {OutcomeToken} from "@core/OutcomeToken.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";

contract SoothBookTest is Test {
    SoothBook public book;
    ERC20Mock public usdc;
    OutcomeToken public yesToken;
    OutcomeToken public noToken;

    address public owner = address(this);
    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);
    address public carol = address(0xCA201);

    bytes32 public marketKey = keccak256("test-market");

    uint256 constant WAD = 1e18;

    function setUp() public {
        usdc = new ERC20Mock();
        book = new SoothBook();

        // Factory creates market + deploys YES/NO tokens
        (address yesAddr, address noAddr) = book.createMarket(marketKey, address(usdc), "Test Market");
        yesToken = OutcomeToken(yesAddr);
        noToken = OutcomeToken(noAddr);

        // Fund users
        usdc.mint(alice, 1000 * WAD);
        usdc.mint(bob, 1000 * WAD);
        usdc.mint(carol, 1000 * WAD);

        vm.prank(alice);
        usdc.approve(address(book), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(book), type(uint256).max);
        vm.prank(carol);
        usdc.approve(address(book), type(uint256).max);
    }

    // ============================================
    // Mint Tests
    // ============================================

    function test_mint_basic() public {
        vm.prank(alice);
        book.mint(marketKey, 100 * WAD);

        assertEq(yesToken.balanceOf(alice), 100 * WAD, "YES balance");
        assertEq(noToken.balanceOf(alice), 100 * WAD, "NO balance");
        assertEq(usdc.balanceOf(alice), 900 * WAD, "USDC spent");
        assertEq(book.getCollateralBacking(marketKey), 100 * WAD, "backing");
    }

    function test_mint_zero_reverts() public {
        vm.prank(alice);
        vm.expectRevert(SoothBook.ZeroAmount.selector);
        book.mint(marketKey, 0);
    }

    function test_mint_insufficient_balance_reverts() public {
        vm.prank(alice);
        vm.expectRevert();
        book.mint(marketKey, 2000 * WAD);
    }

    // ============================================
    // Merge Tests
    // ============================================

    function test_merge_basic() public {
        vm.startPrank(alice);
        book.mint(marketKey, 100 * WAD);
        book.merge(marketKey, 50 * WAD);
        vm.stopPrank();

        assertEq(yesToken.balanceOf(alice), 50 * WAD, "YES after merge");
        assertEq(noToken.balanceOf(alice), 50 * WAD, "NO after merge");
        assertEq(usdc.balanceOf(alice), 950 * WAD, "USDC returned");
        assertEq(book.getCollateralBacking(marketKey), 50 * WAD, "backing after merge");
    }

    function test_merge_full() public {
        vm.startPrank(alice);
        book.mint(marketKey, 100 * WAD);
        book.merge(marketKey, 100 * WAD);
        vm.stopPrank();

        assertEq(yesToken.balanceOf(alice), 0, "YES zero");
        assertEq(noToken.balanceOf(alice), 0, "NO zero");
        assertEq(usdc.balanceOf(alice), 1000 * WAD, "USDC fully returned");
        assertEq(book.getCollateralBacking(marketKey), 0, "backing zero");
    }

    function test_merge_zero_reverts() public {
        vm.prank(alice);
        vm.expectRevert(SoothBook.ZeroAmount.selector);
        book.merge(marketKey, 0);
    }

    function test_merge_insufficient_reverts() public {
        vm.startPrank(alice);
        book.mint(marketKey, 50 * WAD);
        vm.expectRevert(); // burn will revert
        book.merge(marketKey, 100 * WAD);
        vm.stopPrank();
    }

    // ============================================
    // Buy YES Tests (no match)
    // ============================================

    function test_buyYes_resting_order() public {
        vm.prank(alice);
        book.buyYes(marketKey, 650, uint128(100 * WAD), false, 0);

        // Cost = 100 * 650/1000 = 65 WAD
        assertEq(usdc.balanceOf(alice), 935 * WAD, "USDC cost");

        (uint256 total, uint256 count) = book.getOrdersAtTick(marketKey, 1, 650);
        assertEq(total, 100 * WAD, "order amount");
        assertEq(count, 1, "order count");

        assertEq(book.getBestTick(marketKey, 1), 650, "best YES tick");
    }

    function test_buyNo_resting_order() public {
        vm.prank(bob);
        book.buyNo(marketKey, 400, uint128(100 * WAD), false, 0);

        // Cost = 100 * 400/1000 = 40 WAD
        assertEq(usdc.balanceOf(bob), 960 * WAD, "USDC cost");

        (uint256 total, uint256 count) = book.getOrdersAtTick(marketKey, 0, 400);
        assertEq(total, 100 * WAD, "order amount");
        assertEq(count, 1, "order count");

        assertEq(book.getBestTick(marketKey, 0), 400, "best NO tick");
    }

    function test_buyYes_invalid_tick_reverts() public {
        vm.prank(alice);
        vm.expectRevert(SoothBook.InvalidTick.selector);
        book.buyYes(marketKey, 0, uint128(100 * WAD), false, 0);
    }

    function test_buyYes_tick_too_high_reverts() public {
        vm.prank(alice);
        vm.expectRevert(SoothBook.InvalidTick.selector);
        book.buyYes(marketKey, 1000, uint128(100 * WAD), false, 0);
    }

    // ============================================
    // Auto-Match Tests
    // ============================================

    function test_autoMatch_exact() public {
        // Bob bids NO at 400 (resting)
        vm.prank(bob);
        book.buyNo(marketKey, 400, uint128(100 * WAD), false, 0);

        // Alice bids YES at 600 → 600 + 400 = 1000, exact match, no surplus
        vm.prank(alice);
        book.buyYes(marketKey, 600, uint128(100 * WAD), false, 0);

        // Both get their tokens
        assertEq(yesToken.balanceOf(alice), 100 * WAD, "alice YES");
        assertEq(noToken.balanceOf(bob), 100 * WAD, "bob NO");

        // No resting orders
        (uint256 yesTotal,) = book.getOrdersAtTick(marketKey, 1, 600);
        (uint256 noTotal,) = book.getOrdersAtTick(marketKey, 0, 400);
        assertEq(yesTotal, 0, "no resting YES");
        assertEq(noTotal, 0, "no resting NO");
    }

    function test_autoMatch_with_surplus_to_taker() public {
        // Bob bids NO at 400 (resting)
        vm.prank(bob);
        book.buyNo(marketKey, 400, uint128(100 * WAD), false, 0);

        // Alice bids YES at 650 → 650 + 400 = 1050, surplus = 50 ticks
        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        book.buyYes(marketKey, 650, uint128(100 * WAD), false, 0);

        // Alice gets YES tokens
        assertEq(yesToken.balanceOf(alice), 100 * WAD, "alice YES");
        // Bob gets NO tokens
        assertEq(noToken.balanceOf(bob), 100 * WAD, "bob NO");

        // Alice paid 65 WAD but gets 5 WAD surplus back
        // Net cost = 60 WAD
        uint256 aliceSpent = aliceBefore - usdc.balanceOf(alice);
        assertEq(aliceSpent, 60 * WAD, "alice net cost (after surplus)");
    }

    function test_autoMatch_partial() public {
        // Bob bids NO at 400, 50 shares
        vm.prank(bob);
        book.buyNo(marketKey, 400, uint128(50 * WAD), false, 0);

        // Alice bids YES at 650, 100 shares → fills 50, rests 50
        vm.prank(alice);
        book.buyYes(marketKey, 650, uint128(100 * WAD), false, 0);

        assertEq(yesToken.balanceOf(alice), 50 * WAD, "alice YES (filled)");
        assertEq(noToken.balanceOf(bob), 50 * WAD, "bob NO");

        // 50 shares resting
        (uint256 restingTotal,) = book.getOrdersAtTick(marketKey, 1, 650);
        assertEq(restingTotal, 50 * WAD, "resting YES");
    }

    function test_autoMatch_no_match_below_threshold() public {
        // Bob bids NO at 300
        vm.prank(bob);
        book.buyNo(marketKey, 300, uint128(100 * WAD), false, 0);

        // Alice bids YES at 600 → 600 + 300 = 900 < 1000, no match
        vm.prank(alice);
        book.buyYes(marketKey, 600, uint128(100 * WAD), false, 0);

        // No fills
        assertEq(yesToken.balanceOf(alice), 0, "no alice YES");
        assertEq(noToken.balanceOf(bob), 0, "no bob NO");

        // Both resting
        (uint256 yesResting,) = book.getOrdersAtTick(marketKey, 1, 600);
        (uint256 noResting,) = book.getOrdersAtTick(marketKey, 0, 300);
        assertEq(yesResting, 100 * WAD, "YES resting");
        assertEq(noResting, 100 * WAD, "NO resting");
    }

    function test_autoMatch_multiple_makers() public {
        // Bob bids NO at 400, 60 shares
        vm.prank(bob);
        book.buyNo(marketKey, 400, uint128(60 * WAD), false, 0);
        // Carol bids NO at 450, 40 shares
        vm.prank(carol);
        book.buyNo(marketKey, 450, uint128(40 * WAD), false, 0);

        // Alice bids YES at 600, 100 shares
        // Matches carol@450 first (highest), then bob@400
        vm.prank(alice);
        book.buyYes(marketKey, 600, uint128(100 * WAD), false, 0);

        assertEq(yesToken.balanceOf(alice), 100 * WAD, "alice gets all 100 YES");
        assertEq(noToken.balanceOf(carol), 40 * WAD, "carol gets 40 NO");
        assertEq(noToken.balanceOf(bob), 60 * WAD, "bob gets 60 NO");
    }

    function test_autoMatch_multiple_ticks() public {
        // Bob at 350, carol at 450
        vm.prank(bob);
        book.buyNo(marketKey, 350, uint128(50 * WAD), false, 0);
        vm.prank(carol);
        book.buyNo(marketKey, 450, uint128(50 * WAD), false, 0);

        // Alice at 650 → matches carol (650+450=1100 ✓), then bob (650+350=1000 ✓)
        vm.prank(alice);
        book.buyYes(marketKey, 650, uint128(100 * WAD), false, 0);

        assertEq(yesToken.balanceOf(alice), 100 * WAD, "alice YES");
        assertEq(noToken.balanceOf(carol), 50 * WAD, "carol NO");
        assertEq(noToken.balanceOf(bob), 50 * WAD, "bob NO");
    }

    // ============================================
    // Escrow (Exit) Tests
    // ============================================

    function test_escrow_sell_yes() public {
        // Alice mints a set, then wants to sell YES
        vm.startPrank(alice);
        book.mint(marketKey, 100 * WAD);
        // Alice has 100 YES + 100 NO

        // Bob bids YES at 700 (resting maker)
        vm.stopPrank();
        vm.prank(bob);
        book.buyYes(marketKey, 700, uint128(100 * WAD), false, 0);

        // Alice sells YES by buying NO with escrow
        // She escrows her YES tokens, when matched she gets USDC back
        vm.prank(alice);
        book.buyNo(marketKey, 300, uint128(100 * WAD), true, 0);

        // Alice burned 100 YES (escrowed), match happened (700+300=1000)
        // Alice gets back: noTick price = 300/1000 * 100 = 30 WAD
        // But wait — Alice is the taker, so she gets takerTick (300) payout + surplus
        // yesTick=700, noTick=300, sum=1000, surplus=0
        assertEq(yesToken.balanceOf(alice), 0, "alice YES burned");
        assertEq(noToken.balanceOf(alice), 100 * WAD, "alice still has NO");
        // Alice started with 900 USDC (after mint), gets back 30 from escrow exit
        // Wait: she deposited 100 for mint. Now she gets takerPayout = 300*100/1000 = 30 WAD
        // Actually need to check: she spent 100 on mint, gets 30 back from selling YES
        // Total USDC: 1000 - 100 + 30 = 930
        assertEq(usdc.balanceOf(alice), 930 * WAD, "alice USDC after sell");

        // Bob gets his YES tokens
        assertEq(yesToken.balanceOf(bob), 100 * WAD, "bob YES");
    }

    function test_escrow_sell_no() public {
        // Bob mints, wants to sell NO
        vm.startPrank(bob);
        book.mint(marketKey, 100 * WAD);
        vm.stopPrank();

        // Alice bids NO at 400 (resting)
        vm.prank(alice);
        book.buyNo(marketKey, 400, uint128(100 * WAD), false, 0);

        // Bob sells NO by buying YES with escrow (escrow his NO tokens)
        vm.prank(bob);
        book.buyYes(marketKey, 600, uint128(100 * WAD), true, 0);

        // 600+400=1000, exact match
        // Bob escrowed NO, gets takerPayout = 600*100/1000 = 60 WAD
        assertEq(noToken.balanceOf(bob), 0, "bob NO burned");
        assertEq(yesToken.balanceOf(bob), 100 * WAD, "bob still has YES");
        assertEq(usdc.balanceOf(bob), 960 * WAD, "bob USDC: 1000-100+60");

        assertEq(noToken.balanceOf(alice), 100 * WAD, "alice NO");
    }

    function test_escrow_with_surplus() public {
        // Alice mints 100
        vm.prank(alice);
        book.mint(marketKey, 100 * WAD);

        // Bob bids YES at 700
        vm.prank(bob);
        book.buyYes(marketKey, 700, uint128(100 * WAD), false, 0);

        // Alice sells YES by escrowing, buyNo at 200 → 700+200=900 < 1000? No!
        // Wait: 700 + 200 = 900 < 1000, won't match. Let's use 350 instead.
        // 700 + 350 = 1050 ≥ 1000 → matches! Surplus = 50 ticks

        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        book.buyNo(marketKey, 350, uint128(100 * WAD), true, 0);

        // Alice escrowed YES (burned). Gets takerPayout = 350*100/1000 = 35 WAD
        // Plus surplus = (700+350-1000)*100/1000 = 50*100/1000 = 5 WAD
        // Total back to Alice: 35 + 5 = 40 WAD
        uint256 aliceReceived = usdc.balanceOf(alice) - aliceBefore;
        assertEq(aliceReceived, 40 * WAD, "alice gets payout + surplus");
    }

    function test_escrow_cancel_returns_tokens() public {
        vm.startPrank(alice);
        book.mint(marketKey, 100 * WAD);
        // Alice has 100 YES + 100 NO

        // Place escrow order (burns YES)
        book.buyNo(marketKey, 400, uint128(50 * WAD), true, 0);
        assertEq(yesToken.balanceOf(alice), 50 * WAD, "50 YES escrowed/burned");

        // Cancel → gets YES back
        book.cancel(marketKey, 0, 400);
        assertEq(yesToken.balanceOf(alice), 100 * WAD, "YES restored");
        vm.stopPrank();
    }

    function test_escrow_insufficient_tokens_reverts() public {
        // Alice has no tokens, tries escrow
        vm.prank(alice);
        vm.expectRevert(); // burn will fail
        book.buyNo(marketKey, 400, uint128(100 * WAD), true, 0);
    }

    // ============================================
    // Cancel Tests
    // ============================================

    function test_cancel_normal_order() public {
        vm.startPrank(alice);
        book.buyYes(marketKey, 650, uint128(100 * WAD), false, 0);
        // Paid 65 WAD

        uint256 before = usdc.balanceOf(alice);
        book.cancel(marketKey, 1, 650);
        uint256 refund = usdc.balanceOf(alice) - before;
        assertEq(refund, 65 * WAD, "full collateral refunded");

        (uint256 total,) = book.getOrdersAtTick(marketKey, 1, 650);
        assertEq(total, 0, "order removed");
        vm.stopPrank();
    }

    function test_cancel_no_order_reverts() public {
        vm.prank(alice);
        vm.expectRevert(SoothBook.OrderNotActive.selector);
        book.cancel(marketKey, 1, 500);
    }

    function test_cancel_not_owner_reverts() public {
        vm.prank(alice);
        book.buyYes(marketKey, 650, uint128(100 * WAD), false, 0);

        vm.prank(bob);
        vm.expectRevert(SoothBook.OrderNotActive.selector);
        book.cancel(marketKey, 1, 650);
    }

    // ============================================
    // Redeem Tests
    // ============================================

    function test_redeem_yes_wins() public {
        vm.prank(alice);
        book.mint(marketKey, 100 * WAD);

        book.resolveMarket(marketKey, 1); // YES wins

        vm.prank(alice);
        book.redeem(marketKey);

        assertEq(yesToken.balanceOf(alice), 0, "YES burned");
        assertEq(noToken.balanceOf(alice), 0, "NO burned");
        // Payout = 100 YES * 1 = 100 WAD
        assertEq(usdc.balanceOf(alice), 1000 * WAD, "full payout");
    }

    function test_redeem_no_wins() public {
        vm.prank(alice);
        book.mint(marketKey, 100 * WAD);

        book.resolveMarket(marketKey, 0); // NO wins

        vm.prank(alice);
        book.redeem(marketKey);

        assertEq(usdc.balanceOf(alice), 1000 * WAD, "full payout (NO wins)");
    }

    function test_redeem_invalid_5050() public {
        vm.prank(alice);
        book.mint(marketKey, 100 * WAD);

        book.resolveMarket(marketKey, 2); // Invalid

        vm.prank(alice);
        book.redeem(marketKey);

        // 50/50: (100 + 100) / 2 = 100
        assertEq(usdc.balanceOf(alice), 1000 * WAD, "50/50 payout");
    }

    function test_redeem_only_winning_side() public {
        // Alice mints, sends NO to bob
        vm.startPrank(alice);
        book.mint(marketKey, 100 * WAD);
        noToken.transfer(bob, 100 * WAD);
        vm.stopPrank();

        book.resolveMarket(marketKey, 1); // YES wins

        vm.prank(alice);
        book.redeem(marketKey);
        assertEq(usdc.balanceOf(alice), 1000 * WAD, "alice gets 100 back (YES wins)");

        vm.prank(bob);
        book.redeem(marketKey);
        assertEq(usdc.balanceOf(bob), 1000 * WAD, "bob gets 0 (NO loses)");
    }

    function test_redeem_not_finalized_reverts() public {
        vm.prank(alice);
        book.mint(marketKey, 100 * WAD);

        vm.prank(alice);
        vm.expectRevert(SoothBook.MarketNotFinalized.selector);
        book.redeem(marketKey);
    }

    function test_redeem_no_balance_reverts() public {
        book.resolveMarket(marketKey, 1);

        vm.prank(alice);
        vm.expectRevert(SoothBook.NothingToRedeem.selector);
        book.redeem(marketKey);
    }

    // ============================================
    // Token Transferability Tests
    // ============================================

    function test_tokens_transferable() public {
        vm.prank(alice);
        book.mint(marketKey, 100 * WAD);

        vm.prank(alice);
        yesToken.transfer(bob, 50 * WAD);

        assertEq(yesToken.balanceOf(alice), 50 * WAD);
        assertEq(yesToken.balanceOf(bob), 50 * WAD);
    }

    function test_transferred_tokens_redeemable() public {
        vm.prank(alice);
        book.mint(marketKey, 100 * WAD);

        vm.prank(alice);
        yesToken.transfer(bob, 100 * WAD);

        book.resolveMarket(marketKey, 1); // YES wins

        // Bob redeems alice's YES
        vm.prank(bob);
        book.redeem(marketKey);
        assertEq(usdc.balanceOf(bob), 1100 * WAD, "bob gets 100 payout");

        // Alice redeems her NO (worth 0)
        vm.prank(alice);
        book.redeem(marketKey);
        assertEq(usdc.balanceOf(alice), 900 * WAD, "alice gets 0");
    }

    // ============================================
    // View Tests
    // ============================================

    function test_getImpliedPrice() public {
        vm.prank(alice);
        book.buyYes(marketKey, 650, uint128(100 * WAD), false, 0);
        vm.prank(bob);
        book.buyNo(marketKey, 300, uint128(100 * WAD), false, 0);

        (uint256 yesPrice, uint256 noPrice) = book.getImpliedPrice(marketKey);
        assertEq(yesPrice, (650 * WAD) / 1000, "YES price");
        assertEq(noPrice, (300 * WAD) / 1000, "NO price");
    }

    function test_getBalance() public {
        vm.prank(alice);
        book.mint(marketKey, 100 * WAD);

        (uint256 yes, uint256 no) = book.getBalance(marketKey, alice);
        assertEq(yes, 100 * WAD);
        assertEq(no, 100 * WAD);
    }

    // ============================================
    // Slippage Protection Tests
    // ============================================

    function test_slippage_protection() public {
        vm.prank(alice);
        vm.expectRevert(SoothBook.SlippageExceeded.selector);
        // 100 * 650/1000 = 65 WAD, but maxCost = 50
        book.buyYes(marketKey, 650, uint128(100 * WAD), false, 50 * WAD);
    }

    // ============================================
    // Edge Cases
    // ============================================

    function test_min_tick() public {
        vm.prank(alice);
        book.buyYes(marketKey, 1, uint128(100 * WAD), false, 0);
        // Cost = 100 * 1/1000 = 0.1 WAD
        (uint256 total,) = book.getOrdersAtTick(marketKey, 1, 1);
        assertEq(total, 100 * WAD);
    }

    function test_max_tick() public {
        vm.prank(alice);
        book.buyYes(marketKey, 999, uint128(100 * WAD), false, 0);
        // Cost = 100 * 999/1000 = 99.9 WAD
        (uint256 total,) = book.getOrdersAtTick(marketKey, 1, 999);
        assertEq(total, 100 * WAD);
    }

    function test_market_not_active_reverts() public {
        bytes32 fake = keccak256("nonexistent");
        vm.prank(alice);
        vm.expectRevert(SoothBook.MarketNotActive.selector);
        book.buyYes(fake, 500, uint128(100 * WAD), false, 0);
    }

    function test_buy_after_resolve_reverts() public {
        book.resolveMarket(marketKey, 1);
        vm.prank(alice);
        vm.expectRevert(SoothBook.MarketNotActive.selector);
        book.buyYes(marketKey, 500, uint128(100 * WAD), false, 0);
    }

    function test_mint_after_resolve_reverts() public {
        book.resolveMarket(marketKey, 1);
        vm.prank(alice);
        vm.expectRevert(SoothBook.MarketNotActive.selector);
        book.mint(marketKey, 100 * WAD);
    }

    // ============================================
    // Full Flow: Buy → Trade → Redeem
    // ============================================

    function test_full_flow_buy_trade_redeem() public {
        // 1. Alice buys YES at 600 (deposits 60)
        vm.prank(alice);
        book.buyYes(marketKey, 600, uint128(100 * WAD), false, 0);

        // 2. Bob buys NO at 450 (deposits 45) → matches! 600+450=1050
        vm.prank(bob);
        book.buyNo(marketKey, 450, uint128(100 * WAD), false, 0);

        // Both get tokens, bob (taker) gets surplus
        assertEq(yesToken.balanceOf(alice), 100 * WAD, "alice YES");
        assertEq(noToken.balanceOf(bob), 100 * WAD, "bob NO");

        // 3. YES wins
        book.resolveMarket(marketKey, 1);

        // 4. Alice redeems (winner)
        vm.prank(alice);
        book.redeem(marketKey);

        // 5. Bob redeems (loser, gets 0)
        vm.prank(bob);
        book.redeem(marketKey);

        // Alice profit: paid 60, got 100 back → +40
        // Bob loss: paid 45 (- 5 surplus = 40 net), got 0 → -40
        assertGt(usdc.balanceOf(alice), 1000 * WAD, "alice profited");
    }

    function test_full_flow_mint_sell_exit() public {
        // 1. Alice mints 100 sets (100 YES + 100 NO)
        vm.prank(alice);
        book.mint(marketKey, 100 * WAD);

        // 2. Bob wants to buy YES at 700
        vm.prank(bob);
        book.buyYes(marketKey, 700, uint128(100 * WAD), false, 0);

        // 3. Alice sells her YES via escrow buyNo at 350 → matches bob's 700
        // 700 + 350 = 1050, surplus = 5 WAD to alice (taker)
        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        book.buyNo(marketKey, 350, uint128(100 * WAD), true, 0);

        // Alice exits YES at effectively 700 tick (gets takerPayout 35 + surplus 5 = 40)
        // She still holds 100 NO
        assertEq(yesToken.balanceOf(alice), 0, "YES sold");
        assertEq(noToken.balanceOf(alice), 100 * WAD, "NO kept");
        uint256 aliceGain = usdc.balanceOf(alice) - aliceBefore;
        assertEq(aliceGain, 40 * WAD, "exit proceeds");

        // 4. NO wins → Alice redeems NO for 100
        book.resolveMarket(marketKey, 0);
        vm.prank(alice);
        book.redeem(marketKey);

        // Alice total: started 1000, spent 100 (mint), got 40 (sell YES), got 100 (redeem NO) = 1040
        assertEq(usdc.balanceOf(alice), 1040 * WAD, "alice net profit");
    }

    // ============================================
    // FIFO Order Tests
    // ============================================

    function test_fifo_fill_order() public {
        // Alice and Carol both bid NO at same tick
        vm.prank(alice);
        book.buyNo(marketKey, 400, uint128(50 * WAD), false, 0);
        vm.prank(carol);
        book.buyNo(marketKey, 400, uint128(50 * WAD), false, 0);

        // Bob buys YES at 600, matches FIFO → alice first
        vm.prank(bob);
        book.buyYes(marketKey, 600, uint128(50 * WAD), false, 0);

        assertEq(noToken.balanceOf(alice), 50 * WAD, "alice filled first (FIFO)");
        assertEq(noToken.balanceOf(carol), 0, "carol not yet filled");

        // Second fill
        vm.prank(bob);
        book.buyYes(marketKey, 600, uint128(50 * WAD), false, 0);
        assertEq(noToken.balanceOf(carol), 50 * WAD, "carol filled second");
    }

    // ============================================
    // Collateral Accounting Invariant
    // ============================================

    function test_collateral_invariant() public {
        // Complex flow: mint, buy, match, cancel, merge
        vm.prank(alice);
        book.mint(marketKey, 100 * WAD);

        vm.prank(bob);
        book.buyYes(marketKey, 700, uint128(50 * WAD), false, 0);

        vm.prank(carol);
        book.buyNo(marketKey, 400, uint128(50 * WAD), false, 0);

        // Match: bob@700 + carol@400 = 1100, surplus=10*50/1000 = 5 to carol (taker)
        // Wait, bob was placed first (maker), carol is taker
        // Carol gets 50 NO + 5 surplus

        // Cancel bob's remaining (if any — he had 50, all matched)
        // Alice merges 50
        vm.prank(alice);
        book.merge(marketKey, 50 * WAD);

        // Verify: contract USDC balance == collateral backing
        uint256 contractBalance = usdc.balanceOf(address(book));
        uint256 backing = book.getCollateralBacking(marketKey);
        assertEq(contractBalance, backing, "collateral invariant holds");
    }
}
