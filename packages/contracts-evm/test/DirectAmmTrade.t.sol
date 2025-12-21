// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import "../contracts/core/SoothTraderVaultV4.sol";
import "../contracts/launchpad/LaunchpadFactory.sol";
import "../contracts/launchpad/LaunchpadMarket.sol";
import "../contracts/launchpad/LaunchpadOutcomeToken.sol";
import "../contracts/core/SoothLiquidityVault.sol";
import "../contracts/core/SoothFeeController.sol";
import "../contracts/core/ProtocolConfig.sol";
import "../contracts/core/SoothAdjudicatorRegistry.sol";
import "../contracts/core/SoothInterfaces.sol";
import "../contracts/mocks/MockUSDC.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract DirectAmmTradeTest is Test {
    MockUSDC usdc;
    SoothLiquidityVault liquidityVault;
    SoothTraderVaultV4 traderVault;
    LaunchpadFactory factory;
    LaunchpadMarket marketImpl;
    LaunchpadOutcomeToken outcomeTokenImpl;
    SoothFeeController feeController;
    ProtocolConfig protocolConfig;
    SoothAdjudicatorRegistry adjudicatorRegistry;

    address owner = makeAddr("owner");
    address creator = makeAddr("creator");
    address adjudicator = makeAddr("adjudicator");
    address user = makeAddr("user");

    function setUp() public {
        vm.startPrank(owner);
        usdc = new MockUSDC(); // 6 decimals
        feeController = new SoothFeeController(owner);
        liquidityVault = new SoothLiquidityVault(IERC20(address(usdc)));
        traderVault = new SoothTraderVaultV4(IERC20(address(usdc)), ISoothLiquidityVault(address(liquidityVault)));
        marketImpl = new LaunchpadMarket();
        outcomeTokenImpl = new LaunchpadOutcomeToken();
        protocolConfig = new ProtocolConfig(owner, 0);
        adjudicatorRegistry = new SoothAdjudicatorRegistry(owner);
        adjudicatorRegistry.setAdjudicator(adjudicator, 1, true, bytes32(0));

        factory = new LaunchpadFactory(
            address(marketImpl),
            address(usdc),
            address(traderVault),
            address(feeController),
            address(outcomeTokenImpl),
            owner, // treasury
            adjudicator, // default adjudicator
            address(adjudicatorRegistry),
            address(protocolConfig)
        );
        vm.stopPrank();

        // Create market
        usdc.mint(creator, 10_000 * 1e6);
        vm.startPrank(creator);
        usdc.approve(address(factory), type(uint256).max);
        (address marketAddr, ) = factory.createMarket("M", "M", "D", 0, false, 30 days, address(0));
        vm.stopPrank();

        // Whitelist market in vault
        vm.prank(owner);
        traderVault.setMarket(marketAddr, true);

        // Fund user
        usdc.mint(user, 1_000 * 1e6);
        vm.prank(user);
        usdc.approve(address(traderVault), type(uint256).max);
    }

    function test_depositAndTradeAMM_buysShares() public {
        address marketAddr = factory.getAllMarkets()[0];

        vm.startPrank(user);

        // Deposit 100 USDC and buy 10 YES shares.
        traderVault.depositAndTradeAMM(
            marketAddr,
            0,
            int256(10e18),
            int256(500 * 1e6),
            100 * 1e6
        );

        (uint256 yesShares, uint256 noShares) = traderVault.ammPositions(user, marketAddr);
        assertEq(yesShares, 10e18, "YES shares should match");
        assertEq(noShares, 0, "NO shares should be zero");

        vm.stopPrank();
    }
}

