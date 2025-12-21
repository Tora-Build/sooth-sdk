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
import "../contracts/core/SoothSettlementRootSink.sol";
import "../contracts/core/SoothInterfaces.sol";
import "../contracts/mocks/MockUSDC.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SettlementRootSinkTest is Test {
    MockUSDC usdc;
    SoothLiquidityVault liquidityVault;
    SoothTraderVaultV4 traderVault;
    LaunchpadFactory factory;
    LaunchpadMarket marketImpl;
    LaunchpadOutcomeToken outcomeTokenImpl;
    SoothFeeController feeController;
    ProtocolConfig protocolConfig;
    SoothAdjudicatorRegistry adjudicatorRegistry;
    SoothSettlementRootSink sink;

    address owner = makeAddr("owner");
    address creator = makeAddr("creator");
    address adjudicator = makeAddr("adjudicator");
    address user = makeAddr("user");

    function setUp() public {
        vm.startPrank(owner);
        usdc = new MockUSDC();
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

        // Create market
        usdc.mint(creator, 1000 * 1e18);
        vm.stopPrank();

        vm.startPrank(creator);
        usdc.approve(address(factory), type(uint256).max);
        (address marketAddr, ) = factory.createMarket("M", "M", "D", 0, false, 30 days, address(0));
        vm.stopPrank();

        vm.startPrank(owner);
        traderVault.setMarket(marketAddr, true);
        traderVault.setOutcomeToken(address(ISoothMarketV4(marketAddr).outcomeToken()), true);
        sink = new SoothSettlementRootSink(owner);
        vm.stopPrank();

        // Fund user (not strictly required for this test)
        usdc.mint(user, 1000 * 1e18);
    }

    function test_submitRoot_and_claim_emits() public {
        // Settle market via adjudicator
        address marketAddr = factory.getAllMarkets()[0];
        vm.prank(adjudicator);
        LaunchpadMarket(marketAddr).finalizeResolution(0, uint64(block.timestamp));

        bytes32 batchId = keccak256("batch-1");
        int256 pnl = int256(123e18);

        bytes32 leaf = keccak256(abi.encodePacked(marketAddr, user, pnl, batchId));
        bytes32 root = leaf; // single-leaf tree

        vm.prank(adjudicator);
        sink.submitRoot(marketAddr, batchId, root);

        bytes32[] memory proof = new bytes32[](0);
        vm.prank(user);
        sink.claim(marketAddr, batchId, pnl, proof);

        assertTrue(sink.claimed(marketAddr, batchId, user), "Should be marked claimed");
    }
}

