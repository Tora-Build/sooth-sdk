// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import "../contracts/launchpad/LaunchpadFactory.sol";
import "../contracts/launchpad/LaunchpadMarket.sol";
import "../contracts/launchpad/LaunchpadOutcomeToken.sol";
import "../contracts/core/SoothTraderVaultV4.sol";
import "../contracts/core/SoothLiquidityVault.sol";
import "../contracts/core/SoothFeeController.sol";
import "../contracts/core/ProtocolConfig.sol";
import "../contracts/core/SoothAdjudicatorRegistry.sol";
import "../contracts/core/SoothSettlementRootSink.sol";
import "../contracts/core/adjudicators/SoothBrevisAdjudicator.sol";
import "../contracts/core/SoothInterfaces.sol";
import "../contracts/mocks/MockUSDC.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract BrevisAdjudicatorStubTest is Test {
    address owner = makeAddr("owner");
    address creator = makeAddr("creator");
    address gateway = makeAddr("gateway");
    address user = makeAddr("user");

    MockUSDC usdc;
    SoothLiquidityVault globalVault;
    SoothTraderVaultV4 traderVault;
    SoothFeeController feeController;
    ProtocolConfig protocolConfig;
    SoothAdjudicatorRegistry registry;
    SoothSettlementRootSink sink;
    SoothBrevisAdjudicator brevisAdj;
    LaunchpadFactory factory;
    LaunchpadMarket marketImpl;
    LaunchpadOutcomeToken tokenImpl;

    function setUp() public {
        vm.startPrank(owner);
        usdc = new MockUSDC();
        globalVault = new SoothLiquidityVault(IERC20(address(usdc)));
        traderVault = new SoothTraderVaultV4(IERC20(address(usdc)), ISoothLiquidityVault(address(globalVault)));
        feeController = new SoothFeeController(owner);
        protocolConfig = new ProtocolConfig(owner, 0);
        registry = new SoothAdjudicatorRegistry(owner);
        sink = new SoothSettlementRootSink(owner);
        brevisAdj = new SoothBrevisAdjudicator(owner, 42, gateway, sink);
        registry.setAdjudicator(address(brevisAdj), 42, true, bytes32(0));

        marketImpl = new LaunchpadMarket();
        tokenImpl = new LaunchpadOutcomeToken();
        factory = new LaunchpadFactory(
            address(marketImpl),
            address(usdc),
            address(traderVault),
            address(feeController),
            address(tokenImpl),
            owner,
            address(brevisAdj),
            address(registry),
            address(protocolConfig)
        );
        traderVault.setSettlementSink(address(sink), true);
        vm.stopPrank();

        usdc.mint(creator, 10_000 * 1e6);
        vm.startPrank(creator);
        usdc.approve(address(factory), type(uint256).max);
        factory.createMarket("M", "M", "D", 0, false, 30 days, address(brevisAdj));
        vm.stopPrank();

        usdc.mint(user, 1000 * 1e6);
        vm.prank(user);
        usdc.approve(address(traderVault), type(uint256).max);
    }

    function test_onlyGateway_canResolveMarket() public {
        address market = factory.getAllMarkets()[0];

        vm.expectRevert("BrevisAdj: not gateway");
        brevisAdj.brevisResolveMarket(market, 0, uint64(block.timestamp));

        vm.prank(gateway);
        brevisAdj.brevisResolveMarket(market, 0, uint64(block.timestamp));

        assertTrue(LaunchpadMarket(market).isSettled(), "Should be settled");
    }
}

