// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../core/SoothInterfaces.sol";
import "../interfaces/ISoothMarketV4.sol";
import "../interfaces/ISoothTraderVault.sol";
import "../interfaces/IOutcomeToken.sol";
import {wrap} from "prb-math/sd59x18/Casting.sol";
import {exp, ln} from "prb-math/sd59x18/Math.sol";
import {uEXP_MAX_INPUT, uUNIT} from "prb-math/sd59x18/Constants.sol";

/// @title SoothMarket (V4)
/// @notice Unified prediction market with continuous LMSR AMM
/// @dev V4: Uses continuous LMSR (qYes/qNo state) with PRB-Math.
///      AMM trades are internal (handled by TraderVault), no minting/burning.
///      Orderbook trades use OutcomeToken (ERC1155).
contract SoothMarketV4 is Ownable, ISoothMarketV4 {
    int256 internal constant ONE = 1e18;

    // ============ State ============
    
    IOutcomeToken public outcomeToken;
    ISoothGovernorVault public governorVault;
    address public traderVault;
    ISoothFeeController public feeController;

    uint256 public override marketId;
    bytes32 public adjudicatorId;
    
    // Liquidity parameters
    uint256 public override bBase;      // Base liquidity parameter
    int256 public reserve;     // Net market PnL
    
    // Continuous LMSR state (qYes, qNo)
    int256 public qYes;
    int256 public qNo;
    
    address public governor;
    uint256 public constant MAX_BPS = 10000;

    bool public override isLive;
    bool public override isSettled;
    uint8 public override winningOutcome;

    // ============ Unified Orderbook ============
    
    mapping(uint256 => OrderV4) private _orders;
    mapping(uint256 => uint256) public nextOrder;
    
    uint256 public bestAsk;   // Lowest yesPrice (best for YES buyers)
    uint256 public bestBid;   // Highest yesPrice (best for NO buyers)
    uint256 public nextOrderId = 1;

    // ============ Events ============
    
    event Initialized(uint256 marketId, uint256 bBase, int256 initialQYes, int256 initialQNo);
    event Settled(uint8 winningOutcome);
    event BBaseIncrease(uint256 oldB, uint256 newB);

    // ============ Constructor ============
    
    constructor() {
        // Ownable constructor handles owner
    }

    // ============ Initialization ============
    
    function initialize(
        uint256 _marketId,
        address _governorVault,
        address _traderVault,
        address _feeController,
        address _outcomeToken,
        bytes32 _adjudicatorId,
        uint256 _bBase,
        address _governor,
        int256 _initialQYes,
        int256 _initialQNo
    ) external onlyOwner {
        require(traderVault == address(0), "Market: already init");
        require(_initialQYes >= 0 && _initialQNo >= 0, "Market: negative q");

        governorVault = ISoothGovernorVault(_governorVault);
        traderVault = _traderVault;
        feeController = ISoothFeeController(_feeController);
        outcomeToken = IOutcomeToken(_outcomeToken);
        
        marketId = _marketId;
        adjudicatorId = _adjudicatorId;
        bBase = _bBase;
        governor = _governor;
        
        // Initialize LMSR state (default: equal quantities for 50% probability)
        qYes = _initialQYes;
        qNo = _initialQNo;
        
        isLive = true;

        emit Initialized(_marketId, _bBase, _initialQYes, _initialQNo);
    }

    // ============ LMSR Math ============

    /// @dev ln(exp(a) + exp(b)) using the log-sum-exp trick
    function _logSumExp2(int256 a, int256 b_) internal pure returns (int256) {
        int256 m = a > b_ ? a : b_;
        int256 aShifted = a - m;
        int256 bShifted = b_ - m;
        require(aShifted <= int256(uEXP_MAX_INPUT) && bShifted <= int256(uEXP_MAX_INPUT), "LMSR: exp overflow");

        int256 eA = exp(wrap(aShifted)).unwrap();
        int256 eB = exp(wrap(bShifted)).unwrap();

        int256 sum = eA + eB;
        require(sum > 0, "LMSR: exp underflow");
        return ln(wrap(sum)).unwrap() + m;
    }

    /// @dev LMSR cost function C(q) = b * ln( exp(qY/b) + exp(qN/b) )
    function _cost(int256 _qYes, int256 _qNo, uint256 bVal) internal pure returns (int256) {
        require(bVal > 0, "LMSR: b = 0");
        int256 bWad = int256(bVal);

        int256 a = (_qYes * ONE) / bWad;
        int256 c = (_qNo * ONE) / bWad;

        int256 lse = _logSumExp2(a, c);
        return (bWad * lse) / ONE;
    }

    /// @dev Calculate cost delta for a trade
    function _costDelta(
        int256 _qYes,
        int256 _qNo,
        uint8 outcomeIndex,
        int256 deltaShares,
        uint256 bVal
    ) internal pure returns (int256 cost, int256 newQYes, int256 newQNo) {
        int256 oldCost = _cost(_qYes, _qNo, bVal);

        if (outcomeIndex == 0) {
            newQYes = _qYes + deltaShares;
            newQNo = _qNo;
        } else {
            newQYes = _qYes;
            newQNo = _qNo + deltaShares;
        }

        int256 newCost = _cost(newQYes, newQNo, bVal);
        cost = newCost - oldCost;
    }

    // ============ View Functions ============
    
    function b() public view returns (uint256) {
        int256 unrealizedPnL = governorVault.getMarketReserve(marketId);
        uint256 factor = governorVault.reserveFactorBps();
        int256 pnlContribution = (unrealizedPnL * int256(factor)) / int256(MAX_BPS);
        int256 effectiveB = int256(bBase) + pnlContribution;
        
        if (effectiveB < int256(bBase / 100)) {
            return bBase / 100;
        }
        
        return uint256(effectiveB);
    }

    function feeLMSR() public view returns (uint256) {
        return governorVault.defaultFeeBps();
    }

    /// @notice Get price of outcome (0=YES, 1=NO)
    function price(uint8 outcome) external view returns (uint256 priceWad) {
        require(outcome < 2, "Market: invalid outcome");
        uint256 bVal = b();
        require(bVal > 0, "LMSR: b = 0");

        int256 bWad = int256(bVal);
        int256 a = (qYes * ONE) / bWad;
        int256 c = (qNo * ONE) / bWad;

        require(a <= int256(uEXP_MAX_INPUT) && c <= int256(uEXP_MAX_INPUT), "LMSR: exp overflow");

        int256 eY = exp(wrap(a)).unwrap();
        int256 eN = exp(wrap(c)).unwrap();

        int256 denom = eY + eN;
        require(denom > 0, "LMSR: denom");

        int256 pYes = (eY * int256(uUNIT)) / denom;

        if (outcome == 0) {
            return uint256(pYes);
        } else {
            return uint256(int256(uUNIT) - pYes);
        }
    }

    function orders(uint256 orderId) external view returns (OrderV4 memory) {
        return _orders[orderId];
    }

    function bestOrder(uint256 outcome) external view returns (uint256) {
        if (outcome == 0) {
            return bestAsk;
        } else {
            return bestBid;
        }
    }

    function yesBalance(address user) external view override returns (uint256) {
        return outcomeToken.yesBalance(user);
    }

    function noBalance(address user) external view override returns (uint256) {
        return outcomeToken.noBalance(user);
    }

    function balanceOf(address account, uint256 id) external view returns (uint256) {
        return outcomeToken.balanceOf(account, id);
    }

    // ============ Modifiers ============
    
    modifier onlyTraderVault() {
        require(msg.sender == traderVault, "Market: not TraderVault");
        _;
    }

    modifier onlyLive() {
        require(isLive && !isSettled, "Market: not live");
        _;
    }

    modifier onlyGovernor() {
        require(msg.sender == governor, "Market: not governor");
        _;
    }

    // ============ AMM Trading ============
    
    /// @notice Execute AMM trade (V4: no token minting - internal positions only)
    function executeAMMTrade(
        address trader,
        uint8 outcome,
        int256 deltaShares
    ) external onlyTraderVault onlyLive returns (int256 cost, uint256 fee) {
        require(deltaShares != 0, "Market: zero trade");
        require(outcome < 2, "Market: invalid outcome");

        uint256 bVal = b();
        
        int256 newQYes;
        int256 newQNo;
        (cost, newQYes, newQNo) = _costDelta(qYes, qNo, outcome, deltaShares, bVal);

        // Apply fee
        uint256 absCost = cost >= 0 ? uint256(cost) : uint256(-cost);
        fee = (absCost * feeLMSR()) / MAX_BPS;

        // Update state
        qYes = newQYes;
        qNo = newQNo;
        reserve += int256(fee);

        emit TradeAMM(trader, outcome, deltaShares, cost, fee);
    }

    /// @notice View function to calculate trade cost/fee without executing
    function calculateAMMTradeCost(
        uint8 outcome,
        uint256 shares,
        bool isBuy
    ) external view override returns (int256 cost, uint256 fee, int256 newQYes_, int256 newQNo_) {
        require(outcome < 2, "Market: invalid outcome");
        
        uint256 bVal = b();
        int256 deltaShares = isBuy ? int256(shares) : -int256(shares);
        
        (cost, newQYes_, newQNo_) = _costDelta(qYes, qNo, outcome, deltaShares, bVal);
        
        uint256 absCost = cost >= 0 ? uint256(cost) : uint256(-cost);
        fee = (absCost * feeLMSR()) / MAX_BPS;
    }

    // ============ Orderbook Functions ============
    
    function createOrder(
        address maker,
        uint8 outcome,
        uint256 price_,
        uint256 amount
    ) external onlyTraderVault onlyLive returns (uint256 orderId) {
        require(price_ > 0 && price_ < 1e18, "Market: invalid price");
        require(amount > 0, "Market: invalid amount");

        orderId = nextOrderId++;

        uint256 yesPrice;
        bool isBuySide;

        if (outcome == 0) {
            yesPrice = price_;
            isBuySide = true;
        } else {
            yesPrice = 1e18 - price_;
            isBuySide = false;
        }

        _orders[orderId] = OrderV4({
            maker: maker,
            outcome: outcome,
            yesPrice: yesPrice,
            amount: amount,
            isBuySide: isBuySide
        });

        if (isBuySide) {
            _insertBid(orderId, yesPrice);
        } else {
            _insertAsk(orderId, yesPrice);
        }

        emit OrderCreated(orderId, maker, outcome, price_, amount);

        _tryMatch(orderId);
    }

    function cancelOrder(
        uint256 orderId,
        address maker
    ) external onlyTraderVault returns (uint256 refund) {
        OrderV4 storage o = _orders[orderId];
        require(o.maker == maker, "Market: not maker");
        require(o.amount > 0, "Market: already filled");

        refund = o.yesPrice * o.amount / 1e18;
        
        _removeFromBook(orderId);
        delete _orders[orderId];

        emit OrderCancelled(orderId, maker, refund);
    }

    function _tryMatch(uint256 newOrderId) internal {
        OrderV4 storage newOrder = _orders[newOrderId];
        if (newOrder.amount == 0) return;

        if (newOrder.isBuySide) {
            _matchBuyOrder(newOrderId);
        } else {
            _matchSellOrder(newOrderId);
        }
    }

    function _matchBuyOrder(uint256 buyOrderId) internal {
        OrderV4 storage buyOrder = _orders[buyOrderId];
        
        while (buyOrder.amount > 0 && bestAsk != 0) {
            OrderV4 storage askOrder = _orders[bestAsk];
            
            if (buyOrder.yesPrice < askOrder.yesPrice) break;

            uint256 matchPrice = askOrder.yesPrice;
            uint256 matchAmount = _min(buyOrder.amount, askOrder.amount);

            outcomeToken.mint(buyOrder.maker, 0, matchAmount);
            outcomeToken.mint(askOrder.maker, 1, matchAmount);

            buyOrder.amount -= matchAmount;
            askOrder.amount -= matchAmount;

            emit OrderMatched(buyOrderId, bestAsk, matchAmount, matchPrice);

            if (askOrder.amount == 0) {
                uint256 filledAsk = bestAsk;
                bestAsk = nextOrder[bestAsk];
                delete _orders[filledAsk];
            }
        }
    }

    function _matchSellOrder(uint256 sellOrderId) internal {
        OrderV4 storage sellOrder = _orders[sellOrderId];
        
        while (sellOrder.amount > 0 && bestBid != 0) {
            OrderV4 storage bidOrder = _orders[bestBid];
            
            if (sellOrder.yesPrice > bidOrder.yesPrice) break;

            uint256 matchPrice = bidOrder.yesPrice;
            uint256 matchAmount = _min(sellOrder.amount, bidOrder.amount);

            outcomeToken.mint(bidOrder.maker, 0, matchAmount);
            outcomeToken.mint(sellOrder.maker, 1, matchAmount);

            sellOrder.amount -= matchAmount;
            bidOrder.amount -= matchAmount;

            emit OrderMatched(bestBid, sellOrderId, matchAmount, matchPrice);

            if (bidOrder.amount == 0) {
                uint256 filledBid = bestBid;
                bestBid = nextOrder[bestBid];
                delete _orders[filledBid];
            }
        }
    }

    function _insertAsk(uint256 id, uint256 yesPrice) internal {
        uint256 prev = 0;
        uint256 curr = bestAsk;

        while (curr != 0 && _orders[curr].yesPrice <= yesPrice) {
            prev = curr;
            curr = nextOrder[curr];
        }

        if (prev == 0) {
            nextOrder[id] = bestAsk;
            bestAsk = id;
        } else {
            nextOrder[id] = nextOrder[prev];
            nextOrder[prev] = id;
        }
    }

    function _insertBid(uint256 id, uint256 yesPrice) internal {
        uint256 prev = 0;
        uint256 curr = bestBid;

        while (curr != 0 && _orders[curr].yesPrice >= yesPrice) {
            prev = curr;
            curr = nextOrder[curr];
        }

        if (prev == 0) {
            nextOrder[id] = bestBid;
            bestBid = id;
        } else {
            nextOrder[id] = nextOrder[prev];
            nextOrder[prev] = id;
        }
    }

    function _removeFromBook(uint256 orderId) internal {
        OrderV4 storage o = _orders[orderId];
        
        if (o.isBuySide) {
            if (bestBid == orderId) {
                bestBid = nextOrder[orderId];
            } else {
                uint256 prev = bestBid;
                while (nextOrder[prev] != orderId && nextOrder[prev] != 0) {
                    prev = nextOrder[prev];
                }
                if (nextOrder[prev] == orderId) {
                    nextOrder[prev] = nextOrder[orderId];
                }
            }
        } else {
            if (bestAsk == orderId) {
                bestAsk = nextOrder[orderId];
            } else {
                uint256 prev = bestAsk;
                while (nextOrder[prev] != orderId && nextOrder[prev] != 0) {
                    prev = nextOrder[prev];
                }
                if (nextOrder[prev] == orderId) {
                    nextOrder[prev] = nextOrder[orderId];
                }
            }
        }
        delete nextOrder[orderId];
    }

    function _min(uint256 a, uint256 b_) internal pure returns (uint256) {
        return a < b_ ? a : b_;
    }

    // ============ Token Transfer (Orderbook only) ============
    
    function transferShares(
        address from,
        address to,
        uint8 outcome,
        uint256 amount
    ) external onlyTraderVault {
        require(outcome < 2, "Market: invalid outcome");
        uint256 id = outcome == 0 ? 0 : 1;
        outcomeToken.safeTransferFrom(from, to, id, amount, "");
    }

    // ============ Governor Functions ============
    
    function increaseBBase(uint256 amount) external onlyGovernor {
        uint256 oldB = bBase;
        bBase += amount;
        emit BBaseIncrease(oldB, bBase);
    }

    function settle(uint8 _winningOutcome) external onlyGovernor {
        require(isLive, "Market: not live");
        require(_winningOutcome < 2, "Market: invalid outcome");
        
        isLive = false;
        isSettled = true;
        winningOutcome = _winningOutcome;

        emit Settled(_winningOutcome);
    }

    // ============ Required Interface Functions ============
    
    function merge(uint256) external pure {
        revert("Market: use OutcomeToken.merge()");
    }

    // V4: Remove tick-related functions since we use qYes/qNo
    // currentTick() is removed - use price() instead
}
