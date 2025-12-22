// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/core/SoothTraderVaultV4.sol";
import "../contracts/launchpad/LaunchpadFactory.sol";
import "../contracts/launchpad/LaunchpadMarket.sol";
import "../contracts/core/SoothLiquidityVault.sol";
import "../contracts/mocks/MockUSDC.sol";
import "../contracts/core/OutcomeToken.sol";
import "../contracts/core/SoothFeeController.sol";
import "../contracts/core/ProtocolConfig.sol";
import "../contracts/core/SoothInterfaces.sol";
import "../contracts/interfaces/ISoothMarketV4.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract OrderbookShortTest is Test {
    MockUSDC usdc;
    SoothLiquidityVault liquidityVault;
    SoothTraderVaultV4 traderVault;
    LaunchpadFactory factory;
    LaunchpadMarket market;
    LaunchpadMarket marketImpl;
    OutcomeToken outcomeTokenImpl;
    SoothFeeController feeController;
    ProtocolConfig protocolConfig;
    
    address creator = address(0x10);
    address alice = address(0x20); // Short Seller
    address bob = address(0x30);   // Buyer

    function setUp() public {
        usdc = new MockUSDC();
        feeController = new SoothFeeController(address(this));
        liquidityVault = new SoothLiquidityVault(IERC20(address(usdc)), 6);
        traderVault = new SoothTraderVaultV4(IERC20(address(usdc)), ISoothLiquidityVault(address(liquidityVault)));
        
        outcomeTokenImpl = new OutcomeToken();
        marketImpl = new LaunchpadMarket();
        protocolConfig = new ProtocolConfig(address(this), 0);
        
        factory = new LaunchpadFactory(
            address(marketImpl),
            address(usdc),
            address(traderVault),
            address(feeController),
            address(outcomeTokenImpl),
            creator, // treasury
            creator, // adjudicator
            address(protocolConfig), 6
        );
        
        // Create Launchpad market
        usdc.mint(creator, 1000 * 1e18);
        vm.startPrank(creator);
        usdc.approve(address(factory), type(uint256).max);
        (address marketAddr, ) = factory.createMarket(
            "Short Test",
            "SHORT",
            "Test market for short selling",
            0, // tier 0
            false, // fixed deadline
            30 days
        );
        market = LaunchpadMarket(marketAddr);
        vm.stopPrank();
        
        // Setup Permissions
        liquidityVault.setAuthorized(address(traderVault), true);
        traderVault.setMarket(address(market), true);
        traderVault.setOutcomeToken(address(market.outcomeToken()), true);
        
        // Fund accounts
        usdc.mint(alice, 1000e18);
        usdc.mint(bob, 1000e18);
        
        vm.startPrank(alice);
        usdc.approve(address(traderVault), type(uint256).max);
        traderVault.deposit(100e18);
        vm.stopPrank();

        vm.startPrank(bob);
        usdc.approve(address(traderVault), type(uint256).max);
        traderVault.deposit(100e18);
        vm.stopPrank();
    }

    function test_ShortSell_YES() public {
        // Alice wants to Short Sell YES at 0.40
        // Expected behavior:
        // - She pays (1-0.4) = 0.6 collateral per share.
        // - Market sees a "Buy NO" order at 0.6.
        
        uint256 amount = 10e18;
        uint256 sellPrice = 0.4e18; // Selling YES at 0.4
        
        uint256 expectedCollateral = (1e18 - sellPrice) * amount / 1e18; // 0.6 * 10 = 6e18
        
        uint256 balBefore = traderVault.availableBalance(alice);
        
        vm.startPrank(alice);
        // Call new API: placeOrder(market, outcome=YES, price=0.4, amount, isBuy=FALSE)
        traderVault.placeOrder(address(market), 0, sellPrice, amount, false);
        vm.stopPrank();
        
        uint256 balAfter = traderVault.availableBalance(alice);
        
        // Verify collateral locked
        assertEq(balBefore - balAfter, expectedCollateral, "Collateral should be 6 USDC");
        
        // Verify Order in Market
        ISoothMarketV4.OrderV4 memory order = market.orders(1);
        
        // Market logic checks
        // Vault sent: outcome=0 (YES) -> targetOutcome=1 (NO)
        // Vault sent: price=0.4 -> targetPrice=0.6
        
        // Market createOrder(NO, 0.6)
        // outcome=1 (NO)
        // yesPrice = 1e18 - 0.6 = 0.4
        // isBuySide = false (Ask)
        
        assertEq(order.maker, address(traderVault), "Maker should be TraderVault (custodial)");
        assertEq(order.outcome, 1, "Market outcome should be 1 (NO)"); 
        assertEq(order.yesPrice, 0.4e18, "Yes Price should be 0.4");
        assertEq(order.isBuySide, false, "Should be Ask (Sell) side of YES book");
        assertEq(order.amount, amount, "Amount match");
    }

    function test_Match_ShortSell() public {
        // 1. Alice Shorts YES @ 0.4 (Ask YES @ 0.4)
        vm.startPrank(alice);
        traderVault.placeOrder(address(market), 0, 0.4e18, 10e18, false);
        vm.stopPrank();
        
        // 2. Bob Buys YES @ 0.4 (Bid YES @ 0.4)
        vm.startPrank(bob);
        traderVault.placeOrder(address(market), 0, 0.4e18, 10e18, true);
        vm.stopPrank();
        
        // Verify balances in custodial ledger
        // Alice (Short Seller):
        // - Paid 6 collateral
        // - Received 10 NO tokens from match (in shareBalances)
        assertEq(traderVault.shareBalances(alice, address(market), 0), 0, "Alice has no YES");
        assertEq(traderVault.shareBalances(alice, address(market), 1), 10e18, "Alice has 10 NO");
        
        // Bob (Buyer):
        // - Paid 4 cost
        // - Received 10 YES tokens from match
        assertEq(traderVault.shareBalances(bob, address(market), 0), 10e18, "Bob has 10 YES");
        assertEq(traderVault.shareBalances(bob, address(market), 1), 0, "Bob has no NO");
    }
}
