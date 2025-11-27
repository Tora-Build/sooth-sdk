// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/core/SoothVault.sol";
import "../contracts/core/SoothAdjudicatorRegistry.sol";
import "../contracts/settlement/SoothSettlement.sol";
import "./MockERC20.sol";

contract SoothSettlementTest is Test {
    MockERC20 collateral;
    SoothVault vault;
    SoothAdjudicatorRegistry adjRegistry;
    SoothSettlement settlement;

    uint256 constant MARKET_ID = 1;
    bytes32 constant ADJ_ID = keccak256("DUMMY_ADJ");
    address lp = address(0xBEEF);
    address trader = address(0xCAFE);

    function setUp() public {
        collateral = new MockERC20();
        vault = new SoothVault(collateral);
        adjRegistry = new SoothAdjudicatorRegistry();
        settlement = new SoothSettlement(vault, adjRegistry);

        // register adjudicator
        SoothAdjudicatorRegistry.AdjudicatorConfig memory cfg =
            SoothAdjudicatorRegistry.AdjudicatorConfig({
                classId: 1,
                externalContract: address(0),
                params: "",
                enabled: true
            });
        adjRegistry.registerAdjudicator(ADJ_ID, cfg);

        // LP deposit
        collateral._mint(lp, 1_000 ether);
        vm.startPrank(lp);
        collateral.approve(address(vault), type(uint256).max);
        vault.depositFor(lp, 1_000 ether);
        vm.stopPrank();

        // authorize settlement
        vault.setAuthorized(address(settlement), true);

        // trader
        collateral._mint(trader, 100 ether);
    }

    function testStoreResultAndClaim() public {
        vm.warp(2 hours);

        // store result
        uint8 winningOutcome = 0;
        uint64 truthTime = uint64(block.timestamp - 1 hours);
        settlement.storeResult(MARKET_ID, ADJ_ID, winningOutcome, truthTime);

        // set prover and root
        settlement.setProver(address(this), true);
        int256 pnlDelta = int256(50 ether);
        bytes32 leaf = keccak256(abi.encodePacked(MARKET_ID, trader, pnlDelta));
        bytes32 root = leaf;
        bytes32 batchId = keccak256("BATCH1");
        settlement.storeSettlementRoot(MARKET_ID, batchId, root, "");

        uint256 balBefore = collateral.balanceOf(trader);

        // claim
        vm.prank(trader);
        bytes32[] memory proof = new bytes32[](0);
        settlement.claimSettlement(MARKET_ID, batchId, pnlDelta, proof);

        uint256 balAfter = collateral.balanceOf(trader);
        assertEq(balAfter, balBefore + uint256(pnlDelta));
        assertEq(vault.totalAssets(), 1_000 ether - uint256(pnlDelta));
    }
}
