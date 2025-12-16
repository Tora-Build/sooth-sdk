// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/core/SoothTraderVaultV4.sol";
import "../contracts/launchpad/LaunchpadFactory.sol";
import "../contracts/launchpad/LaunchpadMarket.sol";
import "../contracts/core/SoothLiquidityVault.sol";
import "../contracts/core/SoothFeeController.sol";
import "../contracts/core/OutcomeToken.sol";
import "../contracts/core/ProtocolConfig.sol";
import "../contracts/core/SoothInterfaces.sol";
import "../contracts/interfaces/ISoothMarketV4.sol";
import "../contracts/mocks/MockUSDC.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract GranularityTest is Test {
    MockUSDC public usdc;
    SoothLiquidityVault public liquidityVault;
    LaunchpadFactory public factory;
    LaunchpadMarket public market;
    LaunchpadMarket public marketImpl;
    OutcomeToken public outcomeTokenImpl;
    SoothTraderVaultV4 public traderVault;
    SoothFeeController public feeController;
    ProtocolConfig public protocolConfig;

    address public creator = address(0x1);
    address public alice = address(0x2);

    function setUp() public {
        usdc = new MockUSDC();
        liquidityVault = new SoothLiquidityVault(IERC20(address(usdc)));
        traderVault = new SoothTraderVaultV4(IERC20(address(usdc)), ISoothLiquidityVault(address(liquidityVault)));
        feeController = new SoothFeeController(address(this));
        outcomeTokenImpl = new OutcomeToken();
        marketImpl = new LaunchpadMarket();
        protocolConfig = new ProtocolConfig(address(this), 0);
        
        traderVault.setTimeLock(ITimeLock(address(0))); 

        factory = new LaunchpadFactory(
            address(marketImpl),
            address(usdc),
            address(traderVault),
            address(feeController),
            address(outcomeTokenImpl),
            creator, // treasury
            creator, // adjudicator
            address(protocolConfig)
        );
        
        // Create Launchpad market
        usdc.mint(creator, 1000 * 1e18);
        vm.startPrank(creator);
        usdc.approve(address(factory), type(uint256).max);
        (address marketAddr, ) = factory.createMarket(
            "Granularity Test",
            "GRAN",
            "Test market for granularity",
            0, // tier 0
            false,
            30 days
        );
        market = LaunchpadMarket(marketAddr);
        vm.stopPrank();

        liquidityVault.setAuthorized(address(traderVault), true);
        traderVault.setMarket(address(market), true);
        traderVault.setOutcomeToken(address(market.outcomeToken()), true);

        // Fund Owner (for liquidity vault if needed)
        usdc.mint(address(this), 10000e18);
        usdc.approve(address(liquidityVault), 10000e18);
        liquidityVault.depositFor(address(this), 10000e18);

        // Fund Alice
        usdc.mint(alice, 1000e18);
        vm.prank(alice);
        usdc.approve(address(traderVault), type(uint256).max);
        vm.prank(alice);
        traderVault.deposit(1000e18);
    }

    function test_Orderbook_Integer_Math() public {
        // Alice places order for 10 shares (Integer 10) at 0.40 USDC
        vm.prank(alice);
        uint256 orderId = traderVault.placeOrder(
            address(market), 
            0, // YES
            0.4e18, // Price 0.40
            10, // Amount 10 (Integer)
            true // isBuy
        );
        
        // Expected Cost: 10 * 0.40 / scalar = 0 (integer math with tiny amount)
        // With 10 shares at 0.4 price: cost = (0.4e18 * 10) / 1e18 / 1 = 4 wei
        // This is effectively 0 due to integer truncation
        uint256 balance = traderVault.availableBalance(alice);
        // Cost is (price * amount) / 1e18 / scalar = (0.4e18 * 10) / 1e18 / 1 = 4
        assertEq(balance, 1000e18 - 4);
        
        // Verify Order is stored as 10
        ISoothMarketV4.OrderV4 memory order = market.orders(orderId);
        assertEq(order.amount, 10);
    }
    
    function test_Orderbook_LargeInteger() public {
        // If user passes 10e18 (WAD), they buy 10^18 shares at 0.4 price
        // Cost = (0.4e18 * 10e18) / 1e18 / scalar = 4e18 (affordable with 1000e18 deposit)
        uint256 balBefore = traderVault.availableBalance(alice);
        
        vm.prank(alice);
        traderVault.placeOrder(address(market), 0, 0.4e18, 10e18, true);
        
        uint256 balAfter = traderVault.availableBalance(alice);
        // Cost should be 4e18
        assertEq(balBefore - balAfter, 4e18, "Cost should be 4e18 for 10e18 shares at 0.4");
    }

    function test_AMM_Fractional_Succeeds() public {
        // AMM Trade for 1.5 shares (Fractional 1.5e18)
        vm.prank(alice);
        traderVault.tradeAMM(
            address(market),
            0, // Outcome 0 (YES)
            1.5e18, // Delta Shares (WAD)
            10e18 // Max Cost sufficient
        );
        
        // Should succeed and lock shares
        (uint256 yesShares,,, bool isUnlocked) = traderVault.getAMMPosition(alice, address(market));
        
        // Position tracked as WAD
        assertEq(yesShares, 1.5e18);
        // Lock-on-Sell: shares are always unlocked (no lock on buy)
        assertEq(isUnlocked, true);
    }
}
