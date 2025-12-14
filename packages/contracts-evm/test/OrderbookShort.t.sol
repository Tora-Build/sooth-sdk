// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/core/SoothTraderVaultV4.sol";
import "../contracts/core/SoothMarketV4.sol";
import "../contracts/core/SoothGovernorVault.sol";
import "../contracts/mocks/MockUSDC.sol";
import "../contracts/core/OutcomeToken.sol";
import "../contracts/core/SoothFeeController.sol";

contract OrderbookShortTest is Test {
    MockUSDC usdc;
    SoothGovernorVault governorVault;
    SoothTraderVaultV4 traderVault;
    SoothMarketV4 market;
    OutcomeToken outcomeToken;
    SoothFeeController feeController;
    
    address lp = address(0x10);
    address alice = address(0x20); // Short Seller
    address bob = address(0x30);   // Buyer

    function setUp() public {
        usdc = new MockUSDC();
        feeController = new SoothFeeController(address(this));
        
        // Fix: OutcomeToken has 0-arg constructor
        outcomeToken = new OutcomeToken();
        
        // Fix: GovernorVault has 1-arg constructor (asset)
        governorVault = new SoothGovernorVault(IERC20(address(usdc)));
        
        traderVault = new SoothTraderVaultV4(IERC20(address(usdc)), governorVault);
        
        market = new SoothMarketV4();
        
        // Initialize Market
        market.initialize(
            1, // marketId
            address(governorVault),
            address(traderVault),
            address(feeController),
            address(outcomeToken),
            bytes32(0),
            1000e18, // bBase
            address(this), // governor
            1000e18, // qYes
            1000e18  // qNo
        );

        // Fix: Initialize OutcomeToken manually as test setup
        outcomeToken.initialize(address(market), address(traderVault));

        // Setup Permissions
        governorVault.setAuthorized(address(traderVault), true); // TraderVault needs permission to move funds
        governorVault.setAuthorized(address(market), true);
        
        governorVault.transferOwnership(address(market));
        
        traderVault.setMarket(address(market), true);
        traderVault.setOutcomeToken(address(outcomeToken), true);
        
        // Fund accounts
        usdc.mint(alice, 1000e18); // 18 decimals mocked
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
