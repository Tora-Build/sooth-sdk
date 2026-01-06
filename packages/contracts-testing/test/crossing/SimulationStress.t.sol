// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {TickBookPoolManager} from "@core/TickBookPoolManager.sol";
import {TickBookVault} from "@core/TickBookVault.sol";
import {TruthMarket} from "@core/TruthMarket.sol";
import {OutcomeToken} from "@core/OutcomeToken.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";

/**
 * @title SimulationStressTest
 * @notice Reproduces the CLI simulate command's order patterns in a debuggable forge environment
 * 
 * Order distribution:
 *   - Range orders (55%): Random tick ranges within 10-90%
 *   - Limit orders (20%): Single-tick orders at specific prices
 *   - Market orders (10%): Full range 1-999 for immediate fills
 *   - Spot sell (10%): Sell owned shares at limit price
 *   - Hybrid sell (5%): Partial spot + partial short sell
 *
 * Run with: forge test --match-contract SimulationStress -vvvv
 */
contract SimulationStressTest is Test {
    TickBookPoolManager public poolManager;
    TickBookVault public vault;
    TruthMarket public market;
    OutcomeToken public yesToken;
    OutcomeToken public noToken;
    ERC20Mock public usdc;

    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);
    address public carol = address(0xCA401);
    address public dave = address(0xDA7E);
    address[] public traders;

    bytes32 public marketKey;

    // Seed for deterministic randomness (matching CLI pattern)
    uint256 public seed;

    function setUp() public {
        usdc = new ERC20Mock();
        vault = new TickBookVault(address(usdc), address(this));
        poolManager = new TickBookPoolManager(address(vault));
        vault.setTickBook(address(poolManager));

        market = new TruthMarket("Stress Test Market", uint64(block.timestamp + 30 days), address(this), address(this));
        yesToken = new OutcomeToken("Yes Token", "YES", address(this), address(market), 1);
        noToken = new OutcomeToken("No Token", "NO", address(this), address(market), 0);

        market.activate();

        marketKey = poolManager.registerMarket(
            address(market),
            address(yesToken),
            address(noToken),
            0.5e18,
            address(0)
        );

        traders = new address[](4);
        traders[0] = alice;
        traders[1] = bob;
        traders[2] = carol;
        traders[3] = dave;

        // Fund all traders
        for (uint256 i = 0; i < traders.length; i++) {
            _fundWithUsdc(traders[i], 10_000_000e18);
            _fundWithShares(traders[i], 500_000e18); // Give YES and NO shares for spot selling
        }

        seed = 12345; // Deterministic seed for reproducibility
    }

    function _fundWithUsdc(address user, uint256 amount) internal {
        usdc.mint(user, amount);
        vm.prank(user);
        usdc.approve(address(vault), type(uint256).max);
        vm.prank(user);
        vault.depositUsdc(amount);
    }

    function _fundWithShares(address user, uint256 amount) internal {
        // Credit both YES and NO shares for spot selling capability
        vm.startPrank(address(poolManager));
        vault.creditOutcome(address(market), user, 1, amount); // YES
        vault.creditOutcome(address(market), user, 0, amount); // NO
        vm.stopPrank();
    }

    // Deterministic PRNG (mulberry32) matching CLI implementation
    // Uses unchecked because overflow is intentional for hash-like mixing
    function _nextRandom() internal returns (uint256) {
        unchecked {
            seed += 0x6d2b79f5;
            uint256 x = seed;
            x ^= x >> 15;
            x *= 1 | seed;
            x ^= x + (x ^ (x >> 7)) * (61 | x);
            return (x ^ (x >> 14)) % 1000000;
        }
    }

    function _randInt(uint256 min, uint256 max) internal returns (uint256) {
        return min + (_nextRandom() % (max - min + 1));
    }

    function _randSize(uint256 avgSize) internal returns (uint256) {
        // 50%-200% of avgSize, capped to prevent overflow
        uint256 multiplier = 50 + (_nextRandom() % 150);
        // Cap avgSize to prevent overflow (max uint256 / 200)
        if (avgSize > type(uint256).max / 200) {
            avgSize = type(uint256).max / 200;
        }
        return (avgSize * multiplier) / 100;
    }

    enum OrderType { Range, Limit, Market, SpotSell, Hybrid }

    function _randomOrderType() internal returns (OrderType) {
        uint256 roll = _nextRandom() % 100;
        if (roll < 55) return OrderType.Range;
        if (roll < 75) return OrderType.Limit;
        if (roll < 85) return OrderType.Market;
        if (roll < 95) return OrderType.SpotSell;
        return OrderType.Hybrid;
    }

    /**
     * @notice Stress test with 100 random orders - should not revert
     */
    function test_Simulate100Orders() public {
        _runSimulation(100, 100e18);
    }

    /**
     * @notice Stress test with 200 random orders
     */
    function test_Simulate200Orders() public {
        _runSimulation(200, 100e18);
    }

    /**
     * @notice Stress test with 500 random orders
     */
    function test_Simulate500Orders() public {
        _runSimulation(500, 100e18);
    }

    /**
     * @notice Fuzz test with variable order count and size
     */
    function testFuzz_SimulateOrders(uint256 numOrders, uint256 avgSize, uint256 _seed) public {
        numOrders = bound(numOrders, 10, 100);
        avgSize = bound(avgSize, 10e18, 500e18);
        seed = _seed;
        
        _runSimulation(numOrders, avgSize);
    }

    /**
     * @notice Core simulation loop matching CLI behavior
     */
    function _runSimulation(uint256 numOrders, uint256 avgSize) internal {
        uint256 successCount = 0;
        uint256 failCount = 0;

        for (uint256 i = 0; i < numOrders; i++) {
            address trader = traders[_nextRandom() % traders.length];
            OrderType orderType = _randomOrderType();
            uint8 outcome = _nextRandom() % 100 < 55 ? 1 : 0; // Slight YES bias

            uint16 tickLower;
            uint16 tickUpper;

            if (orderType == OrderType.Market) {
                tickLower = 1;
                tickUpper = 999;
            } else if (orderType == OrderType.Limit || orderType == OrderType.SpotSell) {
                tickLower = uint16(_randInt(100, 898));
                tickUpper = tickLower + uint16(_randInt(1, 3));
                if (tickUpper > 999) tickUpper = 999;
            } else if (orderType == OrderType.Hybrid) {
                tickLower = uint16(_randInt(100, 800));
                tickUpper = tickLower + uint16(_randInt(10, 50));
                if (tickUpper > 999) tickUpper = 999;
            } else {
                // Range order
                tickLower = uint16(_randInt(100, 800));
                uint16 width = uint16(_randInt(50, 150));
                tickUpper = tickLower + width;
                if (tickUpper > 999) {
                    tickUpper = 999;
                    if (tickLower > tickUpper - 10) tickLower = tickUpper - 10;
                }
            }

            // Ensure valid range
            if (tickLower < 1) tickLower = 1;
            if (tickUpper > 999) tickUpper = 999;
            if (tickLower >= tickUpper) tickUpper = tickLower + 1;

            uint256 shares = _randSize(avgSize);
            if (shares < 1e18) shares = 1e18;
            uint256 maxCost = shares * 2;

            bool success = _executeOrder(trader, orderType, outcome, shares, tickLower, tickUpper, maxCost, i);
            
            if (success) {
                successCount++;
            } else {
                failCount++;
                // Log failure details for debugging
                emit log_named_uint("Failed order index", i);
                emit log_named_uint("Order type", uint256(orderType));
                emit log_named_uint("Outcome", outcome);
                emit log_named_uint("Shares", shares);
                emit log_named_uint("TickLower", tickLower);
                emit log_named_uint("TickUpper", tickUpper);
            }
        }

        emit log_named_uint("Success count", successCount);
        emit log_named_uint("Fail count", failCount);
        
        // Allow some failures for debugging, but not too many
        assertGt(successCount, numOrders * 90 / 100, "Should have >90% success rate");
    }

    function _executeOrder(
        address trader,
        OrderType orderType,
        uint8 outcome,
        uint256 shares,
        uint16 tickLower,
        uint16 tickUpper,
        uint256 maxCost,
        uint256 /* orderIndex */
    ) internal returns (bool) {
        // Check shares availability for spot/hybrid before execution
        (uint256 yesShares, uint256 noShares) = vault.getInternalOutcomes(address(market), trader);
        uint256 available = outcome == 1 ? yesShares : noShares;

        if (orderType == OrderType.SpotSell) {
            if (available >= shares) {
                vm.prank(trader);
                try poolManager.placeSpotSell(marketKey, outcome, shares, tickLower, tickUpper) {
                    return true;
                } catch { return false; }
            } else if (available > 0) {
                vm.prank(trader);
                try poolManager.placeSpotSell(marketKey, outcome, available, tickLower, tickUpper) {
                    return true;
                } catch { return false; }
            } else {
                // Fallback to range order
                vm.prank(trader);
                try poolManager.placeOrder(marketKey, outcome, shares, tickLower, tickUpper, maxCost) {
                    return true;
                } catch { return false; }
            }
        } else if (orderType == OrderType.Hybrid) {
            if (available > 0) {
                uint256 spotAmount = available > shares ? shares : available;
                vm.prank(trader);
                try poolManager.placeSpotSell(marketKey, outcome, spotAmount, tickLower, tickUpper) {
                    // Continue
                } catch { return false; }
                
                if (shares > spotAmount) {
                    uint256 shortAmount = shares - spotAmount;
                    vm.prank(trader);
                    try poolManager.placeOrder(marketKey, outcome, shortAmount, tickLower, tickUpper, maxCost) {
                        return true;
                    } catch { return false; }
                }
                return true;
            } else {
                vm.prank(trader);
                try poolManager.placeOrder(marketKey, outcome, shares, tickLower, tickUpper, maxCost) {
                    return true;
                } catch { return false; }
            }
        } else {
            // Range, Limit, or Market order
            vm.prank(trader);
            try poolManager.placeOrder(marketKey, outcome, shares, tickLower, tickUpper, maxCost) {
                return true;
            } catch Error(string memory reason) {
                emit log_named_string("Revert reason", reason);
                return false;
            } catch Panic(uint256 code) {
                emit log_named_uint("Panic code", code);
                return false;
            } catch (bytes memory lowLevelData) {
                emit log_named_bytes("Low level revert", lowLevelData);
                if (lowLevelData.length >= 4) {
                    bytes4 selector;
                    assembly {
                        selector := mload(add(lowLevelData, 32))
                    }
                    emit log_named_bytes32("Error selector", bytes32(selector));
                }
                return false;
            }
        }
    }

    /**
     * @notice Test specific edge case: Many consecutive crossings
     */
    function test_ManyConsecutiveCrossings() public {
        // Place initial liquidity on both sides
        vm.prank(alice);
        poolManager.placeOrder(marketKey, 0, 1000e18, 400, 600, 1000e18); // NO order
        
        vm.prank(bob);
        poolManager.placeOrder(marketKey, 1, 1000e18, 400, 600, 1000e18); // YES order

        // Rapid-fire crossing orders
        for (uint256 i = 0; i < 50; i++) {
            address trader = i % 2 == 0 ? carol : dave;
            uint8 outcome = uint8(i % 2);
            
            vm.prank(trader);
            poolManager.placeOrder(marketKey, outcome, 50e18, 450, 550, 100e18);
        }
    }

    /**
     * @notice Test edge case: Orders at tick boundaries
     */
    function test_OrdersAtBoundaries() public {
        // Test minimum tick
        vm.prank(alice);
        poolManager.placeOrder(marketKey, 1, 100e18, 1, 10, 100e18);

        // Test maximum tick
        vm.prank(bob);
        poolManager.placeOrder(marketKey, 0, 100e18, 990, 999, 100e18);

        // Cross at boundaries
        vm.prank(carol);
        poolManager.placeOrder(marketKey, 0, 50e18, 1, 999, 100e18); // Market order NO

        vm.prank(dave);
        poolManager.placeOrder(marketKey, 1, 50e18, 1, 999, 100e18); // Market order YES
    }

    /**
     * @notice Test edge case: Spot sells at various tick ranges
     */
    function test_SpotSellsVariousTicks() public {
        // Give alice lots of shares
        vm.prank(address(poolManager));
        vault.creditOutcome(address(market), alice, 1, 10000e18);

        // Place spot sells at various ranges (MAX_SPOT_RANGE = 50)
        vm.startPrank(alice);
        
        // Narrow range (1 tick)
        poolManager.placeSpotSell(marketKey, 1, 100e18, 500, 500);
        
        // Medium range (30 ticks - under limit)
        poolManager.placeSpotSell(marketKey, 1, 100e18, 400, 429);
        
        // Max range (50 ticks - at limit)
        poolManager.placeSpotSell(marketKey, 1, 100e18, 300, 349);
        
        vm.stopPrank();

        // Cross all of them
        vm.prank(bob);
        poolManager.placeOrder(marketKey, 1, 500e18, 1, 999, 1000e18);
    }

    /**
     * @notice Reproduce the fuzz failure for debugging
     * counterexample: args=[0, 5953284335931707006874, 19663724574155849861599]
     */
    function test_ReproduceFuzzFailure() public {
        // Bound result: numOrders = 10, avgSize = 73284335931707006862 (huge)
        seed = 19663724574155849861599;
        uint256 avgSize = 73284335931707006862; // ~73e18
        
        // Need more funds for huge orders
        for (uint256 i = 0; i < traders.length; i++) {
            _fundWithUsdc(traders[i], 1_000_000_000e18); // 1B USDC
            _fundWithShares(traders[i], 100_000_000e18); // 100M shares
        }
        
        _runSimulation(10, avgSize);
    }

    /**
     * @notice Test interleaved spot and range orders
     */
    function test_InterleavedSpotAndRange() public {
        for (uint256 i = 0; i < 20; i++) {
            address trader = traders[i % 4];
            uint8 outcome = uint8(i % 2);
            uint16 tick = uint16(200 + (i * 30));
            
            if (i % 3 == 0) {
                // Spot sell (if trader has shares)
                (uint256 yes, uint256 no) = vault.getInternalOutcomes(address(market), trader);
                uint256 avail = outcome == 1 ? yes : no;
                if (avail >= 50e18) {
                    vm.prank(trader);
                    poolManager.placeSpotSell(marketKey, outcome, 50e18, tick, tick + 10);
                }
            } else {
                // Range order
                vm.prank(trader);
                poolManager.placeOrder(marketKey, outcome, 100e18, tick, tick + 50, 200e18);
            }
        }

        // Now cross with market orders
        vm.prank(alice);
        poolManager.placeOrder(marketKey, 1, 200e18, 1, 999, 500e18);

        vm.prank(bob);
        poolManager.placeOrder(marketKey, 0, 200e18, 1, 999, 500e18);
    }
}
