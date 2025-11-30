// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import "../contracts/core/SoothInterfaces.sol";
import "../contracts/core/SoothVault.sol";
import "../contracts/core/SoothBalancedAMM.sol";
import "../contracts/core/SoothRiskManager.sol";
import "../contracts/core/SoothAdjudicatorRegistry.sol";
import "../contracts/core/SoothMarketFactory.sol";
import "../contracts/core/SoothMarket.sol";
import "../contracts/settlement/SoothSettlement.sol";
import "./MockERC20.sol";

contract SoothCoreIntegrationTest is Test {
    MockERC20 collateral;
    SoothVault vault;
    SoothRiskManager riskManager;
    SoothBalancedAMM amm;
    SoothAdjudicatorRegistry adjRegistry;
    SoothSettlement settlement;
    SoothMarketFactory factory;
    SoothMarket market;

    address lp = address(0xBEEF);
    address trader = address(0xCAFE);

    uint256 constant MARKET_ID_IGNORED = 0; // factory controls ids
    bytes32 constant ADJ_ID = keccak256("DUMMY_ADJ");

    function setUp() public {
        // Collateral
        collateral = new MockERC20();

        // Mint funds
        collateral._mint(lp, 1_000_000 ether);
        collateral._mint(trader, 1_000 ether);

        // Vault
        vault = new SoothVault(collateral);

        // Risk manager
        riskManager = new SoothRiskManager(vault);

        // AMM
        amm = new SoothBalancedAMM();

        // Adjudicator registry
        adjRegistry = new SoothAdjudicatorRegistry();
        SoothAdjudicatorRegistry.AdjudicatorConfig memory cfg =
            SoothAdjudicatorRegistry.AdjudicatorConfig({
                classId: 1,
                externalContract: address(0),
                params: "",
                enabled: true
            });
        adjRegistry.registerAdjudicator(ADJ_ID, cfg);

        // Settlement
        settlement = new SoothSettlement(vault, adjRegistry);

        // Authorize settlement on vault
        vault.setAuthorized(address(settlement), true);

        // LP deposits into vault
        vm.startPrank(lp);
        collateral.approve(address(vault), type(uint256).max);
        vault.depositFor(lp, 500_000 ether);
        vm.stopPrank();

        // Factory
        factory = new SoothMarketFactory(vault, riskManager, amm);
        vault.setAuthorized(address(factory), true);
        riskManager.transferOwnership(address(factory));

        // Create a market via the factory
        market = factory.createMarket(ADJ_ID, SoothRiskManager.RiskClass.MEDIUM);
        
        // Authorize market on vault (needed for recordMarketFlow)
        vault.setAuthorized(address(market), true);
    }

    function testFullFlowTradeAndSettlement() public {
        // Trader approves vault to pull funds
        vm.startPrank(trader);
        collateral.approve(address(vault), type(uint256).max);

        // Trader buys YES = 10 shares
        uint256 balBeforeTrade = collateral.balanceOf(trader);
        market.trade(0, int256(10 ether), type(int256).max);
        uint256 balAfterTrade = collateral.balanceOf(trader);
        uint256 cost = balBeforeTrade - balAfterTrade;

        vm.stopPrank();

        // Fake adjudication result
        uint8 winningOutcome = 0; // YES
        vm.warp(2 hours);
        uint64 truthTime = uint64(block.timestamp - 1 hours);

        // Store result
        settlement.storeResult(1, ADJ_ID, winningOutcome, truthTime);

        // Build a trivial merkle root with one leaf: (marketId, trader, +100)
        int256 pnlDelta = int256(100 ether);
        bytes32 leaf = keccak256(abi.encodePacked(uint256(1), trader, pnlDelta));
        bytes32 root = leaf;
        bytes32 batchId = keccak256("BATCH-1");

        // Allow this test contract as prover
        settlement.setProver(address(this), true);
        settlement.storeSettlementRoot(1, batchId, root, "");

        // Trader balance before
        uint256 balBefore = collateral.balanceOf(trader);

        // Trader claims with empty proof (single-leaf tree)
        vm.prank(trader);
        bytes32[] memory proof = new bytes32[](0);
        settlement.claimSettlement(1, batchId, pnlDelta, proof);

        uint256 balAfter = collateral.balanceOf(trader);
        assertEq(balAfter, balBefore + uint256(pnlDelta), "PnL not applied");

        // Ensure vault lost the payout but gained the premium (cost)
        assertEq(vault.totalAssets(), 500_000 ether + cost - uint256(pnlDelta));
    }
    
    function testMarketCreatedWithBalancedState() public {
        (int256 qYes, int256 qNo) = market.ammState();
        assertEq(qYes, 1000 ether, "Factory should initialize qYes to 1000");
        assertEq(qNo, 1000 ether, "Factory should initialize qNo to 1000");
    }
}
