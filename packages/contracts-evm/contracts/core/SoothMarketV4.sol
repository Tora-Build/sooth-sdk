// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../core/SoothInterfaces.sol";
import "../interfaces/ISoothMarketV4.sol";
import "../interfaces/ISoothTraderVault.sol";
import "../interfaces/IOutcomeToken.sol";
import "./libs/TickMath.sol";
import "./libs/TickLMSR.sol";

/// @title SoothMarket (V4)
/// @notice Unified tick-based prediction market - AMM engine only
/// @dev V4: Removed ERC1155 inheritance. Tokens now in separate OutcomeToken contract.
///      AMM trades are internal (handled by TraderVault), no minting/burning.
///      Orderbook trades use OutcomeToken (ERC1155).
contract SoothMarketV4 is Ownable, ISoothMarketV4 {
    using TickMath for uint16;
    using TickLMSR for TickLMSR.TickCostArray;

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
    
    // Tick-based AMM state
    uint16 public override currentTick; // Current probability tick [0, 1000]
    TickLMSR.TickCostArray private tickCosts;
    
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
    
    event Initialized(uint256 marketId, uint256 bBase, uint16 initialTick);
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
        uint16 _initialTick
    ) external onlyOwner {
        require(traderVault == address(0), "Market: already init");
        require(_initialTick <= TickMath.TOTAL_TICKS, "Market: invalid tick");

        governorVault = ISoothGovernorVault(_governorVault);
        traderVault = _traderVault;
        feeController = ISoothFeeController(_feeController);
        outcomeToken = IOutcomeToken(_outcomeToken);
        
        marketId = _marketId;
        adjudicatorId = _adjudicatorId;
        bBase = _bBase;
        governor = _governor;
        currentTick = _initialTick;

        // Initialize tick cost array
        tickCosts.initializeTickCosts();
        
        isLive = true;

        emit Initialized(_marketId, _bBase, _initialTick);
    }

    // ============ View Functions ============
    
    function b() public view returns (uint256) {
        // Get unrealizedPnL from GovernorVault (stored in marketReserves[id])
        int256 unrealizedPnL = governorVault.getMarketReserve(marketId);
        
        // b = bBase + (reserveFactorBps / 10000) × unrealizedPnL
        // This allows:
        //   - Governor to increase b by increasing bBase
        //   - unrealizedPnL to increase/decrease b automatically
        uint256 factor = governorVault.reserveFactorBps();
        
        // Calculate the unrealizedPnL contribution: (factor × unrealizedPnL) / MAX_BPS
        int256 pnlContribution = (unrealizedPnL * int256(factor)) / int256(MAX_BPS);
        
        // Add to bBase, ensuring b stays positive
        int256 effectiveB = int256(bBase) + pnlContribution;
        
        // Ensure b is never negative (minimum is 1% of bBase)
        if (effectiveB < int256(bBase / 100)) {
            return bBase / 100;
        }
        
        return uint256(effectiveB);
    }

    function feeLMSR() public view returns (uint256) {
        return governorVault.defaultFeeBps();
    }

    function price(uint8 outcome) external view returns (uint256) {
        if (outcome == 0) {
            return TickLMSR.priceAtTick(currentTick);
        } else {
            return TickLMSR.noPriceAtTick(currentTick);
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

    // Token balance wrappers - delegate to OutcomeToken
    function yesBalance(address user) external view override returns (uint256) {
        return outcomeToken.yesBalance(user);
    }

    function noBalance(address user) external view override returns (uint256) {
        return outcomeToken.noBalance(user);
    }

    // ERC1155 balanceOf wrapper for interface compatibility
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
    /// @dev TraderVault tracks internal ammPositions, not ERC1155
    /// @param trader The trader address (for accounting)
    /// @param outcome 0=YES, 1=NO
    /// @param deltaShares Positive = buy, negative = sell
    /// @return cost Net cost (positive = pay, negative = receive)
    /// @return fee Fee charged
    function executeAMMTrade(
        address trader,
        uint8 outcome,
        int256 deltaShares
    ) external onlyTraderVault onlyLive returns (int256 cost, uint256 fee) {
        require(deltaShares != 0, "Market: zero trade");
        require(outcome < 2, "Market: invalid outcome");

        // Determine direction based on outcome and trade direction
        bool buyingYes = (outcome == 0 && deltaShares > 0) || (outcome == 1 && deltaShares < 0);
        uint256 absShares = deltaShares >= 0 ? uint256(deltaShares) : uint256(-deltaShares);

        // V4: No token burning on sell - TraderVault handles internal positions
        // (TraderVault will check ammPositions[user] before calling this)

        // Calculate tick movement based on shares
        uint16 targetTick;
        (targetTick, cost) = _calculateTradeTicksAndCost(absShares, buyingYes);

        // Apply fee
        uint256 absCost = cost >= 0 ? uint256(cost) : uint256(-cost);
        fee = (absCost * feeLMSR()) / MAX_BPS;

        // Update state
        currentTick = targetTick;
        reserve += int256(fee);

        // V4: No token minting on buy - TraderVault handles internal positions

        emit TradeAMM(trader, outcome, deltaShares, cost, fee);
    }

    /// @notice Calculate target tick and cost for a trade
    function _calculateTradeTicksAndCost(
        uint256 shares,
        bool buyingYes
    ) internal view returns (uint16 targetTick, int256 cost) {
        // Simplified: assume 1 share = 1 tick movement at current b
        // Real implementation would use ticksFromBudget for budget-based trading
        uint16 ticksToMove = uint16((shares * TickMath.TOTAL_TICKS) / b());
        if (ticksToMove == 0) ticksToMove = 1;

        if (buyingYes) {
            targetTick = currentTick + ticksToMove;
            if (targetTick >= TickMath.TOTAL_TICKS) {
                targetTick = TickMath.TOTAL_TICKS - 1;
            }
            cost = tickCosts.costToMove(currentTick, targetTick, b());
        } else {
            if (ticksToMove >= currentTick) {
                targetTick = 1;
            } else {
                targetTick = currentTick - ticksToMove;
            }
            cost = tickCosts.costToMove(currentTick, targetTick, b());
        }
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
            // Buying YES at `price`
            yesPrice = price_;
            isBuySide = true;
        } else {
            // Buying NO at `price` means selling YES at (1 - price)
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
            
            // Can match if bid >= ask
            if (buyOrder.yesPrice < askOrder.yesPrice) break;

            uint256 matchPrice = askOrder.yesPrice;
            uint256 matchAmount = _min(buyOrder.amount, askOrder.amount);

            // V4: Mint tokens via OutcomeToken (orderbook creates real tokens)
            outcomeToken.mint(buyOrder.maker, 0, matchAmount);  // YES
            outcomeToken.mint(askOrder.maker, 1, matchAmount);  // NO

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
            
            // Can match if ask <= bid
            if (sellOrder.yesPrice > bidOrder.yesPrice) break;

            uint256 matchPrice = bidOrder.yesPrice;
            uint256 matchAmount = _min(sellOrder.amount, bidOrder.amount);

            // V4: Mint tokens via OutcomeToken
            outcomeToken.mint(bidOrder.maker, 0, matchAmount);  // YES
            outcomeToken.mint(sellOrder.maker, 1, matchAmount); // NO

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

    // ============ Orderbook Helpers ============

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
    
    /// @notice Transfer OrderbookToken shares (ERC1155)
    function transferShares(
        address from,
        address to,
        uint8 outcome,
        uint256 amount
    ) external onlyTraderVault {
        require(outcome < 2, "Market: invalid outcome");
        uint256 id = outcome == 0 ? 0 : 1;
        // Use ERC1155 safeTransferFrom via OutcomeToken
        // Note: Caller must have approval
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
    
    // V4: merge() is now on OutcomeToken, not Market
    // We keep a stub for interface compatibility but it reverts
    function merge(uint256) external pure {
        revert("Market: use OutcomeToken.merge()");
    }
}
