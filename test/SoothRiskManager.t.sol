// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/core/SoothRiskManager.sol";
import "../contracts/core/SoothVault.sol";
import "./MockERC20.sol";

contract SoothRiskManagerTest is Test {
    MockERC20 collateral;
    SoothVault vault;
    SoothRiskManager riskManager;
    address lp = address(0xBEEF);

    function setUp() public {
        collateral = new MockERC20();
        vault = new SoothVault(collateral);
        riskManager = new SoothRiskManager(vault);

        collateral._mint(lp, 1_000 ether);
        vm.startPrank(lp);
        collateral.approve(address(vault), type(uint256).max);
        vault.depositFor(lp, 1_000 ether);
        vm.stopPrank();
    }

    function testUpdateGlobalBAndGetBForMarket() public {
        // initial global b should be zero
        SoothRiskManager.GlobalRiskParams memory g0 = riskManager.globalRisk();
        assertEq(g0.bGlobal, 0);

        // configure risk class for market
        uint256 marketId = 1;
        riskManager.setMarketRiskClass(marketId, SoothRiskManager.RiskClass.MEDIUM);

        // update global b
        riskManager.updateGlobalB();
        SoothRiskManager.GlobalRiskParams memory g = riskManager.globalRisk();
        assertGt(g.bGlobal, 0);

        uint256 bMarket = riskManager.getBForMarket(marketId);
        assertGt(bMarket, 0);
    }
}
