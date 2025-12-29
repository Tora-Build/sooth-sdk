// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {TickBookPoolManager, ILockCallback} from "../../contracts/TickBookPoolManager.sol";
import {TickBookVault} from "../../contracts/TickBookVault.sol";
import {TruthMarket} from "../../contracts/TruthMarket.sol";
import {OutcomeToken} from "../../contracts/OutcomeToken.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";
import {DynamicFeeHook} from "../../contracts/hooks/DynamicFeeHook.sol";
import {ITickBookHooks, HookPermissions} from "../../contracts/interfaces/ITickBookHooks.sol";

/**
 * @title Hook Callback Tests
 * @notice Tests for the 13-point hook system in TickBookPoolManager
 */
contract HookCallbackTest is Test {
    TickBookPoolManager public poolManager;
    TickBookVault public vault;
    TruthMarket public market;
    OutcomeToken public yesToken;
    OutcomeToken public noToken;
    ERC20Mock public usdc;
    DynamicFeeHook public feeHook;

    address public deployer;
    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);

    bytes32 public marketKey;
    bytes32 public marketKeyWithHook;
    uint256 constant WAD = 1e18;

    function setUp() public {
        deployer = address(this);

        // Deploy core contracts
        usdc = new ERC20Mock();
        vault = new TickBookVault(address(usdc), deployer);
        poolManager = new TickBookPoolManager(address(vault));
        vault.setTickBook(address(poolManager));

        // Deploy market
        market = new TruthMarket(
            "Hook Test Market",
            uint64(block.timestamp + 30 days),
            deployer,
            deployer
        );
        yesToken = new OutcomeToken("Yes", "YES", deployer, address(market), 1);
        noToken = new OutcomeToken("No", "NO", deployer, address(market), 0);
        market.activate();

        // Deploy hook
        feeHook = new DynamicFeeHook();

        // Register market WITHOUT hook first
        TickBookPoolManager.PoolKey memory keyNoHook = TickBookPoolManager.PoolKey({
            truthMarket: address(market),
            yesToken: address(yesToken),
            noToken: address(noToken),
            hook: address(0)
        });
        marketKey = poolManager.registerMarket(keyNoHook, 0.5e18);

        // Fund users
        usdc.mint(alice, 10_000_000e18);
        usdc.mint(bob, 10_000_000e18);

        vm.startPrank(alice);
        usdc.approve(address(vault), type(uint256).max);
        vault.depositUsdc(5_000_000e18);
        vm.stopPrank();

        vm.startPrank(bob);
        usdc.approve(address(vault), type(uint256).max);
        vault.depositUsdc(5_000_000e18);
        vm.stopPrank();
    }

    // ============================================
    // DynamicFeeHook Configuration Tests
    // ============================================

    function test_FeeHook_SetConfig() public {
        feeHook.setFeeConfig(
            marketKey,
            50,   // 0.5% base fee
            500,  // 5% max fee
            10,   // volume discount
            5     // volatility premium
        );

        (
            uint24 baseFee,
            uint24 maxFee,
            uint24 volumeDiscount,
            uint24 volatilityPremium,
            ,,,
        ) = feeHook.feeConfigs(marketKey);

        assertEq(baseFee, 50);
        assertEq(maxFee, 500);
        assertEq(volumeDiscount, 10);
        assertEq(volatilityPremium, 5);
    }

    function test_FeeHook_GetDynamicFee_BaseFee() public {
        feeHook.setFeeConfig(
            marketKey,
            100,  // 1% base
            200,  // 2% max
            0,    // no volume discount
            0     // no volatility premium
        );

        uint24 fee = feeHook.getDynamicFee(marketKey, 1, 1000e18, 0);
        assertEq(fee, 100); // Should return base fee
    }

    function test_FeeHook_GetDynamicFee_WithVolumeDiscount() public {
        feeHook.setFeeConfig(
            marketKey,
            100,  // 1% base
            200,  // 2% max
            50,   // 0.5% volume discount per unit
            0
        );

        // Higher volume should reduce fee
        uint24 feeSmall = feeHook.getDynamicFee(marketKey, 1, 100e18, 0);
        uint24 feeLarge = feeHook.getDynamicFee(marketKey, 1, 10000e18, 0);

        // Large volume should have same or lower fee (depending on implementation)
        assertLe(feeLarge, feeSmall);
    }

    function test_FeeHook_GetDynamicFee_WithVolatilityPremium() public {
        feeHook.setFeeConfig(
            marketKey,
            100,  // 1% base
            500,  // 5% max
            0,
            10    // volatility premium
        );

        // Higher price movement should increase fee
        uint24 feeNoMove = feeHook.getDynamicFee(marketKey, 1, 1000e18, 0);
        uint24 feeBigMove = feeHook.getDynamicFee(marketKey, 1, 1000e18, 100);

        // More volatility = higher fee
        assertGe(feeBigMove, feeNoMove);
    }

    function test_FeeHook_FeeNeverExceedsMax() public {
        feeHook.setFeeConfig(
            marketKey,
            100,  // 1% base
            200,  // 2% max
            0,
            1000  // very high volatility premium
        );

        // Even with extreme conditions, fee should not exceed max
        uint24 fee = feeHook.getDynamicFee(marketKey, 1, 1000e18, 1000);
        assertLe(fee, 200);
    }

    // ============================================
    // Hook Permission Tests
    // ============================================

    function test_HookPermissions_BeforePlaceOrder() public pure {
        // Bit 0
        address hook = address(uint160(1));
        assertTrue(HookPermissions.beforePlaceOrder(hook));

        address noHook = address(uint160(2)); // Bit 1, not bit 0
        assertFalse(HookPermissions.beforePlaceOrder(noHook));
    }

    function test_HookPermissions_AfterPlaceOrder() public pure {
        // Bit 1
        address hook = address(uint160(1 << 1));
        assertTrue(HookPermissions.afterPlaceOrder(hook));
    }

    function test_HookPermissions_BeforeExecuteOrder() public pure {
        // Bit 2
        address hook = address(uint160(1 << 2));
        assertTrue(HookPermissions.beforeExecuteOrder(hook));
    }

    function test_HookPermissions_AfterExecuteOrder() public pure {
        // Bit 3
        address hook = address(uint160(1 << 3));
        assertTrue(HookPermissions.afterExecuteOrder(hook));
    }

    function test_HookPermissions_GetDynamicFee() public pure {
        // Bit 8
        address hook = address(uint160(1 << 8));
        assertTrue(HookPermissions.getDynamicFee(hook));
    }

    function test_HookPermissions_MultipleFlags() public pure {
        // Address with multiple permission bits set
        uint160 flags = (1 << 0) | (1 << 1) | (1 << 8); // beforePlace + afterPlace + getDynamicFee
        address hook = address(flags);

        assertTrue(HookPermissions.beforePlaceOrder(hook));
        assertTrue(HookPermissions.afterPlaceOrder(hook));
        assertTrue(HookPermissions.getDynamicFee(hook));
        assertFalse(HookPermissions.beforeExecuteOrder(hook));
    }

    function test_HookPermissions_ZeroAddress() public pure {
        address noPerms = address(0);
        assertFalse(HookPermissions.beforePlaceOrder(noPerms));
        assertFalse(HookPermissions.afterPlaceOrder(noPerms));
        assertFalse(HookPermissions.getDynamicFee(noPerms));
    }

    // ============================================
    // Hook Integration Tests
    // ============================================

    function test_MarketWithNoHook_WorksNormally() public {
        vm.prank(alice);
        (uint256 orderId,,) = poolManager.placeRangeOrder(
            marketKey,
            1,
            400,
            600,
            1000e18
        );

        assertGt(orderId, 0);
    }

    function test_HookFeeConfig_PersistsAcrossMarkets() public {
        bytes32 fakeMarketKey = keccak256("fake_market");

        // Configure for fake market
        feeHook.setFeeConfig(fakeMarketKey, 75, 300, 15, 8);

        (uint24 baseFee,,,,,,, ) = feeHook.feeConfigs(fakeMarketKey);
        assertEq(baseFee, 75);

        // Original market should still have its config (if any)
        (uint24 origBase,,,,,,, ) = feeHook.feeConfigs(marketKey);
        // This would be 0 or whatever was set earlier
    }

    // ============================================
    // Fuzz Tests for Hooks
    // ============================================

    function testFuzz_FeeConfig_BoundsCheck(
        uint24 baseFee,
        uint24 maxFee,
        uint24 volumeDiscount,
        uint24 volatilityPremium
    ) public {
        // DynamicFeeHook has MIN_FEE=1, MAX_FEE=1000
        baseFee = uint24(bound(baseFee, 1, 1000)); // MIN_FEE to MAX_FEE
        maxFee = uint24(bound(maxFee, baseFee, 1000)); // baseFee to MAX_FEE
        volumeDiscount = uint24(bound(volumeDiscount, 0, 500));
        volatilityPremium = uint24(bound(volatilityPremium, 0, 500));

        feeHook.setFeeConfig(
            marketKey,
            baseFee,
            maxFee,
            volumeDiscount,
            volatilityPremium
        );

        uint24 fee = feeHook.getDynamicFee(marketKey, 1, 1000e18, 50);

        // Fee should be bounded by MAX_FEE (1000)
        assertLe(fee, 1000);
    }

    function testFuzz_HookPermissions_AnyAddress(address hook) public pure {
        // Just verify no revert
        HookPermissions.beforePlaceOrder(hook);
        HookPermissions.afterPlaceOrder(hook);
        HookPermissions.beforeExecuteOrder(hook);
        HookPermissions.afterExecuteOrder(hook);
        HookPermissions.getDynamicFee(hook);
    }

    // ============================================
    // Edge Cases
    // ============================================

    function test_FeeHook_ZeroSharesAmount() public {
        feeHook.setFeeConfig(marketKey, 100, 200, 10, 5);

        // Zero shares should still return valid fee
        uint24 fee = feeHook.getDynamicFee(marketKey, 1, 0, 0);
        assertEq(fee, 100); // Base fee
    }

    function test_FeeHook_MaxUint256Shares() public {
        feeHook.setFeeConfig(marketKey, 100, 200, 10, 5);

        // Very large shares
        uint24 fee = feeHook.getDynamicFee(marketKey, 1, type(uint256).max, 0);
        // Should not overflow, should return bounded fee
        assertLe(fee, 200);
    }
}
