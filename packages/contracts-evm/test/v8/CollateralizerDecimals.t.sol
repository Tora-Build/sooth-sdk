// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Collateralizer} from "../../contracts/Collateralizer.sol";
import {TruthMarket} from "../../contracts/TruthMarket.sol";
import {OutcomeToken} from "../../contracts/OutcomeToken.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";

/**
 * @notice Explicit decimal-boundary tests for Collateralizer:
 *         - Contract API uses WAD amounts (1e18)
 *         - USDC transfers use token decimals (commonly 6)
 */
contract MockUSDC6 is ERC20Mock {
    function decimals() public view virtual override returns (uint8) {
        return 6;
    }
}

contract CollateralizerDecimalsTest is Test {
    Collateralizer public collateralizer;
    ERC20Mock public usdc;
    TruthMarket public market;

    address public alice = address(0x1);
    address public adjudicator = address(0x99);
    address public guardian = address(0x98);

    uint256 constant WAD = 1e18;

    function setUp() public {
        usdc = new MockUSDC6();
        collateralizer = new Collateralizer(address(usdc));

        vm.prank(alice);
        market = new TruthMarket(
            "Will ETH > $5000?",
            uint64(block.timestamp + 7 days),
            adjudicator,
            guardian
        );

        vm.prank(alice);
        market.activate();

        collateralizer.registerMarket(address(market), "Test Market", "TEST");

        // Mint 1,000 USDC to alice in 6 decimals
        usdc.mint(alice, 1_000e6);
    }

    function test_SplitMerge_6Decimals() public {
        // Split 100 USDC worth of collateral, expressed as WAD
        uint256 amountWad = 100 * WAD;

        vm.startPrank(alice);
        usdc.approve(address(collateralizer), type(uint256).max);

        uint256 usdcBefore = usdc.balanceOf(alice);
        collateralizer.split(address(market), amountWad);

        // USDC debited in token decimals (100e6)
        assertEq(usdc.balanceOf(alice), usdcBefore - 100e6, "USDC should be debited in 6 decimals");

        (address yesToken, address noToken) = collateralizer.getOutcomeTokens(address(market));
        assertEq(OutcomeToken(yesToken).balanceOf(alice), amountWad, "YES minted in WAD");
        assertEq(OutcomeToken(noToken).balanceOf(alice), amountWad, "NO minted in WAD");

        OutcomeToken(yesToken).approve(address(collateralizer), amountWad);
        OutcomeToken(noToken).approve(address(collateralizer), amountWad);
        collateralizer.merge(address(market), amountWad);

        // USDC credited in token decimals (100e6)
        assertEq(usdc.balanceOf(alice), usdcBefore, "USDC should be restored after merge");
        vm.stopPrank();
    }

    function test_RedeemINVALID_6Decimals() public {
        uint256 amountWad = 100 * WAD;

        vm.startPrank(alice);
        usdc.approve(address(collateralizer), type(uint256).max);
        collateralizer.split(address(market), amountWad);
        vm.stopPrank();

        // Settle INVALID (2)
        vm.prank(adjudicator);
        market.settle(2, 0);

        (address yesToken,) = collateralizer.getOutcomeTokens(address(market));

        uint256 usdcBefore = usdc.balanceOf(alice);

        vm.startPrank(alice);
        OutcomeToken(yesToken).approve(address(collateralizer), amountWad);
        uint256 payoutWad = collateralizer.redeemOutcome(address(market), 1, amountWad);
        vm.stopPrank();

        assertEq(payoutWad, 50 * WAD, "INVALID redemption should be 50% in WAD");
        assertEq(usdc.balanceOf(alice), usdcBefore + 50e6, "USDC payout should be in 6 decimals");
    }
}


