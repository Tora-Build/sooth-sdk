// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

interface IMarketMinimal {
    function b() external view returns (uint256);
    function decimalsScale() external view returns (uint256);
    function totalCreatorDeposit() external view returns (uint256);
    function feesAccrued() external view returns (uint256);
    function price(uint8 outcome) external view returns (uint256);
    function _cost(int256 qY, int256 qN, uint256 bVal) external view returns (int256);
    function calculateAMMTradeCost(uint8 outcome, uint256 shares, bool isBuy) external view returns (int256, uint256, int256, int256);
}

contract LaunchpadQuoter {
    function calculateAMMTradeQuote(
        address market,
        uint8 outcome,
        uint256 shares,
        bool isBuy
    ) external view returns (
        int256 cost,
        uint256 fee,
        uint256 nextFloor,
        uint256 nextCeiling,
        uint256 priceImpactBps
    ) {
        IMarketMinimal m = IMarketMinimal(market);
        (int256 costWad, uint256 feeWad, int256 nextQY, int256 nextQN) = m.calculateAMMTradeCost(outcome, shares, isBuy);
        
        uint256 bv = m.b();
        
        cost = costWad;
        fee = feeWad;
        
        uint256 ammCash = _ammAssetsAt(m, nextQY, nextQN, bv);
        uint256 qY_ = uint256(nextQY >= 0 ? nextQY : int256(0));
        uint256 qN_ = uint256(nextQN >= 0 ? nextQN : int256(0));
        
        uint256 maxL = qY_ > qN_ ? qY_ : qN_;
        uint256 minL = qY_ < qN_ ? qY_ : qN_;
        
        nextFloor = ammCash > maxL ? ammCash - maxL : 0;
        nextCeiling = ammCash > minL ? ammCash - minL : 0;
        
        uint256 p = m.price(outcome);
        if (shares > 0 && p > 0) {
            uint256 avg = uint256(costWad >= 0 ? costWad : -costWad) * 1e18 / shares;
            if (isBuy) {
                priceImpactBps = (avg > p) ? ((avg - p) * 10000 / p) : 0;
            } else {
                priceImpactBps = (p > avg) ? ((p - avg) * 10000 / p) : 0;
            }
        } else {
            priceImpactBps = 0;
        }
    }
    
    function _ammAssetsAt(IMarketMinimal m, int256 y, int256 n, uint256 bv) internal view returns (uint256) {
        if (bv == 0) return 0;
        int256 delta = m._cost(y, n, bv) - m._cost(0, 0, bv);
        uint256 s = m.decimalsScale();
        int256 t = int256(m.totalCreatorDeposit() * s) + int256(m.feesAccrued()) + delta;
        return t > 0 ? uint256(t) : 0;
    }
}

