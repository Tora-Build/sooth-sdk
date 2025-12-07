// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/core/SoothTraderVault.sol";
import "../contracts/core/SoothMarket.sol";
import "../contracts/core/SoothLMSRReal.sol";
import "./MockERC20.sol";
import "../contracts/router/SoothRouter.sol";

contract MockGovernorVault {
    function receiveFunds(uint256, uint256) external {}
    function reserveFactorBps() external pure returns (uint256) { return 0; }
    function defaultFeeBps() external pure returns (uint256) { return 0; }
    function decimalsScale() external pure returns (uint256) { return 1e12; }
}

contract MockFeeController {
    function getFee(address, address, uint256, uint256) external pure returns (uint256) { return 0; }
}

contract RouterTest is Test {
    SoothTraderVault vault;
    SoothMarket market;
    SoothLMSRReal amm;
    MockERC20 usdc;
    SoothRouter router;
    MockGovernorVault gov;
    MockFeeController fee;

    address alice = address(0x1);
    address bob = address(0x2);

    function setUp() public {
        usdc = new MockERC20("USDC", "USDC", 6);
        gov = new MockGovernorVault();
        fee = new MockFeeController();
        
        vault = new SoothTraderVault(IERC20(address(usdc)), ISoothGovernorVault(address(gov)));
        amm = new SoothLMSRReal();
        market = new SoothMarket();
        
        // Initialize Market
        market.initialize(
            1, 
            ISoothGovernorVault(address(gov)),
            address(vault), 
            ISoothAMM(address(amm)), 
            ISoothFeeController(address(fee)),
            bytes32(0),
            1000 * 1e18,
            address(this),
            100 * 1e18
        );
        vault.setMarket(address(market), true);

        // Deploy Router
        router = new SoothRouter(address(vault));

        // Fund Alice
        usdc.mint(alice, 10000 * 1e6);
        vm.startPrank(alice);
        usdc.approve(address(vault), type(uint256).max);
        usdc.approve(address(router), type(uint256).max);
        vm.stopPrank();

        // Seed AMM Liquidity via Vault (owner)
        usdc.mint(address(this), 10000 * 1e6);
        usdc.approve(address(vault), type(uint256).max);
        vault.deposit(10000 * 1e6); // TVL for AMM
    }

    function testHybridBuy() public {
        // 1. Seed Orderbook with a resting Sell Order (Bob selling YES)
        // Bob needs YES shares first. He buys from AMM.
        usdc.mint(bob, 1000 * 1e6);
        vm.startPrank(bob);
        usdc.approve(address(vault), type(uint256).max);
        vault.deposit(1000 * 1e6);
        vault.tradeAMM(address(market), 0, 100 * 1e18, 100 * 1e6); // Buy 100 YES
        
        // Bob places Limit Sell YES @ 0.60 USDC (Higher than AMM ~0.50)
        // To SELL YES, he must BUY NO.
        // Price of NO = 1 - 0.60 = 0.40.
        vault.placeOrder(address(market), 1, 0.40 * 1e18, 50 * 1e18); // Sell 50 YES equivalent
        vm.stopPrank();

        // 2. Alice wants to Buy 100 YES via Router
        // Split: 50 from Book (0.60), 50 from AMM (~0.50)
        
        vm.startPrank(alice);
        
        SoothRouter.RouteParams memory params = SoothRouter.RouteParams({
            amountToBook: 50 * 1e18, // Take Bob's 50
            amountToAMM: 50 * 1e18,  // Buy another 50 from AMM
            limitPrice: 0.65 * 1e18, // Willing to pay up to 0.65
            minOutput: 0             // Ignore for now
        });

        uint256 preBal = usdc.balanceOf(alice);
        
        uint256 shares = router.executeHybridOrder(address(market), 0, params);
        
        vm.stopPrank();
        
        // Verification
        assertEq(shares, 100 * 1e18, "Should have bought 100 shares");
        
        // Check Alice received the shares
        uint256 aliceYes = market.yesBalance(alice);
        assertEq(aliceYes, 100 * 1e18, "Alice should own 100 YES");
        
        // Check Book is swept
        ISoothMarket.OrderV3 memory bobOrder = market.orders(1);
        assertEq(bobOrder.amount, 0, "Bob's order should be filled");
    }
}
