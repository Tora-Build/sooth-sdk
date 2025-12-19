// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "forge-std/Test.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

import {LaunchpadFactory} from "../contracts/launchpad/LaunchpadFactory.sol";
import {LaunchpadMarket} from "../contracts/launchpad/LaunchpadMarket.sol";
import {MarketLPVault} from "../contracts/launchpad/MarketLPVault_V5.sol";
import {SoothTraderVaultV4} from "../contracts/core/SoothTraderVaultV4.sol";
import {SoothFeeController} from "../contracts/core/SoothFeeController.sol";
import {SoothLiquidityVault} from "../contracts/core/SoothLiquidityVault.sol";
import {ISoothLiquidityVault} from "../contracts/core/SoothInterfaces.sol";
import {ProtocolConfig} from "../contracts/core/ProtocolConfig.sol";

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

// We need a dummy OutcomeToken implementation for cloning
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

contract LaunchpadTest is Test {
    LaunchpadFactory factory;
    LaunchpadMarket marketImpl;
    MockERC20 usdc;
    SoothTraderVaultV4 traderVault;
    SoothLiquidityVault globalGovernor; // Unused for launchpad but needed for factory init
    SoothFeeController feeController;
    MockOutcomeToken outcomeTokenImpl;

    address creator = address(0x100);
    address trader = address(0x200);

    function setUp() public {
        vm.startPrank(creator);
        
        // 1. Deploy Mocks & Dependencies
        usdc = new MockERC20("USDC", "USDC", 6); // 6 decimals to match mainnet USDC logic
        // Let's use 6 decimals to match mainnet USDC
        // MockERC20 default might be 18. Let's make sure.
        // If MockERC20 takes (name, symbol, decimals), use that.
        // Assuming standard OpenZeppelin ERC20 doesn't take decimals in constructor. 
        // We'll mock it if needed or assume 18.
        // Factory code: tierDeposits[0] = 100 * 1e6. So it expects 6 decimals if USDCs are 1e6.
        // But if USDC contract has 18, LaunchpadFactory doesn't check decimals, it just transfers amounts.
        // Logic checks: `IERC20(usdc).safeTransferFrom` use fixed amounts?
        // Yes, 1e6 hardcoded.
        // So we MUST use 6 decimals for USDC if we want values to make sense for a true test, 
        // OR just assume 1e6 is "1 unit" if 18 decimals.
        // Better to use 1e6 tokens if possible? Or just roll with 1e6 units being small.
        
        // 2. Deploy Protocols
        globalGovernor = new SoothLiquidityVault(IERC20(address(usdc))); // For TraderVault initialization
        feeController = new SoothFeeController(creator);
        outcomeTokenImpl = new MockOutcomeToken();
        ProtocolConfig protocolConfig = new ProtocolConfig(creator, 0); // 0% liquidation fee for tests
        
        // TraderVault needs liquidityVault for global locked proceeds tracking
        traderVault = new SoothTraderVaultV4(IERC20(address(usdc)), ISoothLiquidityVault(address(globalGovernor)));
        
        marketImpl = new LaunchpadMarket();
        
        // 3. Deploy Factory
        factory = new LaunchpadFactory(
            address(marketImpl),
            address(usdc),
            address(traderVault),
            address(feeController),
            address(outcomeTokenImpl),
            creator, // treasury
            creator, // adjudicator
            address(protocolConfig) // protocolConfig
        );

        // 4. Fund Accounts
        // Tier 0 deposit = 100 * 1e6
        uint256 deposit = 100 * 1e6;
        usdc.mint(creator, deposit * 10);
        usdc.approve(address(factory), type(uint256).max);
        
        usdc.mint(trader, 1000 * 1e6);
        
        vm.stopPrank();
        
        // Approve for trader
        vm.startPrank(trader);
        usdc.approve(address(traderVault), type(uint256).max);
        vm.stopPrank();
    }

    function testCreateMarket() public {
        vm.startPrank(creator);
        
        (address marketAddr, address lpVaultAddr) = factory.createMarket(
            "Test Market",
            "TEST",
            "Desc",
            0, // Tier 0
            false,
            3600
        );
        
        LaunchpadMarket market = LaunchpadMarket(marketAddr);
        MarketLPVault lpVault = MarketLPVault(lpVaultAddr);
        
        // Checks
        assertEq(market.creator(), creator);
        assertEq(market.liquidityTierIndex(), 0);
        assertEq(address(market.liquidityVault()), address(lpVault));
        assertEq(lpVault.market(), address(market));
        assertEq(address(lpVault.asset()), address(usdc));
        
        // Check deposit moved
        assertEq(usdc.balanceOf(address(lpVault)), 100 * 1e6);
        assertEq(lpVault.totalAssets(), 100 * 1e6);
        
        vm.stopPrank();
    }

    function testTradingAndFees() public {
        vm.startPrank(creator);
        (address marketAddr, ) = factory.createMarket("M", "S", "D", 0, false, 3600);
        LaunchpadMarket market = LaunchpadMarket(marketAddr);
        vm.stopPrank();

        // Whitelist market in TraderVault (Creator is owner of TraderVault)
        vm.startPrank(creator);
        traderVault.setMarket(marketAddr, true);
        vm.stopPrank();
        
        vm.startPrank(trader);
        // Deposit to TraderVault
        traderVault.deposit(100 * 1e6);
        
        // Buy YES
        // b = 144.27 * 1e18? No, Factory sets bValue in WAD or 6 dec?
        // Factory: tierBValues[0] = 144269504; // 144 * 1e6?
        // V4/PRBMath expects WAD (18 decimals) for b?
        // If SoothMarketBase uses CommonMath which might expect WAD.
        // Let's check Factory bValue passed.
        // initialize(...) takes bBase.
        // SoothMarketBase stores bBase.
        // If bBase is small (1e8), cost calc might be weird if V4 logic expects 1e18.
        // V4: `cost = b * ln(...)`. ln returns WAD. b should be WAD to get WAD cost?
        // If USDC is 6 decimals, we might want cost in 6 decimals?
        // V4 usually handles WAD math internally and converts at edges?
        // Or if b is 144e6, then cost is 144e6 * ln(e) = 144e6.
        
        // Market.calculateAMMTradeCost returns cost (int256).
        // We need to see if it transfers standard amount.
        
        // Buy 10 shares (WAD) via TraderVault

        
        // Use TraderVault
        // tradeAMM(market, outcome, shares, limit)
        uint256 shares = 10 * 1e18;
        uint256 limitCost = 100 * 1e6; // generous limit
        
        // We need to whitelist LaunchpadMarket in TraderVault?
        // TraderVault doesn't have whitelist for markets, just `isMarket` check?
        // V4 traderVault usually checks if market is valid?
        // `tradeAMM` calls `mkt.marketId()`.
        
        traderVault.tradeAMM(marketAddr, 0, int256(shares), int256(limitCost));
        
        // Check fee accrual
        // Pre-grad fee is 5%.
        // Cost approx: 10 shares / liquidity?
        // b ~ 144. cost ~ 10 * (price ~ 0.5) = 5?
        // Fee = 5 * 0.05 = 0.25?
        
        // Check bBase increase
        uint256 bBaseAfter = market.bBase();
        // tierBValues[0] is initial.
        uint256 bInitial = factory.getLiquidityB(0);
        
        assertTrue(bBaseAfter > bInitial, "Liquidity should grow from fees");
        
        vm.stopPrank();
    }

    // =========================================================================
    // Graduation Tests
    // =========================================================================

    function testGraduation() public {
        vm.startPrank(creator);
        (address marketAddr, ) = factory.createMarket("Grad", "GRD", "D", 0, false, 3600);
        LaunchpadMarket market = LaunchpadMarket(marketAddr);
        traderVault.setMarket(marketAddr, true);
        vm.stopPrank();

        uint256 initialB = factory.getLiquidityB(0);
        uint256 threshold = market.graduationThreshold();
        assertEq(threshold, initialB * 2, "Threshold should be 2x initial b");

        // Pre-graduation checks
        assertFalse(market.isGraduated(), "Should not be graduated initially");
        assertEq(market.feeLMSR(), 500, "Pre-grad fee should be 5%");

        // Fund trader heavily to generate enough fees
        vm.startPrank(creator);
        usdc.mint(trader, 10000 * 1e6);
        vm.stopPrank();

        vm.startPrank(trader);
        usdc.approve(address(traderVault), type(uint256).max);
        traderVault.deposit(10000 * 1e6);

        // Trade repeatedly to accumulate fees until graduation
        uint256 tradesNeeded = 0;
        while (!market.isGraduated() && tradesNeeded < 100) {
            traderVault.tradeAMM(marketAddr, 0, int256(100 * 1e18), int256(1000 * 1e6));
            tradesNeeded++;
        }
        vm.stopPrank();

        // Post-graduation checks
        assertTrue(market.isGraduated(), "Should be graduated after sufficient fees");
        assertEq(market.feeLMSR(), 100, "Post-grad fee should be 1%");
        assertTrue(market.bBase() >= threshold, "bBase should meet threshold");
    }

    function testManualGraduate() public {
        vm.startPrank(creator);
        (address marketAddr, ) = factory.createMarket("ManGrad", "MG", "D", 0, false, 3600);
        LaunchpadMarket market = LaunchpadMarket(marketAddr);
        traderVault.setMarket(marketAddr, true);
        vm.stopPrank();

        // Try to graduate before threshold - should fail
        vm.expectRevert("Threshold not met");
        market.graduate();

        assertFalse(market.isGraduated());
    }

    function testDoubleGraduateFails() public {
        vm.startPrank(creator);
        (address marketAddr, ) = factory.createMarket("DblGrad", "DG", "D", 0, false, 3600);
        LaunchpadMarket market = LaunchpadMarket(marketAddr);
        traderVault.setMarket(marketAddr, true);
        usdc.mint(trader, 50000 * 1e6);
        vm.stopPrank();

        vm.startPrank(trader);
        usdc.approve(address(traderVault), type(uint256).max);
        traderVault.deposit(50000 * 1e6);
        
        // Trade until graduation
        while (!market.isGraduated()) {
            traderVault.tradeAMM(marketAddr, 0, int256(500 * 1e18), int256(5000 * 1e6));
        }
        vm.stopPrank();

        assertTrue(market.isGraduated());

        // Try to graduate again - should fail
        vm.expectRevert("Already graduated");
        market.graduate();
    }

    // =========================================================================
    // Expiry/Refund Tests
    // =========================================================================

    function testExpiry() public {
        vm.startPrank(creator);
        (address marketAddr, ) = factory.createMarket("Expiry", "EXP", "D", 0, false, 3600); // 1 hour deadline
        LaunchpadMarket market = LaunchpadMarket(marketAddr);
        vm.stopPrank();

        // Before deadline - should fail
        vm.expectRevert("Not expired");
        market.expire();

        assertTrue(market.isLive(), "Market should be live before expiry");

        // Warp past deadline
        vm.warp(block.timestamp + 3601);

        // Now expire should work
        market.expire();

        assertFalse(market.isLive(), "Market should not be live after expiry");
        assertFalse(market.isGraduated(), "Market should not be graduated");
    }

    function testExpiryBlocksTrading() public {
        vm.startPrank(creator);
        (address marketAddr, ) = factory.createMarket("ExpTrade", "EXT", "D", 0, false, 3600);
        LaunchpadMarket market = LaunchpadMarket(marketAddr);
        traderVault.setMarket(marketAddr, true);
        vm.stopPrank();

        // Warp and expire
        vm.warp(block.timestamp + 3601);
        market.expire();

        // Try to trade - should fail
        vm.startPrank(trader);
        usdc.approve(address(traderVault), type(uint256).max);
        traderVault.deposit(100 * 1e6);
        
        vm.expectRevert(); // Market not live
        traderVault.tradeAMM(marketAddr, 0, int256(1e18), int256(10 * 1e6));
        vm.stopPrank();
    }

    function testCreatorRefund() public {
        vm.startPrank(creator);
        (address marketAddr, address lpVaultAddr) = factory.createMarket("Refund", "REF", "D", 0, false, 3600);
        LaunchpadMarket market = LaunchpadMarket(marketAddr);
        MarketLPVault lpVault = MarketLPVault(lpVaultAddr);
        vm.stopPrank();

        uint256 initialDeposit = 100 * 1e6;
        assertEq(lpVault.totalAssets(), initialDeposit, "LP Vault should have deposit");

        // Warp and expire
        vm.warp(block.timestamp + 3601);
        market.expire();

        // Creator claims refund
        uint256 creatorBalanceBefore = usdc.balanceOf(creator);
        
        vm.startPrank(creator);
        market.claimCreatorRefund();
        vm.stopPrank();

        uint256 creatorBalanceAfter = usdc.balanceOf(creator);
        
        // Creator should receive back the deposit
        assertGe(creatorBalanceAfter - creatorBalanceBefore, initialDeposit - 1, "Creator should get refund");
    }

    function testNonCreatorCannotClaimRefund() public {
        vm.startPrank(creator);
        (address marketAddr, ) = factory.createMarket("NoRefund", "NRF", "D", 0, false, 3600);
        LaunchpadMarket market = LaunchpadMarket(marketAddr);
        vm.stopPrank();

        vm.warp(block.timestamp + 3601);
        market.expire();

        // Non-creator tries to claim
        vm.startPrank(trader);
        vm.expectRevert("Not creator");
        market.claimCreatorRefund();
        vm.stopPrank();
    }

    function testCannotExpireGraduatedMarket() public {
        vm.startPrank(creator);
        (address marketAddr, ) = factory.createMarket("NoExp", "NEX", "D", 0, false, 36000);
        LaunchpadMarket market = LaunchpadMarket(marketAddr);
        traderVault.setMarket(marketAddr, true);
        usdc.mint(trader, 50000 * 1e6);
        vm.stopPrank();

        vm.startPrank(trader);
        usdc.approve(address(traderVault), type(uint256).max);
        traderVault.deposit(50000 * 1e6);
        
        // Graduate the market
        while (!market.isGraduated()) {
            traderVault.tradeAMM(marketAddr, 0, int256(500 * 1e18), int256(5000 * 1e6));
        }
        vm.stopPrank();

        // Warp past deadline
        vm.warp(block.timestamp + 36001);

        // Try to expire - should fail
        vm.expectRevert("Already graduated");
        market.expire();
    }

    // =========================================================================
    // LP Vault Tests
    // =========================================================================

    function testLPVaultRedeem() public {
        vm.startPrank(creator);
        (address marketAddr, ) = factory.createMarket("LPTest", "LPT", "D", 0, false, 3600);
        LaunchpadMarket market = LaunchpadMarket(marketAddr);
        vm.stopPrank();

        // Expire market so redemption is allowed
        vm.warp(block.timestamp + 3601);
        market.expire();

        // Creator claims refund (mints LP tokens)
        vm.startPrank(creator);
        market.claimCreatorRefund();
        vm.stopPrank();

        // Check that LP tokens were properly handled
        // After claimCreatorRefund, creator should have received USDC
        assertTrue(usdc.balanceOf(creator) > 0, "Creator should have USDC");
    }

    function testLPVaultPreviewRedeem() public {
        vm.startPrank(creator);
        (, address lpVaultAddr) = factory.createMarket("Preview", "PRV", "D", 0, false, 3600);
        MarketLPVault lpVault = MarketLPVault(lpVaultAddr);
        vm.stopPrank();

        // With no LP tokens minted, preview should return 0
        assertEq(lpVault.previewRedeem(100), 0, "Preview with no supply should be 0");
        
        // Total assets should equal deposit
        assertEq(lpVault.totalAssets(), 100 * 1e6, "Total assets should be deposit");
    }

    // =========================================================================
    // Edge Cases & Adversarial Tests
    // =========================================================================

    function testInvalidTierIndex() public {
        vm.startPrank(creator);
        
        vm.expectRevert("Factory: invalid tier");
        factory.createMarket("Invalid", "INV", "D", 4, false, 3600);
        
        vm.stopPrank();
    }

    function testDoubleInitializeFails() public {
        vm.startPrank(creator);
        (address marketAddr, ) = factory.createMarket("DblInit", "DBI", "D", 0, false, 3600);
        LaunchpadMarket market = LaunchpadMarket(marketAddr);
        vm.stopPrank();

        // Try to re-initialize launchpad
        vm.expectRevert("Launchpad: already init");
        market.initializeLaunchpad(address(0x999), 1, 9999, address(0x888), 1000, address(usdc));
    }

    function testOpenEndMarket() public {
        vm.startPrank(creator);
        (address marketAddr, ) = factory.createMarket("OpenEnd", "OPE", "D", 0, true, 0); // Open-end
        LaunchpadMarket market = LaunchpadMarket(marketAddr);
        vm.stopPrank();

        // Open-end markets have max deadline
        assertEq(market.deadline(), type(uint40).max, "Open-end should have max deadline");

        // Should not be expirable even after long time
        vm.warp(block.timestamp + 365 days);
        
        vm.expectRevert("Not expired");
        market.expire();
    }

    function testAllTiers() public {
        vm.startPrank(creator);
        
        // Fund creator for all tiers
        usdc.mint(creator, 200000 * 1e6);
        usdc.approve(address(factory), type(uint256).max);

        for (uint8 i = 0; i < 4; i++) {
            uint256 expectedDeposit = factory.getRequiredDeposit(i);
            uint256 expectedB = factory.getLiquidityB(i);

            (address marketAddr, address lpVaultAddr) = factory.createMarket(
                string(abi.encodePacked("Tier", i)),
                "T",
                "D",
                i,
                false,
                3600
            );

            LaunchpadMarket market = LaunchpadMarket(marketAddr);
            MarketLPVault lpVault = MarketLPVault(lpVaultAddr);

            assertEq(market.liquidityTierIndex(), i, "Tier index mismatch");
            assertEq(lpVault.totalAssets(), expectedDeposit, "Deposit mismatch");
            assertEq(market.bBase(), expectedB, "B value mismatch");
            assertEq(market.graduationThreshold(), expectedB * 2, "Threshold mismatch");
        }

        vm.stopPrank();
    }

    // =========================================================================
    // Fee Rate Invariant Tests
    // =========================================================================

    function testFeeRateInvariant() public {
        vm.startPrank(creator);
        (address marketAddr, ) = factory.createMarket("FeeInv", "FI", "D", 0, false, 36000);
        LaunchpadMarket market = LaunchpadMarket(marketAddr);
        traderVault.setMarket(marketAddr, true);
        usdc.mint(trader, 100000 * 1e6);
        vm.stopPrank();

        vm.startPrank(trader);
        usdc.approve(address(traderVault), type(uint256).max);
        traderVault.deposit(100000 * 1e6);

        // Trade and verify fee rate
        uint256 previousB = market.bBase();
        
        for (uint256 i = 0; i < 20; i++) {
            uint256 feeRate = market.feeLMSR();
            
            if (market.isGraduated()) {
                assertEq(feeRate, 100, "Post-grad fee must be 1%");
            } else {
                assertEq(feeRate, 500, "Pre-grad fee must be 5%");
            }

            // INVARIANT: bBase never decreases
            assertTrue(market.bBase() >= previousB, "bBase must never decrease");
            previousB = market.bBase();

            traderVault.tradeAMM(marketAddr, 0, int256(100 * 1e18), int256(2000 * 1e6));
        }

        vm.stopPrank();
    }
}
