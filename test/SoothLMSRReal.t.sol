// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/core/SoothLMSRReal.sol";
import "../contracts/core/SoothInterfaces.sol";

contract SoothLMSRRealTest is Test {
    SoothLMSRReal amm;

    function setUp() public {
        amm = new SoothLMSRReal();
    }

    function testPriceBalancedIsHalf() public view {
        ISoothAMM.State memory s =
            ISoothAMM.State({qYes: int256(1_000 ether), qNo: int256(1_000 ether)});
        uint256 b = 10_000 ether;

        uint256 priceYes = amm.price(s, 0, b);
        uint256 priceNo = amm.price(s, 1, b);

        assertApproxEqRel(priceYes, 0.5 ether, 1e14); // 0.01% tolerance
        assertApproxEqRel(priceNo, 0.5 ether, 1e14);
    }

    function testPriceMovesWithImbalance() public view {
        ISoothAMM.State memory s =
            ISoothAMM.State({qYes: int256(1_500 ether), qNo: int256(1_000 ether)});
        uint256 b = 10_000 ether;

        uint256 priceYes = amm.price(s, 0, b);
        uint256 priceNo = amm.price(s, 1, b);

        assertGt(priceYes, 0.5 ether);
        assertLt(priceNo, 0.5 ether);
    }

    function testRoundTripCostIsCloseToZero() public view {
        ISoothAMM.State memory s =
            ISoothAMM.State({qYes: int256(1_000 ether), qNo: int256(1_000 ether)});
        uint256 b = 10_000 ether;

        (int256 costBuy, ISoothAMM.State memory afterBuy) =
            amm.costDelta(s, 0, int256(200 ether), b);
        (int256 costSell, ISoothAMM.State memory afterSell) =
            amm.costDelta(afterBuy, 0, -int256(200 ether), b);

        // Round-trip cost should be tiny (numerical noise only)
        assertApproxEqAbs(costBuy + costSell, 0, 1e9); // 1e-9 token units tolerance
        assertEq(afterSell.qYes, s.qYes);
        assertEq(afterSell.qNo, s.qNo);
    }
}
