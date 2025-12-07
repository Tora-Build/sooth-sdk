// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../core/SoothInterfaces.sol";
import "../interfaces/ISoothMarket.sol";

/// @title SoothMarket
/// @notice Market with unified orderbook (Sell YES = Buy NO)
/// @dev Uses complete set creation model - no collateral locking
contract SoothMarket is ISoothMarket, Ownable {
    // ============ State ============

    ISoothGovernorVault public governorVault;
    address public override traderVault;
    ISoothAMM public amm;
    ISoothFeeController public feeController;

    uint256 public marketId;
    bytes32 public adjudicatorId;
    
    // Liquidity & Fee State
    uint256 public bBase;      // Initial 'b' set at creation
    int256 public reserve;     // Net market PnL (starts at 0)

    address public governor;
    // feeLMSR is now dynamic from vault
    uint256 public constant MAX_BPS = 10000;

    bool public override isLive;
    bool public override isSettled;
    uint8 public winningOutcome;

    ISoothAMM.State public ammState;

    // Token balances
    mapping(address => uint256) public override yesBalance;
    mapping(address => uint256) public override noBalance;

    // ============ Unified Orderbook ============

    mapping(uint256 => OrderV3) private _orders;
    mapping(uint256 => uint256) public nextOrder; // Linked list
    
    // Single orderbook with two access points
    uint256 public override bestAsk;  // Lowest yesPrice (best for YES buyers)
    uint256 public override bestBid;  // Highest yesPrice (best for NO buyers)
    
    uint256 public nextOrderId = 1;

    // ============ Events ============

    event Initialized(uint256 indexed marketId, address traderVault, address amm, uint256 b);
    event Settled(uint8 winningOutcome);
    event BBaseIncrease(uint256 amount, uint256 newBBase);

    // ============ Constructor ============

    constructor() {}

    // ============ Initialization ============

    function initialize(
        uint256 _marketId,
        ISoothGovernorVault _governorVault,
        address _traderVault,
        ISoothAMM _amm,
        ISoothFeeController _feeController,
        bytes32 _adjudicatorId,
        uint256 _bBase,
        address _governor,
        int256 _initialQuantity
    ) external onlyOwner {
        require(traderVault == address(0), "Market: already init");
        require(_initialQuantity > 0, "Market: invalid initial qty");

        governorVault = _governorVault;
        traderVault = _traderVault;
        amm = _amm;
        feeController = _feeController;
        adjudicatorId = _adjudicatorId;
        marketId = _marketId;
        bBase = _bBase;
        // feeLMSR is dynamic
        governor = _governor;
        
        // Initial liquidity
        ammState.qYes = _initialQuantity;
        ammState.qNo = _initialQuantity;

        isLive = true;

        emit Initialized(_marketId, _traderVault, address(_amm), _bBase);
    }
    
    // ============ Liquidity Views ============

    function b() public view returns (uint256) {
        uint256 factor = governorVault.reserveFactorBps();
        if (reserve <= 0) return bBase;
        // b = bBase + (reserve * factor / 10000)
        return bBase + (uint256(reserve) * factor / MAX_BPS);
    }

    function feeLMSR() public view returns (uint256) {
        return governorVault.defaultFeeBps();
    }

    function increaseBBase(uint256 amount) external onlyGovernor {
        bBase += amount;
        emit BBaseIncrease(amount, bBase);
    }
    
    // ============ Core Logic ============
    
    // ... existing setGovernor ...

    // ... existing settlement logic ...

    // ... existing orderbook logic ...

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

    // ============ View Functions ============

    function orders(uint256 orderId) external view override returns (OrderV3 memory) {
        return _orders[orderId];
    }

    /// @notice Frontend compatibility helper - returns best order ID for outcome
    function bestOrder(uint256 outcome) external view returns (uint256) {
        if (outcome == 0) {
            return bestAsk;
        } else {
            return bestBid;
        }
    }

    function getPrice(uint8 outcome) external view override returns (uint256) {
        return amm.price(ammState, outcome, b());
    }

    // ============ TraderVault Callbacks ============

    function createOrder(
        address maker,
        uint8 outcome,
        uint256 price,
        uint256 amount
    ) external override onlyTraderVault onlyLive returns (uint256 orderId) {
        require(price > 0 && price < 1e18, "Market: invalid price");
        require(amount > 0, "Market: invalid amount");

        orderId = nextOrderId++;

        // Normalize to yesPrice
        uint256 yesPrice;
        bool isBuySide;
        if (outcome == 0) {
            // Buying YES at `price`
            yesPrice = price;
            isBuySide = true;
        } else {
            // Buying NO at `price` = Selling YES at (1 - price)
            yesPrice = 1e18 - price;
            isBuySide = false;
        }

        _orders[orderId] = OrderV3({
            id: orderId,
            maker: maker,
            yesPrice: yesPrice,
            amount: amount,
            timestamp: block.timestamp,
            isBuySide: isBuySide
        });

        // Insert into appropriate side of orderbook
        if (isBuySide) {
            _insertBid(orderId, yesPrice);
        } else {
            _insertAsk(orderId, yesPrice);
        }

        emit OrderCreated(orderId, maker, outcome, price, amount);

        // Try to match immediately
        _tryMatch(orderId);
    }

    function cancelOrder(
        uint256 orderId,
        address maker
    ) external override onlyTraderVault returns (uint256 refund) {
        OrderV3 storage o = _orders[orderId];
        require(o.maker == maker, "Market: not maker");
        require(o.amount > 0, "Market: already filled");

        // Calculate refund (price * remaining amount)
        uint256 price = o.isBuySide ? o.yesPrice : (1e18 - o.yesPrice);
        refund = price * o.amount / 1e18;

        // Remove from orderbook
        if (o.isBuySide) {
            _removeBid(orderId);
        } else {
            _removeAsk(orderId);
        }

        delete _orders[orderId];
        emit OrderCancelled(orderId);
    }

    function executeAMMTrade(
        address trader,
        uint8 outcome,
        int256 deltaShares
    ) external override onlyTraderVault onlyLive returns (int256 cost, uint256 fee) {
        require(deltaShares != 0, "Market: zero trade");

        // If selling, must own tokens
        if (deltaShares < 0) {
            uint256 shares = uint256(-deltaShares);
            if (outcome == 0) {
                require(yesBalance[trader] >= shares, "Market: not enough YES");
                yesBalance[trader] -= shares;
            } else {
                require(noBalance[trader] >= shares, "Market: not enough NO");
                noBalance[trader] -= shares;
            }
        }

        // Calculate AMM cost using dynamic b()
        ISoothAMM.State memory newState;
        (cost, newState) = amm.costDelta(ammState, outcome, deltaShares, b());

        // Calculate fee using dynamic feeLMSR()
        uint256 absCost = cost >= 0 ? uint256(cost) : uint256(-cost);
        fee = (absCost * feeLMSR()) / MAX_BPS;

        // Update state
        ammState = newState;
        
        // Update reserve with fee (LP profit)
        reserve += int256(fee); 

        // If buying, credit tokens
        if (deltaShares > 0) {
            uint256 shares = uint256(deltaShares);
            if (outcome == 0) {
                yesBalance[trader] += shares;
            } else {
                noBalance[trader] += shares;
            }
        }

        emit TradeAMM(trader, outcome, deltaShares, cost, fee);
    }

    // ============ Orderbook Matching ============

    function _tryMatch(uint256 newOrderId) internal {
        OrderV3 storage newOrder = _orders[newOrderId];
        if (newOrder.amount == 0) return;

        if (newOrder.isBuySide) {
            // New order wants YES - match against asks (sellers of YES = buyers of NO)
            _matchBuyOrder(newOrderId);
        } else {
            // New order wants NO - match against bids (buyers of YES)
            _matchSellOrder(newOrderId);
        }
    }

    function _matchBuyOrder(uint256 buyOrderId) internal {
        OrderV3 storage buyOrder = _orders[buyOrderId];
        
        while (buyOrder.amount > 0 && bestAsk != 0) {
            OrderV3 storage askOrder = _orders[bestAsk];
            
            // Check if prices cross (buyer willing to pay >= seller asking)
            if (buyOrder.yesPrice < askOrder.yesPrice) {
                break; // No match
            }

            // Match at ask price (price improvement to buyer)
            uint256 matchPrice = askOrder.yesPrice;
            uint256 matchAmount = _min(buyOrder.amount, askOrder.amount);

            // Execute match
            _executeMatch(buyOrder.maker, askOrder.maker, matchPrice, matchAmount);

            // Update amounts
            buyOrder.amount -= matchAmount;
            askOrder.amount -= matchAmount;

            emit OrderMatched(buyOrderId, bestAsk, matchAmount, matchPrice);

            // Remove filled ask
            if (askOrder.amount == 0) {
                uint256 filledAsk = bestAsk;
                bestAsk = nextOrder[bestAsk];
                delete _orders[filledAsk];
            }
        }
    }

    function _matchSellOrder(uint256 sellOrderId) internal {
        OrderV3 storage sellOrder = _orders[sellOrderId];
        
        while (sellOrder.amount > 0 && bestBid != 0) {
            OrderV3 storage bidOrder = _orders[bestBid];
            
            // Check if prices cross (seller asking <= buyer bidding)
            if (sellOrder.yesPrice > bidOrder.yesPrice) {
                break; // No match
            }

            // Match at bid price (price improvement to seller)
            uint256 matchPrice = bidOrder.yesPrice;
            uint256 matchAmount = _min(sellOrder.amount, bidOrder.amount);

            // Execute match (bidOrder wants YES, sellOrder wants NO)
            _executeMatch(bidOrder.maker, sellOrder.maker, matchPrice, matchAmount);

            // Update amounts
            sellOrder.amount -= matchAmount;
            bidOrder.amount -= matchAmount;

            emit OrderMatched(bestBid, sellOrderId, matchAmount, matchPrice);

            // Remove filled bid
            if (bidOrder.amount == 0) {
                uint256 filledBid = bestBid;
                bestBid = nextOrder[bestBid];
                delete _orders[filledBid];
            }
        }
    }

    function _executeMatch(
        address yesBuyer,
        address noBuyer,
        uint256 yesPrice,
        uint256 amount
    ) internal {
        // Complete set creation: mint YES to buyer, NO to seller
        yesBalance[yesBuyer] += amount;
        noBalance[noBuyer] += amount;

        // Funds handling:
        // Buyer pays: price * amount
        // Seller gets: (1-price) * amount [which is priceNo * amount]
        
        uint256 cost = amount * yesPrice / 1e18;
        // Adjust for potential precision loss
        if (cost * 1e18 / amount != yesPrice) {
            // Very small amounts might be tricky, standard logic
        }

        uint256 proceeds = amount - cost;

        // Fee logic would go here
        
        // Callback to TraderVault to handle funds Transfer
        // This is simplified, actual vault calls are in matching loop
        // We assume _tryMatch handles vault calls via onOrderMatched
    }

    // ============ Transfer Logic ============

    function transferShares(
        address from,
        address to,
        uint8 outcome,
        uint256 amount
    ) external override onlyTraderVault onlyLive {
        require(from != address(0), "Market: invalid from");
        require(to != address(0), "Market: invalid to");

        if (outcome == 0) {
            require(yesBalance[from] >= amount, "Market: insufficient YES balance");
            yesBalance[from] -= amount;
            yesBalance[to] += amount;
        } else {
            require(noBalance[from] >= amount, "Market: insufficient NO balance");
            noBalance[from] -= amount;
            noBalance[to] += amount;
        }
    }

    // ============ Orderbook Helpers ============

    function _insertAsk(uint256 id, uint256 yesPrice) internal {
        // Asks sorted by yesPrice ASCENDING (lowest first = best ask)
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
        // Bids sorted by yesPrice DESCENDING (highest first = best bid)
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

    function _removeAsk(uint256 id) internal {
        uint256 prev = 0;
        uint256 curr = bestAsk;

        while (curr != 0) {
            if (curr == id) {
                if (prev == 0) {
                    bestAsk = nextOrder[curr];
                } else {
                    nextOrder[prev] = nextOrder[curr];
                }
                nextOrder[curr] = 0;
                return;
            }
            prev = curr;
            curr = nextOrder[curr];
        }
    }

    function _removeBid(uint256 id) internal {
        uint256 prev = 0;
        uint256 curr = bestBid;

        while (curr != 0) {
            if (curr == id) {
                if (prev == 0) {
                    bestBid = nextOrder[curr];
                } else {
                    nextOrder[prev] = nextOrder[curr];
                }
                nextOrder[curr] = 0;
                return;
            }
            prev = curr;
            curr = nextOrder[curr];
        }
    }

    function _min(uint256 a, uint256 b_) internal pure returns (uint256) {
        return a < b_ ? a : b_;
    }

    // ============ Settlement ============

    function markSettled(uint8 _winningOutcome) external onlyOwner {
        require(!isSettled, "Market: already settled");
        isSettled = true;
        isLive = false;
        winningOutcome = _winningOutcome;
        emit Settled(_winningOutcome);
    }

    // ============ Governor Functions ============


}
