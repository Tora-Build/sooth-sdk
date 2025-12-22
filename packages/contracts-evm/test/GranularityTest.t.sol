// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/core/SoothTraderVaultV4.sol";
import "../contracts/launchpad/LaunchpadFactory.sol";
import "../contracts/launchpad/LaunchpadMarket.sol";
import "../contracts/core/SoothLiquidityVault.sol";
import "../contracts/core/SoothFeeController.sol";
import "../contracts/launchpad/LaunchpadOutcomeToken.sol";
import "../contracts/core/SoothAdjudicatorRegistry.sol";
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
    LaunchpadOutcomeToken public outcomeTokenImpl;
    SoothAdjudicatorRegistry public adjudicatorRegistry;
    SoothTraderVaultV4 public traderVault;
    SoothFeeController public feeController;
    ProtocolConfig public protocolConfig;

    address public creator = address(0x1);
    address public alice = address(0x2);

    function setUp() public {
        usdc = new MockUSDC();
        liquidityVault = new SoothLiquidityVault(IERC20(address(usdc)), 6);
        traderVault = new SoothTraderVaultV4(IERC20(address(usdc)), ISoothLiquidityVault(address(liquidityVault)));
        feeController = new SoothFeeController(address(this));
        outcomeTokenImpl = new LaunchpadOutcomeToken();
        marketImpl = new LaunchpadMarket();
        protocolConfig = new ProtocolConfig(address(this), 0);
        adjudicatorRegistry = new SoothAdjudicatorRegistry(address(this));
        adjudicatorRegistry.setAdjudicator(creator, 1, true, bytes32(0));
        
        traderVault.setTimeLock(ITimeLock(address(0))); 

        factory = new LaunchpadFactory(
            address(marketImpl),
            address(usdc),
            address(traderVault),
            address(feeController),
            address(outcomeTokenImpl),
            creator, // treasury
            creator, // adjudicator
            address(adjudicatorRegistry),
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
            30 days,
            address(0)
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
        uint256 balBefore = traderVault.availableBalance(alice);
        vm.prank(alice);
        uint256 orderId = traderVault.placeOrder(
            address(market), 
            0, // YES
            0.4e18, // Price 0.40
            10, // Amount 10 (Integer)
            true // isBuy
        );
        
        // Expected Cost: (price * amount) / 1e18 / scalar.
        // With 6-dec USDC, scalar = 1e12, so tiny integer orders truncate to 0.
        uint256 balance = traderVault.availableBalance(alice);
        assertEq(balance, balBefore, "Tiny integer order should not move 6-dec USDC balance");
        
        // Verify Order is stored as 10
        ISoothMarketV4.OrderV4 memory order = market.orders(orderId);
        assertEq(order.amount, 10);
    }
    
    function test_Orderbook_LargeInteger() public {
        // If user passes 10e18 (WAD), they buy 10^18 shares at 0.4 price
        // Cost = (0.4e18 * 10e18) / 1e18 / scalar = 4e6 (for 6-dec USDC)
        uint256 balBefore = traderVault.availableBalance(alice);
        
        vm.prank(alice);
        traderVault.placeOrder(address(market), 0, 0.4e18, 10e18, true);
        
        uint256 balAfter = traderVault.availableBalance(alice);
        assertEq(balBefore - balAfter, 4_000_000, "Cost should be 4 USDC (6 decimals)");
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
