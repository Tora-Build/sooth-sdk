// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";

import {TickBookV2} from "../../../contracts/TickBookV2.sol";
import {TickBookVault} from "../../../contracts/TickBookVault.sol";
import {MockUSDC} from "../../../contracts/MockUSDC.sol";

// Minimal TruthMarket mock (TickBookV2 only needs isLive())
contract MockTruthMarketLive {
    bool public isLive = true;
    bool public isSettled = false;
    uint8 public winningOutcome = 0;

    function setLive(bool _live) external {
        isLive = _live;
    }

    function setSettled(bool _settled, uint8 _winner) external {
        isSettled = _settled;
        winningOutcome = _winner;
    }

    function getRedemptionValue(uint8 outcome) external view returns (uint256) {
        if (!isSettled) return 0;
        if (winningOutcome == 2) return 0.5e18; // INVALID
        return outcome == winningOutcome ? 1e18 : 0;
    }
}

/**
 * @title TickBookV2InvariantsTest
 * @notice Stateful fuzzing invariants for TickBookV2 + TickBookVault
 *
 * Core invariants we enforce:
 * - Tick bounds: MIN_TICK <= currentTick <= MAX_TICK
 * - Order shape invariants: tickLower <= tickUpper, sharesTotal > 0, liquidity(density) > 0
 */
contract TickBookV2InvariantsTest is StdInvariant, Test {
    uint256 private constant WAD = 1e18;
    uint16 private constant MIN_TICK = 1;
    uint16 private constant MAX_TICK = 999;

    MockUSDC public usdc;
    TickBookVault public vault;
    TickBookV2 public tickBook;
    MockTruthMarketLive public market;
    bytes32 public marketKey;

    address[] public users;
    TickBookV2Actor public actor;

    function setUp() public {
        usdc = new MockUSDC("Mock USDC", "USDC");
        vault = new TickBookVault(address(usdc), address(this));
        tickBook = new TickBookV2(address(vault));
        vault.setTickBook(address(tickBook));

        market = new MockTruthMarketLive();
        // dummy token metadata (not used by TickBookV2 logic)
        address yesToken = address(0x1111111111111111111111111111111111111111);
        address noToken = address(0x2222222222222222222222222222222222222222);
        marketKey = tickBook.registerMarket(address(market), yesToken, noToken, 0.5e18);

        // Fund a small fixed set of users
        for (uint160 i = 11; i < 16; i++) {
            address u = address(i);
            users.push(u);
            usdc.mint(u, 1_000_000 * WAD);
            vm.prank(u);
            usdc.approve(address(vault), type(uint256).max);
            vm.prank(u);
            vault.depositUsdc(250_000 * WAD);
        }

        actor = new TickBookV2Actor(tickBook, vault, address(market), marketKey, users);
        targetContract(address(actor));
    }

    // ----------------------------
    // Invariants
    // ----------------------------

    function invariant_CurrentTickWithinBounds() public view {
        (uint16 currentTick,,,) = tickBook.getMarketState(marketKey);
        assertGe(currentTick, MIN_TICK, "tick below MIN_TICK");
        assertLe(currentTick, MAX_TICK, "tick above MAX_TICK");
    }

    function invariant_OrderShapeWellFormed() public view {
        uint256[] memory orderIds = actor.getAllOrderIds();
        for (uint256 i = 0; i < orderIds.length; i++) {
            TickBookV2.RangeOrder memory o = tickBook.getOrder(marketKey, orderIds[i]);
            // Basic shape invariants
            assertLe(o.tickLower, o.tickUpper, "order tick range inverted");
            assertGt(o.sharesTotal, 0, "order sharesTotal=0");
            assertGt(o.liquidity, 0, "order density=0");
        }
    }
}

/**
 * @title TickBookV2Actor
 * @notice Actor for invariant fuzzing. Performs valid actions on TickBookV2.
 */
contract TickBookV2Actor is Test {
    uint256 private constant WAD = 1e18;

    TickBookV2 public tickBook;
    TickBookVault public vault;
    address public market;
    bytes32 public marketKey;
    address[] public users;

    uint256[] private _orderIds;
    uint256 private _cancelCursor;

    constructor(
        TickBookV2 _tickBook,
        TickBookVault _vault,
        address _market,
        bytes32 _marketKey,
        address[] memory _users
    ) {
        tickBook = _tickBook;
        vault = _vault;
        market = _market;
        marketKey = _marketKey;
        users = _users;
    }

    function getAllOrderIds() external view returns (uint256[] memory) {
        return _orderIds;
    }

    function _pick(uint256 seed) internal view returns (address) {
        return users[seed % users.length];
    }

    function depositMore(uint256 seed, uint256 amtWad) external {
        address u = _pick(seed);
        amtWad = bound(amtWad, 1e18, 1000e18);
        vm.prank(u);
        vault.depositUsdc(amtWad);
    }

    function placeRange(uint256 seed, uint8 outcome, uint16 low, uint16 high, uint256 sharesTotal) external {
        address u = _pick(seed);
        outcome = uint8(bound(outcome, 0, 1));
        low = uint16(bound(low, 1, 999));
        high = uint16(bound(high, low, 999));
        uint256 ticksInRange = uint256(high) - uint256(low) + 1;
        uint256 minShares = ticksInRange * 1e18; // ensures density >= 1e18
        sharesTotal = bound(sharesTotal, minShares, minShares + 10_000e18);

        vm.prank(u);
        (uint256 orderId,,) = tickBook.placeRangeOrder(marketKey, outcome, low, high, sharesTotal);
        _orderIds.push(orderId);

        // Keep order list from growing without bound during invariants
        if (_orderIds.length > 25) {
            _bestEffortCancelNext(seed);
        }
    }

    function marketBuy(uint256 seed, uint8 outcome, uint256 shares, uint256 maxCostWad) external {
        address u = _pick(seed);
        outcome = uint8(bound(outcome, 0, 1));
        shares = bound(shares, 1e18, 1000e18);
        // Give generous maxCost to avoid revert storms
        maxCostWad = bound(maxCostWad, shares / 10, shares);

        vm.prank(u);
        try tickBook.executeMarketOrder(marketKey, outcome, shares, maxCostWad) {
            // ok
        } catch {
            // Ignore reverts; invariants will still validate state
        }
    }

    function claim(uint256 seed) external {
        if (_orderIds.length == 0) return;
        address u = _pick(seed);
        uint256 orderId = _orderIds[seed % _orderIds.length];
        // Only the owner can claim; try a few candidates deterministically
        TickBookV2.RangeOrder memory o = tickBook.getOrder(marketKey, orderId);
        if (o.owner != u) u = o.owner;

        vm.prank(u);
        try tickBook.claimFills(marketKey, orderId) {
            // ok
        } catch {
            // ignore
        }
    }

    function cancel(uint256 seed) external {
        _bestEffortCancelNext(seed);
    }

    function _bestEffortCancelNext(uint256 seed) internal {
        if (_orderIds.length == 0) return;
        uint256 idx = _cancelCursor % _orderIds.length;
        _cancelCursor++;
        uint256 orderId = _orderIds[idx];
        TickBookV2.RangeOrder memory o = tickBook.getOrder(marketKey, orderId);
        if (!o.active) return;

        vm.prank(o.owner);
        try tickBook.cancelOrder(marketKey, orderId) {
            // ok
        } catch {
            // ignore
        }
    }
}


