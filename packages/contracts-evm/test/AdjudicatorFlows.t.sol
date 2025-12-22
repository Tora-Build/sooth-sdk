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
import "../contracts/core/adjudicators/SoothManualAdjudicator.sol";
import "../contracts/core/adjudicators/SoothOptimisticAdjudicator.sol";
import "../contracts/core/SoothInterfaces.sol";
import "../contracts/mocks/MockUSDC.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract AdjudicatorFlowsTest is Test {
    MockUSDC usdc;
    SoothLiquidityVault globalVault;
    SoothTraderVaultV4 traderVault;
    SoothFeeController feeController;
    ProtocolConfig protocolConfig;
    SoothAdjudicatorRegistry registry;
    LaunchpadMarket marketImpl;
    LaunchpadOutcomeToken tokenImpl;

    address owner = makeAddr("owner");
    address creator = makeAddr("creator");

    function setUp() public {
        vm.startPrank(owner);
        usdc = new MockUSDC();
        globalVault = new SoothLiquidityVault(IERC20(address(usdc)));
        traderVault = new SoothTraderVaultV4(IERC20(address(usdc)), ISoothLiquidityVault(address(globalVault)));
        feeController = new SoothFeeController(owner);
        protocolConfig = new ProtocolConfig(owner, 0);
        registry = new SoothAdjudicatorRegistry(owner);
        marketImpl = new LaunchpadMarket();
        tokenImpl = new LaunchpadOutcomeToken();
        vm.stopPrank();

        usdc.mint(creator, 10_000 * 1e6);
    }

    function test_manualAdjudicator_resolves_market() public {
        vm.startPrank(owner);
        SoothManualAdjudicator adj = new SoothManualAdjudicator(owner, 10);
        registry.setAdjudicator(address(adj), 10, true, bytes32(0));

        LaunchpadFactory factory = new LaunchpadFactory(
            address(marketImpl),
            address(usdc),
            address(traderVault),
            address(feeController),
            address(tokenImpl),
            owner,
            address(adj),
            address(registry),
            address(protocolConfig)
        );
        vm.stopPrank();

        vm.startPrank(creator);
        usdc.approve(address(factory), type(uint256).max);
        (address marketAddr, ) = factory.createMarket("M", "M", "D", 0, false, 30 days, address(adj));
        vm.stopPrank();

        vm.prank(owner);
        adj.resolve(marketAddr, 1, uint64(block.timestamp));

        assertTrue(LaunchpadMarket(marketAddr).isSettled(), "Should be settled");
        assertEq(LaunchpadMarket(marketAddr).winningOutcome(), 1, "Outcome");
    }

    function test_optimisticAdjudicator_propose_finalize() public {
        vm.startPrank(owner);
        SoothOptimisticAdjudicator adj = new SoothOptimisticAdjudicator(owner, 11, 1 hours, 1);
        registry.setAdjudicator(address(adj), 11, true, bytes32(0));

        LaunchpadFactory factory = new LaunchpadFactory(
            address(marketImpl),
            address(usdc),
            address(traderVault),
            address(feeController),
            address(tokenImpl),
            owner,
            address(adj),
            address(registry),
            address(protocolConfig)
        );
        vm.stopPrank();

        vm.startPrank(creator);
        usdc.approve(address(factory), type(uint256).max);
        (address marketAddr, ) = factory.createMarket("M2", "M2", "D", 0, false, 30 days, address(adj));
        vm.stopPrank();

        // anyone proposes with minimal bond
        vm.deal(creator, 1 ether);
        uint256 creatorBefore = creator.balance;
        vm.prank(creator);
        adj.propose{value: 1}(marketAddr, 0, uint64(block.timestamp));
        assertEq(address(adj).balance, 1, "Bond should be escrowed");

        vm.warp(block.timestamp + 1 hours + 1);
        adj.finalize(marketAddr);

        assertTrue(LaunchpadMarket(marketAddr).isSettled(), "Should be settled");
        assertEq(LaunchpadMarket(marketAddr).winningOutcome(), 0, "Outcome");

        // bond is refundable (pull-based)
        assertEq(adj.claimableBonds(creator), 1, "Claimable bond");
        vm.prank(creator);
        adj.withdrawBond(payable(creator), 1);
        assertEq(adj.claimableBonds(creator), 0, "Bond withdrawn");
        assertEq(creator.balance, creatorBefore, "Bond refunded to proposer");
    }

    function test_optimisticAdjudicator_dispute_slashes_bond_owner_withdraws() public {
        vm.startPrank(owner);
        SoothOptimisticAdjudicator adj = new SoothOptimisticAdjudicator(owner, 11, 1 hours, 1);
        registry.setAdjudicator(address(adj), 11, true, bytes32(0));

        LaunchpadFactory factory = new LaunchpadFactory(
            address(marketImpl),
            address(usdc),
            address(traderVault),
            address(feeController),
            address(tokenImpl),
            owner,
            address(adj),
            address(registry),
            address(protocolConfig)
        );
        vm.stopPrank();

        vm.startPrank(creator);
        usdc.approve(address(factory), type(uint256).max);
        (address marketAddr, ) = factory.createMarket("M3", "M3", "D", 0, false, 30 days, address(adj));
        vm.stopPrank();

        vm.deal(creator, 1 ether);
        vm.prank(creator);
        adj.propose{value: 1}(marketAddr, 1, uint64(block.timestamp));

        // owner disputes → bond is slashed (no longer refundable)
        uint256 ownerBefore = owner.balance;
        vm.prank(owner);
        adj.dispute(marketAddr);

        assertEq(adj.ownerAccruedBonds(), 1, "Owner accrued bond");
        assertEq(adj.claimableBonds(creator), 0, "Not refundable");

        vm.prank(owner);
        adj.withdrawOwnerAccrued(payable(owner), 1);
        assertEq(adj.ownerAccruedBonds(), 0, "Owner withdrew accrued");
        assertEq(owner.balance, ownerBefore + 1, "Owner received slashed bond");
    }
}

