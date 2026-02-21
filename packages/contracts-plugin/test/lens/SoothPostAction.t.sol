// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {SoothPostAction} from "../../src/lens/SoothPostAction.sol";
import {KeyValue} from "../../src/lens/IPostAction.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";

contract SoothPostActionTest is Test {
    SoothPostAction public action;
    ERC20Mock public wgho;

    address public actionHub = address(0xAC710);
    address public owner = address(this);
    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);
    address public treasury = address(0x7EA5);

    address public feed = address(0xFEED);
    uint256 public postId = 42;

    uint256 constant WAD = 1e18;

    // Key constants (must match SoothPostAction)
    bytes32 constant KEY_B = keccak256("sooth.param.b");
    bytes32 constant KEY_DEADLINE = keccak256("sooth.param.deadline");
    bytes32 constant KEY_FEE_BPS = keccak256("sooth.param.feeBps");
    bytes32 constant KEY_ACTION = keccak256("sooth.param.action");
    bytes32 constant KEY_OUTCOME = keccak256("sooth.param.outcome");
    bytes32 constant KEY_AMOUNT = keccak256("sooth.param.amount");
    bytes32 constant KEY_MAX_COST = keccak256("sooth.param.maxCost");

    function setUp() public {
        wgho = new ERC20Mock();
        action = new SoothPostAction(address(wgho), actionHub, owner);
        action.setTreasury(treasury);

        // Fund users
        wgho.mint(alice, 10000 * WAD);
        wgho.mint(bob, 10000 * WAD);

        vm.prank(alice);
        wgho.approve(address(action), type(uint256).max);
        vm.prank(bob);
        wgho.approve(address(action), type(uint256).max);
    }

    // ============================================
    // Helpers
    // ============================================

    function _configure(address creator, uint256 b, uint64 deadline) internal {
        KeyValue[] memory params = new KeyValue[](2);
        params[0] = KeyValue(KEY_B, abi.encode(b));
        params[1] = KeyValue(KEY_DEADLINE, abi.encode(uint256(deadline)));

        vm.prank(actionHub);
        action.configure(creator, feed, postId, params);
    }

    function _buy(address user, uint8 outcome, uint256 shares, uint256 maxCost) internal {
        KeyValue[] memory params = new KeyValue[](4);
        params[0] = KeyValue(KEY_ACTION, abi.encode(uint256(0))); // BUY
        params[1] = KeyValue(KEY_OUTCOME, abi.encode(uint256(outcome)));
        params[2] = KeyValue(KEY_AMOUNT, abi.encode(shares));
        params[3] = KeyValue(KEY_MAX_COST, abi.encode(maxCost));

        vm.prank(actionHub);
        action.execute(user, feed, postId, params);
    }

    function _sell(address user, uint8 outcome, uint256 shares) internal {
        KeyValue[] memory params = new KeyValue[](3);
        params[0] = KeyValue(KEY_ACTION, abi.encode(uint256(1))); // SELL
        params[1] = KeyValue(KEY_OUTCOME, abi.encode(uint256(outcome)));
        params[2] = KeyValue(KEY_AMOUNT, abi.encode(shares));

        vm.prank(actionHub);
        action.execute(user, feed, postId, params);
    }

    function _resolve(address resolver, uint8 outcome) internal {
        KeyValue[] memory params = new KeyValue[](2);
        params[0] = KeyValue(KEY_ACTION, abi.encode(uint256(2))); // RESOLVE
        params[1] = KeyValue(KEY_OUTCOME, abi.encode(uint256(outcome)));

        vm.prank(actionHub);
        action.execute(resolver, feed, postId, params);
    }

    function _redeem(address user) internal {
        KeyValue[] memory params = new KeyValue[](1);
        params[0] = KeyValue(KEY_ACTION, abi.encode(uint256(3))); // REDEEM

        vm.prank(actionHub);
        action.execute(user, feed, postId, params);
    }

    // ============================================
    // Configure Tests
    // ============================================

    function test_configure_createsMarket() public {
        _configure(alice, 100 * WAD, uint64(block.timestamp + 1 days));

        (address resolver, uint64 deadline, uint256 b,,,,,,,) = action.markets(feed, postId);
        assertEq(resolver, alice);
        assertEq(b, 100 * WAD);
        assertGt(deadline, block.timestamp);
    }

    function test_configure_duplicateReverts() public {
        _configure(alice, 100 * WAD, uint64(block.timestamp + 1 days));

        KeyValue[] memory params = new KeyValue[](2);
        params[0] = KeyValue(KEY_B, abi.encode(100 * WAD));
        params[1] = KeyValue(KEY_DEADLINE, abi.encode(uint256(block.timestamp + 2 days)));

        vm.prank(actionHub);
        vm.expectRevert(SoothPostAction.MarketAlreadyExists.selector);
        action.configure(bob, feed, postId, params);
    }

    function test_configure_notActionHub_reverts() public {
        KeyValue[] memory params = new KeyValue[](2);
        params[0] = KeyValue(KEY_B, abi.encode(100 * WAD));
        params[1] = KeyValue(KEY_DEADLINE, abi.encode(uint256(block.timestamp + 1 days)));

        vm.prank(alice);
        vm.expectRevert(SoothPostAction.NotActionHub.selector);
        action.configure(alice, feed, postId, params);
    }

    // ============================================
    // Buy Tests
    // ============================================

    function test_buy_yes() public {
        _configure(alice, 100 * WAD, uint64(block.timestamp + 1 days));

        uint256 balBefore = wgho.balanceOf(bob);
        _buy(bob, 1, 10 * WAD, 100 * WAD); // buy 10 YES shares

        (uint256 yesShares, uint256 noShares) = action.getPosition(feed, postId, bob);
        assertEq(yesShares, 10 * WAD);
        assertEq(noShares, 0);
        assertLt(wgho.balanceOf(bob), balBefore); // spent WGHO
    }

    function test_buy_no() public {
        _configure(alice, 100 * WAD, uint64(block.timestamp + 1 days));

        _buy(bob, 0, 10 * WAD, 100 * WAD); // buy 10 NO shares

        (uint256 yesShares, uint256 noShares) = action.getPosition(feed, postId, bob);
        assertEq(yesShares, 0);
        assertEq(noShares, 10 * WAD);
    }

    function test_buy_movesPrice() public {
        _configure(alice, 100 * WAD, uint64(block.timestamp + 1 days));

        uint256 priceBefore = action.getPrice(feed, postId);

        _buy(bob, 1, 50 * WAD, 1000 * WAD); // big YES buy

        uint256 priceAfter = action.getPrice(feed, postId);
        assertGt(priceAfter, priceBefore); // YES price increased
    }

    function test_buy_afterResolved_reverts() public {
        _configure(alice, 100 * WAD, uint64(block.timestamp + 1 days));
        _resolve(alice, 1);

        vm.expectRevert(SoothPostAction.AlreadyResolved.selector);
        _buy(bob, 1, 10 * WAD, 100 * WAD);
    }

    function test_buy_afterDeadline_reverts() public {
        _configure(alice, 100 * WAD, uint64(block.timestamp + 1 days));

        vm.warp(block.timestamp + 2 days); // past deadline

        vm.expectRevert(SoothPostAction.TooEarly.selector);
        _buy(bob, 1, 10 * WAD, 100 * WAD);
    }

    function test_buy_collectsFee() public {
        _configure(alice, 100 * WAD, uint64(block.timestamp + 1 days));

        uint256 treasuryBefore = wgho.balanceOf(treasury);
        _buy(bob, 1, 10 * WAD, 100 * WAD);
        uint256 treasuryAfter = wgho.balanceOf(treasury);

        assertGt(treasuryAfter, treasuryBefore); // treasury got fee
    }

    // ============================================
    // Sell Tests
    // ============================================

    function test_sell_yes() public {
        _configure(alice, 100 * WAD, uint64(block.timestamp + 1 days));
        _buy(bob, 1, 10 * WAD, 100 * WAD);

        uint256 balBefore = wgho.balanceOf(bob);
        _sell(bob, 1, 5 * WAD); // sell 5 YES shares

        (uint256 yesShares,) = action.getPosition(feed, postId, bob);
        assertEq(yesShares, 5 * WAD);
        assertGt(wgho.balanceOf(bob), balBefore); // got WGHO back
    }

    function test_sell_insufficientShares_reverts() public {
        _configure(alice, 100 * WAD, uint64(block.timestamp + 1 days));
        _buy(bob, 1, 10 * WAD, 100 * WAD);

        vm.expectRevert(SoothPostAction.InsufficientShares.selector);
        _sell(bob, 1, 20 * WAD); // more than owned
    }

    // ============================================
    // Resolve Tests
    // ============================================

    function test_resolve_yes() public {
        _configure(alice, 100 * WAD, uint64(block.timestamp + 1 days));

        _resolve(alice, 1); // YES wins

        (,,,,,,uint8 outcome, bool resolved,,) = action.markets(feed, postId);
        assertTrue(resolved);
        assertEq(outcome, 1);
    }

    function test_resolve_notResolver_reverts() public {
        _configure(alice, 100 * WAD, uint64(block.timestamp + 1 days));

        vm.expectRevert(SoothPostAction.NotResolver.selector);
        _resolve(bob, 1); // bob is not resolver
    }

    function test_resolve_twice_reverts() public {
        _configure(alice, 100 * WAD, uint64(block.timestamp + 1 days));
        _resolve(alice, 1);

        vm.expectRevert(SoothPostAction.AlreadyResolved.selector);
        _resolve(alice, 0);
    }

    // ============================================
    // Redeem Tests
    // ============================================

    function test_redeem_yesWins() public {
        _configure(alice, 100 * WAD, uint64(block.timestamp + 1 days));
        _buy(bob, 1, 10 * WAD, 100 * WAD); // bob buys 10 YES

        _resolve(alice, 1); // YES wins

        uint256 balBefore = wgho.balanceOf(bob);
        _redeem(bob);
        uint256 balAfter = wgho.balanceOf(bob);

        assertEq(balAfter - balBefore, 10 * WAD); // 10 shares = 10 WGHO

        (uint256 yesShares, uint256 noShares) = action.getPosition(feed, postId, bob);
        assertEq(yesShares, 0);
        assertEq(noShares, 0);
    }

    function test_redeem_noWins() public {
        _configure(alice, 100 * WAD, uint64(block.timestamp + 1 days));
        _buy(bob, 0, 10 * WAD, 100 * WAD); // bob buys 10 NO

        _resolve(alice, 0); // NO wins

        uint256 balBefore = wgho.balanceOf(bob);
        _redeem(bob);
        assertEq(wgho.balanceOf(bob) - balBefore, 10 * WAD);
    }

    function test_redeem_loser_getsNothing() public {
        _configure(alice, 100 * WAD, uint64(block.timestamp + 1 days));
        _buy(bob, 1, 10 * WAD, 100 * WAD); // bob buys YES

        _resolve(alice, 0); // NO wins — bob loses

        vm.expectRevert(SoothPostAction.NothingToRedeem.selector);
        _redeem(bob);
    }

    function test_redeem_invalid_50_50() public {
        _configure(alice, 100 * WAD, uint64(block.timestamp + 1 days));
        _buy(bob, 1, 10 * WAD, 100 * WAD); // 10 YES
        _buy(bob, 0, 6 * WAD, 100 * WAD);  // 6 NO

        _resolve(alice, 2); // INVALID

        uint256 balBefore = wgho.balanceOf(bob);
        _redeem(bob);
        uint256 payout = wgho.balanceOf(bob) - balBefore;

        // INVALID: (10 + 6) / 2 = 8 WGHO
        assertEq(payout, 8 * WAD);
    }

    function test_redeem_notResolved_reverts() public {
        _configure(alice, 100 * WAD, uint64(block.timestamp + 1 days));
        _buy(bob, 1, 10 * WAD, 100 * WAD);

        vm.expectRevert(SoothPostAction.MarketNotResolved.selector);
        _redeem(bob);
    }

    // ============================================
    // View Function Tests
    // ============================================

    function test_getPrice_initiallyFiftyFifty() public {
        _configure(alice, 100 * WAD, uint64(block.timestamp + 1 days));
        uint256 price = action.getPrice(feed, postId);
        // Should be ~50% (0.5e18)
        assertApproxEqAbs(price, 5e17, 1e15); // within 0.1%
    }

    function test_quoteBuy_returnsCorrectCost() public {
        _configure(alice, 100 * WAD, uint64(block.timestamp + 1 days));

        (uint256 cost, uint256 fee, uint256 total) = action.quoteBuy(feed, postId, 1, 10 * WAD);
        assertGt(cost, 0);
        assertGt(fee, 0);
        assertEq(total, cost + fee);
    }

    // ============================================
    // E2E: Full Market Lifecycle
    // ============================================

    function test_e2e_fullLifecycle() public {
        // 1. Create market
        _configure(alice, 100 * WAD, uint64(block.timestamp + 1 days));

        // 2. Alice buys YES, Bob buys NO
        _buy(alice, 1, 20 * WAD, 200 * WAD);
        _buy(bob, 0, 15 * WAD, 200 * WAD);

        // 3. Check prices moved
        uint256 yesPrice = action.getPrice(feed, postId);
        assertGt(yesPrice, 5e17); // YES > 50% because more YES bought

        // 4. Bob sells some NO
        _sell(bob, 0, 5 * WAD);

        // 5. Resolve: YES wins
        _resolve(alice, 1);

        // 6. Alice redeems (winner)
        uint256 aliceBefore = wgho.balanceOf(alice);
        _redeem(alice);
        assertEq(wgho.balanceOf(alice) - aliceBefore, 20 * WAD);

        // 7. Bob tries to redeem NO (loser) — should get nothing
        (uint256 bobYes, uint256 bobNo) = action.getPosition(feed, postId, bob);
        assertEq(bobYes, 0);
        assertEq(bobNo, 10 * WAD); // 15 - 5 sold = 10 remaining
        vm.expectRevert(SoothPostAction.NothingToRedeem.selector);
        _redeem(bob);
    }
}
