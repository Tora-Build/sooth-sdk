// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import "../contracts/core/SoothInterfaces.sol";
import "../contracts/core/SoothVault.sol";
import "../contracts/core/SoothBalancedAMM.sol";
import "../contracts/core/SoothRiskManager.sol";
import "../contracts/core/SoothAdjudicatorRegistry.sol";
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
    SoothMarket market;

    address lp = address(0xBEEF);
    address trader = address(0xCAFE);

    uint256 constant MARKET_ID = 1;
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

        // Risk manager config
        riskManager.setMarketRiskClass(MARKET_ID, SoothRiskManager.RiskClass.MEDIUM);
        riskManager.updateGlobalB();

        // Market
        market = new SoothMarket();
        market.initialize(MARKET_ID, vault, riskManager, amm, ADJ_ID);
    }

    function testFullFlowTradeAndSettlement() public {
        // Trader approves vault to pull funds (market.transferFrom -> vault)
        vm.startPrank(trader);
        collateral.approve(address(vault), type(uint256).max);

        // Trader buys YES = 10 shares
        market.trade(0, int256(10 ether));

        vm.stopPrank();

        // Fake adjudication result
        uint8 winningOutcome = 0; // YES
        uint64 truthTime = uint64(block.timestamp - 1 hours);

        // Store result
        settlement.storeResult(MARKET_ID, ADJ_ID, winningOutcome, truthTime);

        // Build a trivial merkle root with one leaf: (MARKET_ID, trader, +100)
        int256 pnlDelta = int256(100 ether);
        bytes32 leaf = keccak256(abi.encodePacked(MARKET_ID, trader, pnlDelta));
        bytes32 root = leaf;
        bytes32 batchId = keccak256("BATCH-1");

        // Allow this test contract as prover
        settlement.setProver(address(this), true);
        settlement.storeSettlementRoot(MARKET_ID, batchId, root, "");

        // Trader balance before
        uint256 balBefore = collateral.balanceOf(trader);

        // Trader claims with empty proof (single-leaf tree)
        vm.prank(trader);
        bytes32[] memory proof = new bytes32[](0);
        settlement.claimSettlement(MARKET_ID, batchId, pnlDelta, proof);

        uint256 balAfter = collateral.balanceOf(trader);
        assertEq(balAfter, balBefore + uint256(pnlDelta), "PnL not applied");

        // Ensure vault lost the same amount
        assertEq(vault.totalAssets(), 500_000 ether - uint256(pnlDelta));
    }
}
