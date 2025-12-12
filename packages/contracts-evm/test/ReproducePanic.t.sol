// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/core/SoothTraderVaultV4.sol";
import "../contracts/core/SoothMarketV4.sol";
import "../contracts/core/OutcomeToken.sol";
import "../contracts/core/SoothGovernorVault.sol";
import "../contracts/mocks/MockUSDC.sol";
import "../contracts/core/SoothFeeController.sol";

contract ReproducePanicTest is Test {
    SoothTraderVaultV4 vault;
    SoothMarketV4 market;
    OutcomeToken token;
    MockUSDC usdc;
    SoothGovernorVault governor;
    SoothFeeController feeController;

    address alice = address(0x1);
    address bob = address(0x2);

    function setUp() public {
        usdc = new MockUSDC();
        feeController = new SoothFeeController(address(this));
        
        governor = new SoothGovernorVault(IERC20(address(usdc)));
        vault = new SoothTraderVaultV4(IERC20(address(usdc)), governor);
        market = new SoothMarketV4();
        token = new OutcomeToken();

        // Initialize Token
        token.initialize(address(market), address(vault));

        // Initialize Market
        market.initialize(
            1,
            address(governor),
            address(vault),
            address(feeController),
            address(token),
            bytes32("adjudicator"),
            1000 ether,
            address(this),
            1000 ether,
            1000 ether
        );

        // Setup Governor Auth
        governor.setAuthorized(address(vault), true);
        governor.setAuthorized(address(market), true);

        // Setup Vault
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
