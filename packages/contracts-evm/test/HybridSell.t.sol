// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/core/SoothTraderVaultV4.sol";
import "../contracts/launchpad/LaunchpadFactory.sol";
import "../contracts/launchpad/LaunchpadMarket.sol";
import "../contracts/core/SoothLiquidityVault.sol";
import "../contracts/launchpad/LaunchpadOutcomeToken.sol";
import "../contracts/core/SoothFeeController.sol";
import "../contracts/core/ProtocolConfig.sol";
import "../contracts/core/SoothInterfaces.sol";
import "../contracts/interfaces/IOutcomeToken.sol";
import "../contracts/interfaces/ISoothMarketV4.sol";
import "../contracts/mocks/MockUSDC.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract HybridSellTest is Test {
    MockUSDC usdc;
    SoothTraderVaultV4 traderVault;
    LaunchpadFactory factory;
    LaunchpadMarket market;
    LaunchpadMarket marketImpl;
    LaunchpadOutcomeToken outcomeTokenImpl;
    SoothLiquidityVault liquidityVault;
    SoothFeeController feeController;
    ProtocolConfig protocolConfig;
    
    address creator = address(0x50);
    address user1 = address(0x100);
    address user2 = address(0x200);

    function setUp() public {
        usdc = new MockUSDC();
        feeController = new SoothFeeController(address(this));
        liquidityVault = new SoothLiquidityVault(IERC20(address(usdc)));
        traderVault = new SoothTraderVaultV4(IERC20(address(usdc)), ISoothLiquidityVault(address(liquidityVault)));
        outcomeTokenImpl = new LaunchpadOutcomeToken();
        marketImpl = new LaunchpadMarket();
        protocolConfig = new ProtocolConfig(address(this), 0);
        
        factory = new LaunchpadFactory(
            address(marketImpl),
            address(usdc),
            address(traderVault),
            address(feeController),
            address(outcomeTokenImpl),
            creator,
            creator,
            address(protocolConfig)
        );
        
        // Create Launchpad market
        usdc.mint(creator, 1000 * 1e18);
        vm.startPrank(creator);
        usdc.approve(address(factory), type(uint256).max);
        (address marketAddr, ) = factory.createMarket(
            "Hybrid Sell Test",
            "HYBRID",
            "Test market for hybrid sell",
            0,
            false,
            30 days
        );
        market = LaunchpadMarket(marketAddr);
        vm.stopPrank();
        
        traderVault.setMarket(address(market), true);
        traderVault.setOutcomeToken(address(market.outcomeToken()), true);
        liquidityVault.setAuthorized(address(traderVault), true);

        // Fund Users
        usdc.mint(user1, 1000e18);
        usdc.mint(user2, 1000e18);
        
        vm.startPrank(user1);
        usdc.approve(address(traderVault), type(uint256).max);
        traderVault.deposit(1000e18);
        vm.stopPrank();

        vm.startPrank(user2);
        usdc.approve(address(traderVault), type(uint256).max);
        traderVault.deposit(1000e18);
        vm.stopPrank();
    }

    function testHybridSellSplit() public {
        // 1. User1 Buys 10 YES shares (0.50 price)
        vm.startPrank(user1);
        traderVault.placeOrder(address(market), 0, 0.5e18, 10, true); // Buy YES
        vm.stopPrank();

        // Match it with User2 (Sell YES = Buy NO)
        vm.startPrank(user2);
        traderVault.placeOrder(address(market), 1, 0.5e18, 10, true); // Buy NO (matches YES buy)
        vm.stopPrank();
        
        // User1 should have 10 YES shares (in custodial ledger)
        assertEq(traderVault.shareBalances(user1, address(market), 0), 10);
        
        // 2. User1 executes Hybrid Sell of 15 YES shares at 0.50
        // Expected: 10 Spot Sell (closes position), 5 Short Sell (opens short)
        
        vm.startPrank(user1);
        IOutcomeToken outcomeToken = market.outcomeToken();
        outcomeToken.setApprovalForAll(address(traderVault), true);
        
        traderVault.executeHybridSell(address(market), 0, 0.5e18, 15);
        vm.stopPrank();
        
        // Verification
        // 1. YES Balance should be 0 (All sold/locked in orders)
        assertEq(traderVault.shareBalances(user1, address(market), 0), 0);
        
        // 2. Orders should verify logic
        // We can't easily check internal orderbook state without getters,
        // but we can check if orders are on the book.
        // Best Ask should be 0.50.
        // Spot Order (10) + Short Order (5) = 15 Total on Book.
        // Check orders user
        
        // 3. Check Orders
        // Order 3 (Spot, 10), Order 4 (Short, 5). 
        // (Order 1, 2 were the initial setup trades).
        
        ISoothMarketV4.OrderV4 memory order3 = market.orders(3);
        // Spot Order Maker is Vault (custodial)
        assertEq(order3.maker, address(traderVault)); 
        assertEq(order3.amount, 10);
        
        ISoothMarketV4.OrderV4 memory order4 = market.orders(4);
        // Short Order Maker is also Vault (custodial)
        assertEq(order4.maker, address(traderVault));
        assertEq(order4.amount, 5);
    }
    
    function testPureSpotSell() public {
        // Setup 10 YES for User1
        vm.startPrank(user1);
        traderVault.placeOrder(address(market), 0, 0.5e18, 10, true);
        vm.stopPrank();
        vm.startPrank(user2);
        traderVault.placeOrder(address(market), 1, 0.5e18, 10, true);
        vm.stopPrank();
        
        // Sell 5 (Pure Spot)
        vm.startPrank(user1);
        IOutcomeToken outcomeToken = market.outcomeToken();
        outcomeToken.setApprovalForAll(address(traderVault), true);
        traderVault.executeHybridSell(address(market), 0, 0.5e18, 5);
        vm.stopPrank();
        
        // Remaining Balance: 5 (in custodial ledger)
        assertEq(traderVault.shareBalances(user1, address(market), 0), 5);
        
        // Order 3 should be Maker=Vault, Amount=5
        ISoothMarketV4.OrderV4 memory order3 = market.orders(3);
        assertEq(order3.maker, address(traderVault));
        assertEq(order3.amount, 5);
    }
    
    function testPureShortSell() public {
        // User1 has 0 YES.
        
        // Sell 10 (Pure Short)
        vm.startPrank(user1);
        IOutcomeToken outcomeToken = market.outcomeToken();
        outcomeToken.setApprovalForAll(address(traderVault), true);
        traderVault.executeHybridSell(address(market), 0, 0.5e18, 10);
        vm.stopPrank();
        
        // Balance still 0
        assertEq(traderVault.shareBalances(user1, address(market), 0), 0);
        
        // Order 1 Maker = Vault (custodial)
        ISoothMarketV4.OrderV4 memory order1 = market.orders(1);
        assertEq(order1.maker, address(traderVault));
        assertEq(order1.amount, 10);
    }
}
