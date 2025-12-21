// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/core/SoothTraderVaultV4.sol";
import "../contracts/launchpad/LaunchpadFactory.sol";
import "../contracts/launchpad/LaunchpadMarket.sol";
import "../contracts/launchpad/LaunchpadOutcomeToken.sol";
import "../contracts/mocks/MockUSDC.sol";
import "../contracts/core/SoothLiquidityVault.sol";
import "../contracts/core/SoothFeeController.sol";
import "../contracts/core/SoothAdjudicatorRegistry.sol";
import "../contracts/core/ProtocolConfig.sol";
import "../contracts/core/SoothInterfaces.sol";
import "../contracts/interfaces/IOutcomeToken.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract CustodialVaultTest is Test {
    SoothTraderVaultV4 vault;
    LaunchpadFactory factory;
    LaunchpadMarket market;
    LaunchpadMarket marketImpl;
    LaunchpadOutcomeToken outcomeTokenImpl;
    SoothAdjudicatorRegistry adjudicatorRegistry;
    MockUSDC usdc;
    SoothLiquidityVault liquidityVault;
    SoothFeeController feeController;
    ProtocolConfig protocolConfig;

    address creator = address(0x1);
    address user = address(0x3);
    address buyer = address(0x4);

    function setUp() public {
        usdc = new MockUSDC();
        liquidityVault = new SoothLiquidityVault(IERC20(address(usdc)));
        outcomeTokenImpl = new LaunchpadOutcomeToken();
        adjudicatorRegistry = new SoothAdjudicatorRegistry(address(this));
        adjudicatorRegistry.setAdjudicator(creator, 1, true, bytes32(0));
        feeController = new SoothFeeController(address(this));
        protocolConfig = new ProtocolConfig(address(this), 0);

        vault = new SoothTraderVaultV4(IERC20(address(usdc)), ISoothLiquidityVault(address(liquidityVault)));
        marketImpl = new LaunchpadMarket();
        
        factory = new LaunchpadFactory(
            address(marketImpl),
            address(usdc),
            address(vault),
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
            "Custodial Test",
            "CUST",
            "Test market for custodial vault",
            0, // tier 0
            false,
            30 days,
            address(0)
        );
        market = LaunchpadMarket(marketAddr);
        vm.stopPrank();
        
        vault.setMarket(address(market), true);
        vault.setOutcomeToken(address(market.outcomeToken()), true);

        // Authorize in LiquidityVault (for TraderVault operations)
        liquidityVault.setAuthorized(address(vault), true);

        // Fund LiquidityVault (for global operations)
        usdc.mint(address(liquidityVault), 10000e18);
        
        // Fund User
        usdc.mint(user, 1000e18);
        vm.startPrank(user);
        usdc.approve(address(vault), 1000e18);
        vault.deposit(1000e18);
        vm.stopPrank();

        // Fund Buyer
        usdc.mint(buyer, 1000e18);
        vm.startPrank(buyer);
        usdc.approve(address(vault), 1000e18);
        vault.deposit(1000e18);
        vm.stopPrank();
    }

    function testCustodialFlow() public {
        // 1. User Buys YES (Standard Order)
        vm.startPrank(user);
        // Place Buy Order: 10 YES at 0.60
        vault.placeOrder(address(market), 0, 0.6e18, 10e18, true);
        vm.stopPrank();

        // 2. Buyer Sells YES (Matches User) -> Buyer shorts NO
        vm.startPrank(buyer);
        // Place Short Sell (Buy NO): 10 NO at 0.40 (matches 0.60 YES)
        uint256 shortId = vault.placeOrder(address(market), 0, 0.6e18, 10e18, false);
        vm.stopPrank();

        // 3. Verify Custodial Balances
        // User should have 10 YES in Internal Ledger
        assertEq(vault.shareBalances(user, address(market), 0), 10e18, "User should have 10 YES");
        // Buyer should have 10 NO in Internal Ledger
        assertEq(vault.shareBalances(buyer, address(market), 1), 10e18, "Buyer should have 10 NO");
        
        // 4. Verify External Balances (Vault holds tokens)
        IOutcomeToken token = market.outcomeToken();
        assertEq(token.balanceOf(address(vault), 0), 10e18, "Vault should hold YES");
        assertEq(token.balanceOf(address(vault), 1), 10e18, "Vault should hold NO");
        
        // 5. User Spot Sells 5 YES (Partial Close)
        vm.startPrank(user);
        // Matches Buyer's Short? No, Buyer has NO. User needs to sell YES to someone buying YES.
        // Let buyer place another Buy YES order.
        vm.stopPrank();
        
        vm.startPrank(buyer);
        vault.placeOrder(address(market), 0, 0.5e18, 5e18, true); // Bid at 0.50
        vm.stopPrank();
        
        vm.startPrank(user);
        // Spot Sell 5 YES at 0.50
        // Expected Payout: 5 * 0.50 = 2.50 USDC
        uint256 preBal = vault.availableBalance(user);
        vault.placeSpotOrder(address(market), 0, 0.5e18, 5e18);
        uint256 postBal = vault.availableBalance(user);
        
        // 6. Verify Payout Logic (Spot Sell Fix)
        // User sold 5 at 0.50. Payout should be 2.5 USDC.
        uint256 diff = postBal - preBal;
        assertEq(diff, 2_500_000, "Payout should be Price * Amount (USDC 6 decimals)");
        
        // 7. Verify Share Balance reduced
        assertEq(vault.shareBalances(user, address(market), 0), 5e18, "User should have 5 YES left");
        
        // 8. Withdraw Remaining 5 YES
        vault.withdrawShares(address(market), 0, 5e18);
        assertEq(vault.shareBalances(user, address(market), 0), 0, "Internal balance 0");
        IOutcomeToken token2 = market.outcomeToken();
        assertEq(token2.balanceOf(user, 0), 5e18, "User wallet has 5 YES");
        vm.stopPrank();
    }
}
