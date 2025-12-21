// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/core/SoothTraderVaultV4.sol";
import "../contracts/launchpad/LaunchpadFactory.sol";
import "../contracts/launchpad/LaunchpadMarket.sol";
import "../contracts/launchpad/LaunchpadOutcomeToken.sol";
import "../contracts/core/SoothLiquidityVault.sol";
import "../contracts/mocks/MockUSDC.sol";
import "../contracts/core/SoothFeeController.sol";
import "../contracts/core/ProtocolConfig.sol";
import "../contracts/core/SoothInterfaces.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ReproducePanicTest is Test {
    SoothTraderVaultV4 vault;
    LaunchpadFactory factory;
    LaunchpadMarket market;
    LaunchpadMarket marketImpl;
    LaunchpadOutcomeToken outcomeTokenImpl;
    MockUSDC usdc;
    SoothLiquidityVault liquidityVault;
    SoothFeeController feeController;
    ProtocolConfig protocolConfig;

    address creator = address(0x10);
    address alice = address(0x1);
    address bob = address(0x2);

    function setUp() public {
        usdc = new MockUSDC();
        feeController = new SoothFeeController(address(this));
        liquidityVault = new SoothLiquidityVault(IERC20(address(usdc)));
        vault = new SoothTraderVaultV4(IERC20(address(usdc)), ISoothLiquidityVault(address(liquidityVault)));
        outcomeTokenImpl = new LaunchpadOutcomeToken();
        marketImpl = new LaunchpadMarket();
        protocolConfig = new ProtocolConfig(address(this), 0);
        
        factory = new LaunchpadFactory(
            address(marketImpl),
            address(usdc),
            address(vault),
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
            "Panic Test",
            "PANIC",
            "Test market for panic reproduction",
            0,
            false,
            30 days
        );
        market = LaunchpadMarket(marketAddr);
        vm.stopPrank();

        // Setup permissions
        liquidityVault.setAuthorized(address(vault), true);
        vault.setMarket(address(market), true);
        
        // Fund Users
        usdc.mint(alice, 1000 ether);
        usdc.mint(bob, 1000 ether);
        
        vm.prank(alice);
        usdc.approve(address(vault), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(vault), type(uint256).max);

        vm.prank(alice);
        vault.deposit(1000 ether);
        vm.prank(bob);
        vault.deposit(1000 ether);
    }

    function test_ReproduceShortSellPanic() public {
        // Scenario:
        // Bob places a BUY YES order at 0.60 (Bid).
        // Alice places a SHORT SELL YES order at 0.50 (Limit).
        // Alice's order should match Bob's Bid at 0.60.
        // Refund = (0.60 * Amount) - (0.50 * Amount) > 0.

        // 1. Bob places Bid for YES at 0.60
        vm.startPrank(bob);
        vault.placeOrder(address(market), 0, 0.60 ether, 10 ether, true);
        vm.stopPrank();

        // Check Bid is in book
        uint256 bestBid = market.bestBid();
        assertEq(market.price(0) > 0, true); // Just check market state

        // 2. Alice Short Sells YES at 0.50
        // isBuy = false. price = 0.50. amount = 5.
        vm.startPrank(alice);
        // Expect NO revert
        uint256 orderId = vault.placeOrder(address(market), 0, 0.50 ether, 5 ether, false);
        vm.stopPrank();
        
        console2.log("Order Placed Successfully:", orderId);
    }
}
