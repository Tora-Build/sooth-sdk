// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {TickBookPoolManager, ILockCallback} from "@core/TickBookPoolManager.sol";
import {TickBookVault} from "@core/TickBookVault.sol";
import {TruthMarket} from "@core/TruthMarket.sol";
import {OutcomeToken} from "@core/OutcomeToken.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";

/**
 * @title V9 Invariant Tests
 * @notice Tests critical invariants that must ALWAYS hold for the TickBookPoolManager
 * @dev Uses actor-based testing pattern
 */
contract V9InvariantsTest is Test {
    TickBookPoolManager public poolManager;
    TickBookVault public vault;
    TruthMarket public market;
    OutcomeToken public yesToken;
    OutcomeToken public noToken;
    ERC20Mock public usdc;

    address public deployer;
    bytes32 public marketKey;

    TraderActor public traderA;
    TraderActor public traderB;
    TraderActor public traderC;

    uint256 constant WAD = 1e18;
    uint256 constant INITIAL_BALANCE = 1_000_000e18;

    function setUp() public {
        deployer = address(this);

        // Deploy core contracts
        usdc = new ERC20Mock();
        vault = new TickBookVault(address(usdc), deployer);
        poolManager = new TickBookPoolManager(address(vault));
        vault.setTickBook(address(poolManager));

        // Deploy market
        market = new TruthMarket(
            "Invariant Test Market",
            uint64(block.timestamp + 30 days),
            deployer,
            deployer
        );
        yesToken = new OutcomeToken("Yes", "YES", deployer, address(market), 1);
        noToken = new OutcomeToken("No", "NO", deployer, address(market), 0);
        market.activate();

        // Register market
        TickBookPoolManager.PoolKey memory key = TickBookPoolManager.PoolKey({
            truthMarket: address(market),
            yesToken: address(yesToken),
            noToken: address(noToken),
            hook: address(0)
        });
        marketKey = poolManager.registerMarket(key, 0.5e18);

        // Deploy trader actors
        traderA = new TraderActor(poolManager, vault, usdc, marketKey);
        traderB = new TraderActor(poolManager, vault, usdc, marketKey);
        traderC = new TraderActor(poolManager, vault, usdc, marketKey);

        // Fund actors
        usdc.mint(address(traderA), INITIAL_BALANCE);
        usdc.mint(address(traderB), INITIAL_BALANCE);
        usdc.mint(address(traderC), INITIAL_BALANCE);

        // Actors deposit to vault
        traderA.depositToVault(INITIAL_BALANCE);
        traderB.depositToVault(INITIAL_BALANCE);
        traderC.depositToVault(INITIAL_BALANCE);

        // Target actors for invariant testing
        targetContract(address(traderA));
        targetContract(address(traderB));
        targetContract(address(traderC));

        // Exclude pool manager and vault from direct calls
        excludeContract(address(poolManager));
        excludeContract(address(vault));
        excludeContract(address(usdc));
    }

    // ============================================
    // INVARIANT 1: Vault Solvency
    // ============================================
    
    function invariant_VaultSolvency() public view {
        uint256 vaultBalance = usdc.balanceOf(address(vault));
        
        // Sum of all user available + reserved must be <= vault balance
        uint256 availA = vault.availableUsdcWad(address(traderA));
        uint256 availB = vault.availableUsdcWad(address(traderB));
        uint256 availC = vault.availableUsdcWad(address(traderC));
        
        uint256 reservedA = vault.reservedUsdcWad(address(traderA));
        uint256 reservedB = vault.reservedUsdcWad(address(traderB));
        uint256 reservedC = vault.reservedUsdcWad(address(traderC));
        
        uint256 totalClaimed = availA + availB + availC + reservedA + reservedB + reservedC;
        // Allow for rounding tolerance
        assertLe(totalClaimed, vaultBalance + 1e9, "Vault must be solvent");
    }

    // ============================================
    // INVARIANT 2: No Negative Balances
    // ============================================
    
    function invariant_NoNegativeBalances() public view {
        // Available balance can never be negative (it's uint256)
        // But we check that reserved never exceeds initial balance
        uint256 reservedA = vault.reservedUsdcWad(address(traderA));
        uint256 reservedB = vault.reservedUsdcWad(address(traderB));
        uint256 reservedC = vault.reservedUsdcWad(address(traderC));

        // Reserved should never exceed logical maximum (initial balance)
        assertLe(reservedA, INITIAL_BALANCE, "TraderA reserved overflow");
        assertLe(reservedB, INITIAL_BALANCE, "TraderB reserved overflow");
        assertLe(reservedC, INITIAL_BALANCE, "TraderC reserved overflow");
    }

    // ============================================
    // INVARIANT 3: Market State Consistency
    // ============================================
    
    function invariant_MarketStateConsistency() public view {
        (uint16 tick, uint128 liqNo, uint128 liqYes, uint256 prob) = poolManager.getMarketState(marketKey);
        
        // Tick must be in valid range
        assertGe(tick, 1, "Tick too low");
        assertLe(tick, 999, "Tick too high");
        
        // Probability must be valid (0 < prob < WAD)
        assertGt(prob, 0, "Probability cannot be 0");
        assertLt(prob, WAD, "Probability cannot be 1");
        
        // Tick and probability should be consistent
        // tick / 1000 ≈ prob / WAD (within tolerance)
        uint256 expectedProb = uint256(tick) * WAD / 1000;
        uint256 diff = prob > expectedProb ? prob - expectedProb : expectedProb - prob;
        assertLe(diff, WAD / 100, "Tick-probability mismatch"); // 1% tolerance
    }

    // ============================================
    // INVARIANT 4: Order Integrity
    // ============================================
    
    function invariant_ActiveOrdersHaveCollateral() public view {
        // Check first 10 orders (if they exist)
        for (uint256 i = 1; i <= 10; i++) {
            try poolManager.getOrder(marketKey, i) returns (TickBookPoolManager.RangeOrder memory order) {
                if (order.active) {
                    // Active orders must have positive collateral
                    assertGt(order.collateralDepositedWad, 0, "Active order has no collateral");
                    // Filled shares cannot exceed total shares
                    assertLe(order.filledShares, order.sharesTotal, "Filled exceeds total");
                }
            } catch {
                // Order doesn't exist, that's fine
            }
        }
    }
}

/**
 * @title Trader Actor
 * @notice Actor contract for invariant testing - performs random trading operations
 */
contract TraderActor {
    TickBookPoolManager public poolManager;
    TickBookVault public vault;
    ERC20Mock public usdc;
    bytes32 public marketKey;

    uint256[] public myOrderIds;
    uint256 constant WAD = 1e18;

    constructor(
        TickBookPoolManager _poolManager,
        TickBookVault _vault,
        ERC20Mock _usdc,
        bytes32 _marketKey
    ) {
        poolManager = _poolManager;
        vault = _vault;
        usdc = _usdc;
        marketKey = _marketKey;
    }

    function depositToVault(uint256 amount) external {
        usdc.approve(address(vault), amount);
        vault.depositUsdc(amount);
    }

    /// @notice Place a random range order
    function placeOrder(uint16 tickLower, uint16 tickUpper, uint128 shares) external {
        // Bound inputs
        tickLower = uint16(bound(tickLower, 1, 500));
        tickUpper = uint16(bound(tickUpper, tickLower + 1, 999));
        shares = uint128(bound(shares, 1e18, 10_000e18));

        uint8 outcome = uint8(block.timestamp % 2); // Random YES or NO

        try poolManager.placeRangeOrder(
            marketKey,
            outcome,
            tickLower,
            tickUpper,
            shares
        ) returns (uint256 orderId, uint256, uint256) {
            myOrderIds.push(orderId);
        } catch {
            // Order failed, that's okay for invariant testing
        }
    }

    /// @notice Execute a market order
    function executeMarket(uint128 shares) external {
        shares = uint128(bound(shares, 1e18, 5_000e18));
        uint8 outcome = uint8(block.timestamp % 2);

        try poolManager.executeMarketOrder(
            marketKey,
            outcome,
            shares,
            shares * 2 // maxCost = 2x shares (generous slippage)
        ) {
            // Success
        } catch {
            // No liquidity or other failure, okay for invariant testing
        }
    }

    /// @notice Cancel a random order
    function cancelOrder(uint256 orderIndex) external {
        if (myOrderIds.length == 0) return;
        
        orderIndex = bound(orderIndex, 0, myOrderIds.length - 1);
        uint256 orderId = myOrderIds[orderIndex];

        try poolManager.cancelOrder(marketKey, orderId) {
            // Remove from tracking
            myOrderIds[orderIndex] = myOrderIds[myOrderIds.length - 1];
            myOrderIds.pop();
        } catch {
            // Already cancelled or other issue
        }
    }

    /// @notice Claim fills on a random order
    function claimFills(uint256 orderIndex) external {
        if (myOrderIds.length == 0) return;
        
        orderIndex = bound(orderIndex, 0, myOrderIds.length - 1);
        uint256 orderId = myOrderIds[orderIndex];

        try poolManager.claimFills(marketKey, orderId) {
            // Success
        } catch {
            // No fills or other issue
        }
    }

    // Helper for bounding values
    function bound(uint256 x, uint256 min, uint256 max) internal pure returns (uint256) {
        if (x < min) return min;
        if (x > max) return max;
        return x;
    }
}
