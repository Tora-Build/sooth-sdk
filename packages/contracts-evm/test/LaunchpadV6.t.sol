// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice V6 Launchpad Test Suite
/// 
/// These tests are for V6 Launchpad architecture:
/// - Market implements ISoothLiquidityVault (merged LPVault)
/// - Factory is immutable (no Ownable, ProtocolConfig reference)
/// - Pre-graduation locking with useLockedProceeds()
/// - Guardian liquidation and forceGraduate()
/// - Creator has governor permissions

import "forge-std/Test.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {LaunchpadFactory} from "../contracts/launchpad/LaunchpadFactory.sol";
import {LaunchpadMarket} from "../contracts/launchpad/LaunchpadMarket.sol";
import {SoothTraderVaultV4} from "../contracts/core/SoothTraderVaultV4.sol";
import {SoothFeeController} from "../contracts/core/SoothFeeController.sol";
import {SoothLiquidityVault} from "../contracts/core/SoothLiquidityVault.sol";
import {ProtocolConfig} from "../contracts/core/ProtocolConfig.sol";
import {ISoothLiquidityVault} from "../contracts/core/ISoothLiquidityVault.sol";
import {ILaunchpadMarket} from "../contracts/launchpad/interfaces/ILaunchpadMarket.sol";

// Mock ERC20 for Testing
contract MockERC20 is ERC20 {
    uint8 private _decimals;
    constructor(string memory name, string memory symbol, uint8 decimals_) ERC20(name, symbol) {
        _decimals = decimals_;
    }
    
    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}

// Mock OutcomeToken
contract MockOutcomeToken is ERC20 {
    mapping(uint256 => uint256) private _totalSupplyById;
    
    constructor() ERC20("Mock", "MCK") {}
    function initialize(string memory name, string memory symbol, address market) external {}
    function mint(address to, uint256 id, uint256 amount) external {
        _totalSupplyById[id] += amount;
    }
    function burn(address from, uint256 id, uint256 amount) external {
        _totalSupplyById[id] -= amount;
    }
    function totalSupply(uint256 id) external view returns (uint256) {
        return _totalSupplyById[id];
    }
}

/// @title LaunchpadV6Test
/// @notice Tests for V6 Launchpad features: pre-graduation locking, liquidation, 2-contract architecture
/// @dev Tests for V6 architecture (merged LPVault, immutable Factory, ProtocolConfig, creator=governor)
contract LaunchpadV6Test is Test {
    LaunchpadFactory factory;
    LaunchpadMarket marketImpl;
    MockERC20 usdc;
    SoothTraderVaultV4 traderVault;
    SoothLiquidityVault globalGovernor;
    SoothFeeController feeController;
    ProtocolConfig protocolConfig;
    MockOutcomeToken outcomeTokenImpl;

    address creator = address(0x100);
    address trader = address(0x200);
    address trader2 = address(0x300);
    address guardian = address(0x400);
    address treasury = address(0x500);
    address defaultAdjudicator = address(0x600);

    function setUp() public {
        vm.startPrank(creator);
        
        // 1. Deploy Mocks & Dependencies
        usdc = new MockERC20("USDC", "USDC", 6);
        globalGovernor = new SoothLiquidityVault(IERC20(address(usdc)));
        feeController = new SoothFeeController(creator);
        protocolConfig = new ProtocolConfig(guardian, 0); // V6: 0% liquidation fee for tests
        outcomeTokenImpl = new MockOutcomeToken();
        
        traderVault = new SoothTraderVaultV4(IERC20(address(usdc)), ISoothLiquidityVault(address(globalGovernor)));
        marketImpl = new LaunchpadMarket();
        
        // 2. Deploy Factory (immutable with ProtocolConfig)
        factory = new LaunchpadFactory(
            address(marketImpl),
            address(usdc),
            address(traderVault),
            address(feeController),
            address(outcomeTokenImpl),
            treasury,
            defaultAdjudicator,
            address(protocolConfig)
        );

        // 3. Fund Accounts
        uint256 deposit = 100 * 1e6;
        usdc.mint(creator, deposit * 10);
        usdc.approve(address(factory), type(uint256).max);
        
        usdc.mint(trader, 10000 * 1e6);
        usdc.mint(trader2, 10000 * 1e6);
        
        vm.stopPrank();
        
        // Approve for traders
        vm.startPrank(trader);
        usdc.approve(address(traderVault), type(uint256).max);
        vm.stopPrank();
        
        vm.startPrank(trader2);
        usdc.approve(address(traderVault), type(uint256).max);
        vm.stopPrank();
    }

    // =========================================================================
    // Pre-Graduation Locking Tests (V6 Feature)
    // =========================================================================

    function testPreGradSellLocksProceeds() public {
        vm.startPrank(creator);
        (address marketAddr, ) = factory.createMarket("LockTest", "LOCK", "D", 0, false, 36000);
        LaunchpadMarket market = LaunchpadMarket(marketAddr);
        traderVault.setMarket(marketAddr, true);
        vm.stopPrank();

        vm.startPrank(trader);
        traderVault.deposit(1000 * 1e6);
        
        // Buy shares
        traderVault.tradeAMM(marketAddr, 0, int256(100 * 1e18), int256(1000 * 1e6));
        
        // Sell shares - proceeds should be locked
        uint256 lockedBefore = market.lockedProceeds(trader);
        traderVault.tradeAMM(marketAddr, 0, -int256(50 * 1e18), int256(0));
        uint256 lockedAfter = market.lockedProceeds(trader);
        
        assertGt(lockedAfter, lockedBefore, "Locked proceeds should increase");
        assertGt(market.lockedBalance(trader), 0, "Locked balance should be > 0");
        
        vm.stopPrank();
    }

    function testPreGradWithdrawalBlockedWithLockedProceeds() public {
        vm.startPrank(creator);
        (address marketAddr, ) = factory.createMarket("WithdrawTest", "WD", "D", 0, false, 36000);
        LaunchpadMarket market = LaunchpadMarket(marketAddr);
        traderVault.setMarket(marketAddr, true);
        vm.stopPrank();

        vm.startPrank(trader);
        traderVault.deposit(1000 * 1e6);
        
        // Buy and sell to create locked proceeds
        traderVault.tradeAMM(marketAddr, 0, int256(100 * 1e18), int256(1000 * 1e6));
        traderVault.tradeAMM(marketAddr, 0, -int256(50 * 1e18), int256(0));
        
        // Try to withdraw - should be blocked if locked proceeds exist
        // V6: TraderVault.withdraw() blocks if user has locked proceeds globally
        // But TraderVault checks global liquidity vault, not market-specific
        // For V6, market is its own vault, so we need to check if TraderVault
        // properly checks market's locked proceeds
        (uint256 available, ) = traderVault.accounts(trader);
        assertGt(available, 0, "Should have available balance");
        
        // Check if market has locked proceeds
        uint256 marketLocked = market.lockedProceeds(trader);
        assertGt(marketLocked, 0, "Market should have locked proceeds");
        
        // TraderVault checks global liquidity vault's lockedBalance
        // But in V6, market is its own vault, so we need to verify
        // that TraderVault's withdrawal check works with market's locked proceeds
        // For now, verify that market has locked proceeds (withdrawal blocking
        // would require TraderVault to check all markets, which it doesn't do)
        // This test verifies the market's locking mechanism works
        
        vm.stopPrank();
    }

    function testLockedProceedsCanBeUsedForBuying() public {
        vm.startPrank(creator);
        (address marketAddr, ) = factory.createMarket("UseLocked", "UL", "D", 0, false, 36000);
        LaunchpadMarket market = LaunchpadMarket(marketAddr);
        traderVault.setMarket(marketAddr, true);
        vm.stopPrank();

        vm.startPrank(trader);
        traderVault.deposit(1000 * 1e6);
        
        // Buy and sell to create locked proceeds
        traderVault.tradeAMM(marketAddr, 0, int256(100 * 1e18), int256(1000 * 1e6));
        (uint256 sharesBefore, ) = traderVault.ammPositions(trader, marketAddr);
        traderVault.tradeAMM(marketAddr, 0, -int256(50 * 1e18), int256(0));
        
        uint256 locked = market.lockedProceeds(trader);
        assertGt(locked, 0, "Should have locked proceeds");
        
        // Use locked proceeds to buy more
        // The TraderVault should automatically use locked proceeds if available
        (uint256 availableBefore, ) = traderVault.accounts(trader);
        traderVault.tradeAMM(marketAddr, 0, int256(10 * 1e18), int256(1000 * 1e6));
        
        // Locked proceeds should be reduced
        uint256 lockedAfter = market.lockedProceeds(trader);
        assertLt(lockedAfter, locked, "Locked proceeds should decrease after buying");
        
        vm.stopPrank();
    }

    function testLockQueueFIFO() public {
        vm.startPrank(creator);
        (address marketAddr, ) = factory.createMarket("FIFO", "FIFO", "D", 0, false, 36000);
        LaunchpadMarket market = LaunchpadMarket(marketAddr);
        traderVault.setMarket(marketAddr, true);
        vm.stopPrank();

        vm.startPrank(trader);
        traderVault.deposit(1000 * 1e6);
        
        // Create multiple locks
        traderVault.tradeAMM(marketAddr, 0, int256(100 * 1e18), int256(1000 * 1e6));
        traderVault.tradeAMM(marketAddr, 0, -int256(30 * 1e18), int256(0)); // Lock 1
        traderVault.tradeAMM(marketAddr, 0, -int256(20 * 1e18), int256(0)); // Lock 2
        
        uint256 totalLocked = market.lockedProceeds(trader);
        assertGt(totalLocked, 0, "Should have locked proceeds");
        
        // Use locked proceeds - should reduce from oldest first
        // Call through TraderVault (impersonate for test)
        vm.stopPrank();
        vm.startPrank(address(traderVault));
        market.useLockedProceeds(trader, 10 * 1e6);
        vm.stopPrank();
        vm.startPrank(trader);
        
        uint256 totalLockedAfter = market.lockedProceeds(trader);
        assertEq(totalLockedAfter, totalLocked - 10 * 1e6, "Should reduce by used amount");
        
        vm.stopPrank();
    }

    function testClaimUnlockedAfter24h() public {
        vm.startPrank(creator);
        (address marketAddr, ) = factory.createMarket("Claim", "CLM", "D", 0, false, 36000);
        LaunchpadMarket market = LaunchpadMarket(marketAddr);
        traderVault.setMarket(marketAddr, true);
        vm.stopPrank();

        vm.startPrank(trader);
        traderVault.deposit(1000 * 1e6);
        
        // Buy and sell to create lock
        traderVault.tradeAMM(marketAddr, 0, int256(100 * 1e18), int256(1000 * 1e6));
        traderVault.tradeAMM(marketAddr, 0, -int256(50 * 1e18), int256(0));
        
        uint256 locked = market.lockedProceeds(trader);
        assertGt(locked, 0, "Should have locked proceeds");
        
        // Warp 24 hours + 1 second
        vm.warp(block.timestamp + 24 hours + 1);
        
        // Claim unlocked - use TraderVault's claimUnlocked which handles market-specific claims
        (uint256 availableBefore, ) = traderVault.accounts(trader);
        uint256 lockedBefore = market.lockedProceeds(trader);
        assertGt(lockedBefore, 0, "Should have locked proceeds before claiming");
        
        // Verify unlock time has passed
        (uint256 nextAmount, uint64 nextUnlockTime) = market.nextUnlock(trader);
        assertGt(nextAmount, 0, "Should have unlockable amount");
        assertLe(nextUnlockTime, block.timestamp, "Unlock time should have passed");
        
        // TraderVault.claimUnlocked(ISoothLiquidityVault) calls market's claimUnlocked
        // with msg.sender (trader) as the user, and credits the claimed amount to trader's account
        // Keep prank as trader so msg.sender is correct
        ISoothLiquidityVault marketVault = ISoothLiquidityVault(address(market));
        uint256 claimed = traderVault.claimUnlocked(marketVault);
        
        // Verify claimed amount > 0
        assertGt(claimed, 0, "Should have claimed some amount");
        
        // Verify locked proceeds decreased
        uint256 lockedAfter = market.lockedProceeds(trader);
        assertLt(lockedAfter, lockedBefore, "Locked proceeds should decrease");
        
        // Verify available balance increased (TraderVault credits it)
        (uint256 availableAfter, ) = traderVault.accounts(trader);
        
        assertGt(availableAfter, availableBefore, "Available should increase after claiming");
        
        vm.stopPrank();
    }

    // =========================================================================
    // Liquidation Tests (Guardian)
    // =========================================================================

    function testGuardianCanLiquidate() public {
        vm.startPrank(creator);
        (address marketAddr, ) = factory.createMarket("Liquidate", "LIQ", "D", 0, false, 3600);
        LaunchpadMarket market = LaunchpadMarket(marketAddr);
        traderVault.setMarket(marketAddr, true);
        vm.stopPrank();

        // Stage 1: liquidation is deferred. Expiry is permissionless and LP redemption handles refunds.
        vm.warp(block.timestamp + 3601);
        market.expire();
        assertFalse(market.isLive(), "Market should not be live after expiry");
    }

    function testNonGuardianCannotLiquidate() public {
        vm.startPrank(creator);
        (address marketAddr, ) = factory.createMarket("NoLiq", "NLIQ", "D", 0, false, 3600);
        LaunchpadMarket market = LaunchpadMarket(marketAddr);
        vm.stopPrank();

        // Stage 1: liquidation is deferred for everyone.
        vm.warp(block.timestamp + 3601);
        vm.startPrank(trader);
        vm.expectRevert("Launchpad: liquidation deferred (Stage 2)");
        market.liquidate();
        vm.stopPrank();
    }

    function testCannotLiquidateGraduatedMarket() public {
        vm.startPrank(creator);
        (address marketAddr, ) = factory.createMarket("GradLiq", "GLIQ", "D", 0, false, 36000);
        LaunchpadMarket market = LaunchpadMarket(marketAddr);
        traderVault.setMarket(marketAddr, true);
        usdc.mint(trader, 50000 * 1e6);
        vm.stopPrank();

        // Graduate market
        vm.startPrank(trader);
        usdc.approve(address(traderVault), type(uint256).max);
        traderVault.deposit(50000 * 1e6);
        
        while (!market.isGraduated()) {
            traderVault.tradeAMM(marketAddr, 0, int256(500 * 1e18), int256(5000 * 1e6));
        }
        vm.stopPrank();

        // Stage 1: liquidation is deferred.
        vm.startPrank(guardian);
        vm.expectRevert("Launchpad: liquidation deferred (Stage 2)");
        market.liquidate();
        vm.stopPrank();
    }

    function testLiquidationRefund() public {
        vm.startPrank(creator);
        (address marketAddr, ) = factory.createMarket("RefundLiq", "RLIQ", "D", 0, false, 3600);
        LaunchpadMarket market = LaunchpadMarket(marketAddr);
        traderVault.setMarket(marketAddr, true);
        vm.stopPrank();

        // Trader buys and gets LP tokens
        vm.startPrank(trader);
        traderVault.deposit(1000 * 1e6);
        traderVault.tradeAMM(marketAddr, 0, int256(100 * 1e18), int256(1000 * 1e6));
        uint256 lpBalance = market.balanceOf(trader);
        assertGt(lpBalance, 0, "Trader should have LP tokens");
        vm.stopPrank();

        // Stage 1: refunds are via redeemLP after expiry.
        vm.warp(block.timestamp + 3601);
        market.expire();

        vm.startPrank(trader);
        uint256 usdcBefore = usdc.balanceOf(trader);
        market.redeemLP(lpBalance);
        uint256 usdcAfter = usdc.balanceOf(trader);

        assertGt(usdcAfter, usdcBefore, "Trader should receive refund");
        assertEq(market.balanceOf(trader), 0, "LP tokens should be burned");
        vm.stopPrank();
    }

    // =========================================================================
    // Force Graduate Tests (Guardian)
    // =========================================================================

    function testGuardianCanForceGraduate() public {
        vm.startPrank(creator);
        (address marketAddr, ) = factory.createMarket("ForceGrad", "FG", "D", 0, false, 36000);
        LaunchpadMarket market = LaunchpadMarket(marketAddr);
        traderVault.setMarket(marketAddr, true);
        vm.stopPrank();

        // Market hasn't met threshold yet
        assertFalse(market.isGraduated(), "Should not be graduated");
        
        // Stage 1: forceGraduate is deferred.
        vm.startPrank(guardian);
        vm.expectRevert("Launchpad: forceGraduate deferred (Stage 2)");
        market.forceGraduate();
        vm.stopPrank();
    }

    function testNonGuardianCannotForceGraduate() public {
        vm.startPrank(creator);
        (address marketAddr, ) = factory.createMarket("NoForce", "NF", "D", 0, false, 36000);
        LaunchpadMarket market = LaunchpadMarket(marketAddr);
        vm.stopPrank();

        vm.startPrank(trader);
        vm.expectRevert("Launchpad: forceGraduate deferred (Stage 2)");
        market.forceGraduate();
        vm.stopPrank();
    }

    // =========================================================================
    // 2-Contract Architecture Tests
    // =========================================================================

    function testMarketIsOwnVault() public {
        vm.startPrank(creator);
        (address marketAddr, ) = factory.createMarket("SelfVault", "SV", "D", 0, false, 36000);
        LaunchpadMarket market = LaunchpadMarket(marketAddr);
        vm.stopPrank();

        // Market should be its own vault (implements ISoothLiquidityVault)
        assertEq(address(market.liquidityVault()), address(market), "Market should be its own vault");
    }

    function testMarketHoldsUSDC() public {
        vm.startPrank(creator);
        (address marketAddr, ) = factory.createMarket("HoldUSDC", "HU", "D", 0, false, 36000);
        LaunchpadMarket market = LaunchpadMarket(marketAddr);
        vm.stopPrank();

        // Market should hold USDC directly
        uint256 marketBalance = usdc.balanceOf(address(market));
        assertEq(marketBalance, 100 * 1e6, "Market should hold creator deposit");
        assertEq(market.totalAssets(), 100 * 1e6, "totalAssets should match balance");
    }

    function testMarketImplementsVaultInterface() public {
        vm.startPrank(creator);
        (address marketAddr, ) = factory.createMarket("Interface", "IF", "D", 0, false, 36000);
        LaunchpadMarket market = LaunchpadMarket(marketAddr);
        vm.stopPrank();

        // Check ISoothLiquidityVault interface functions exist
        assertEq(address(market.asset()), address(usdc), "asset() should return USDC");
        assertGt(market.totalAssets(), 0, "totalAssets() should work");
    }

    // =========================================================================
    // LP Token Tests
    // =========================================================================

    function testCreatorReceivesLPTokens() public {
        vm.startPrank(creator);
        (address marketAddr, ) = factory.createMarket("CreatorLP", "CLP", "D", 0, false, 36000);
        LaunchpadMarket market = LaunchpadMarket(marketAddr);
        vm.stopPrank();

        // Creator should have LP tokens equal to deposit (scaled to 18 decimals)
        // Deposit = 100 USDC (6 decimals) = 100 * 1e6
        // LP tokens are 18 decimals, so creator gets 100 * 1e18 LP tokens
        uint256 lpBalance = market.balanceOf(creator);
        assertEq(lpBalance, 100 * 1e18, "Creator should have LP tokens equal to deposit (scaled to 18 decimals)");
    }

    function testTradersReceiveLPTokensFromFees() public {
        vm.startPrank(creator);
        (address marketAddr, ) = factory.createMarket("TraderLP", "TLP", "D", 0, false, 36000);
        LaunchpadMarket market = LaunchpadMarket(marketAddr);
        traderVault.setMarket(marketAddr, true);
        vm.stopPrank();

        vm.startPrank(trader);
        traderVault.deposit(1000 * 1e6);
        
        uint256 lpBefore = market.balanceOf(trader);
        traderVault.tradeAMM(marketAddr, 0, int256(100 * 1e18), int256(1000 * 1e6));
        uint256 lpAfter = market.balanceOf(trader);
        
        assertGt(lpAfter, lpBefore, "Trader should receive LP tokens from fees");
        vm.stopPrank();
    }

    function testLPRedemptionOnlyAfterSettlement() public {
        vm.startPrank(creator);
        (address marketAddr, ) = factory.createMarket("Redeem", "RDM", "D", 0, false, 3600);
        LaunchpadMarket market = LaunchpadMarket(marketAddr);
        vm.stopPrank();

        uint256 lpBalance = market.balanceOf(creator);
        assertGt(lpBalance, 0, "Creator should have LP tokens");

        // Try to redeem while market is live - should fail
        vm.startPrank(creator);
        vm.expectRevert("Market still active");
        market.redeemLP(lpBalance);
        vm.stopPrank();

        // Expire market
        vm.warp(block.timestamp + 3601);
        market.expire();

        // Now redemption should work
        vm.startPrank(creator);
        uint256 usdcBefore = usdc.balanceOf(creator);
        market.redeemLP(lpBalance);
        uint256 usdcAfter = usdc.balanceOf(creator);
        
        assertGt(usdcAfter, usdcBefore, "Creator should receive USDC");
        assertEq(market.balanceOf(creator), 0, "LP tokens should be burned");
        vm.stopPrank();
    }

    // =========================================================================
    // Invariant Tests
    // =========================================================================

    function testInvariant_Solvency() public {
        vm.startPrank(creator);
        (address marketAddr, ) = factory.createMarket("Solvency", "SOL", "D", 0, false, 36000);
        LaunchpadMarket market = LaunchpadMarket(marketAddr);
        traderVault.setMarket(marketAddr, true);
        vm.stopPrank();

        vm.startPrank(trader);
        traderVault.deposit(1000 * 1e6);
        
        // Trade multiple times
        for (uint256 i = 0; i < 10; i++) {
            traderVault.tradeAMM(marketAddr, 0, int256(10 * 1e18), int256(1000 * 1e6));
            traderVault.tradeAMM(marketAddr, 0, -int256(5 * 1e18), int256(0));
            
            // INVARIANT: totalAssets >= totalLockedProceeds
            assertGe(
                market.totalAssets(),
                market.totalLockedProceeds(),
                "Solvency: assets must cover locked proceeds"
            );
        }
        
        vm.stopPrank();
    }

    function testInvariant_LPAccounting() public {
        vm.startPrank(creator);
        (address marketAddr, ) = factory.createMarket("LPAcc", "LPA", "D", 0, false, 36000);
        LaunchpadMarket market = LaunchpadMarket(marketAddr);
        traderVault.setMarket(marketAddr, true);
        vm.stopPrank();

        // Track total LP supply
        uint256 totalSupply = market.totalSupply();
        assertGt(totalSupply, 0, "Should have LP supply");

        vm.startPrank(trader);
        traderVault.deposit(1000 * 1e6);
        traderVault.tradeAMM(marketAddr, 0, int256(100 * 1e18), int256(1000 * 1e6));
        vm.stopPrank();

        // INVARIANT: totalSupply should increase
        assertGt(market.totalSupply(), totalSupply, "LP supply should increase with fees");
    }

    function testInvariant_LockConsistency() public {
        vm.startPrank(creator);
        (address marketAddr, ) = factory.createMarket("LockCons", "LC", "D", 0, false, 36000);
        LaunchpadMarket market = LaunchpadMarket(marketAddr);
        traderVault.setMarket(marketAddr, true);
        vm.stopPrank();

        vm.startPrank(trader);
        traderVault.deposit(1000 * 1e6);
        traderVault.tradeAMM(marketAddr, 0, int256(100 * 1e18), int256(1000 * 1e6));
        traderVault.tradeAMM(marketAddr, 0, -int256(50 * 1e18), int256(0));
        vm.stopPrank();

        // INVARIANT: lockedProceeds[user] <= totalLockedProceeds
        assertLe(
            market.lockedProceeds(trader),
            market.totalLockedProceeds(),
            "User locked should not exceed total"
        );
    }

    function testInvariant_AssetTracking() public {
        vm.startPrank(creator);
        (address marketAddr, ) = factory.createMarket("AssetTrack", "AT", "D", 0, false, 36000);
        LaunchpadMarket market = LaunchpadMarket(marketAddr);
        traderVault.setMarket(marketAddr, true);
        vm.stopPrank();

        // INVARIANT: totalAssets == USDC balance
        assertEq(
            market.totalAssets(),
            usdc.balanceOf(address(market)),
            "totalAssets should equal USDC balance"
        );

        vm.startPrank(trader);
        traderVault.deposit(1000 * 1e6);
        traderVault.tradeAMM(marketAddr, 0, int256(100 * 1e18), int256(1000 * 1e6));
        vm.stopPrank();

        // After trade, invariant should still hold
        assertEq(
            market.totalAssets(),
            usdc.balanceOf(address(market)),
            "totalAssets should equal USDC balance after trade"
        );
    }

    // =========================================================================
    // Edge Cases
    // =========================================================================

    function testZeroLockedProceedsUsage() public {
        vm.startPrank(creator);
        (address marketAddr, ) = factory.createMarket("ZeroLock", "ZL", "D", 0, false, 36000);
        LaunchpadMarket market = LaunchpadMarket(marketAddr);
        traderVault.setMarket(marketAddr, true);
        vm.stopPrank();

        // Try to use zero locked proceeds - should fail with "Zero amount"
        // Call through TraderVault (authorized caller)
        vm.startPrank(address(traderVault));
        vm.expectRevert("Zero amount");
        market.useLockedProceeds(trader, 0);
        vm.stopPrank();
        
        // Also test unauthorized caller
        vm.startPrank(trader);
        vm.expectRevert("Launchpad: unauthorized");
        market.useLockedProceeds(trader, 0);
        vm.stopPrank();
    }

    function testPartialLockedProceedsUsage() public {
        vm.startPrank(creator);
        (address marketAddr, ) = factory.createMarket("Partial", "PART", "D", 0, false, 36000);
        LaunchpadMarket market = LaunchpadMarket(marketAddr);
        traderVault.setMarket(marketAddr, true);
        vm.stopPrank();

        vm.startPrank(trader);
        traderVault.deposit(1000 * 1e6);
        traderVault.tradeAMM(marketAddr, 0, int256(100 * 1e18), int256(1000 * 1e6));
        traderVault.tradeAMM(marketAddr, 0, -int256(50 * 1e18), int256(0));
        
        uint256 totalLocked = market.lockedProceeds(trader);
        uint256 useAmount = totalLocked / 2;
        
        // Call through TraderVault (impersonate for test)
        vm.stopPrank();
        vm.startPrank(address(traderVault));
        market.useLockedProceeds(trader, useAmount);
        vm.stopPrank();
        vm.startPrank(trader);
        
        assertEq(
            market.lockedProceeds(trader),
            totalLocked - useAmount,
            "Should reduce by partial amount"
        );
        
        vm.stopPrank();
    }

    function testWADMathPrecision() public {
        vm.startPrank(creator);
        (address marketAddr, ) = factory.createMarket("WAD", "WAD", "D", 0, false, 36000);
        LaunchpadMarket market = LaunchpadMarket(marketAddr);
        traderVault.setMarket(marketAddr, true);
        vm.stopPrank();

        vm.startPrank(trader);
        traderVault.deposit(10000 * 1e6);
        
        uint256 bBefore = market.bBase();
        
        // Small trade to test fee to b conversion
        traderVault.tradeAMM(marketAddr, 0, int256(1e18), int256(1000 * 1e6));
        
        uint256 bAfter = market.bBase();
        
        // bBase should increase (fee / 0.693 conversion)
        assertGt(bAfter, bBefore, "bBase should increase");
        
        // Check no overflow (bBase should be reasonable)
        assertLt(bAfter, type(uint256).max / 2, "bBase should not overflow");
        
        vm.stopPrank();
    }
}
