// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "../core/SoothInterfaces.sol";
import "../interfaces/ISoothMarket.sol";
import "../interfaces/ISoothTraderVault.sol";
import "./libs/TickMath.sol";
import "./libs/TickLMSR.sol";

/// @title SoothMarket
/// @notice Unified tick-based prediction market with ERC1155 tokenization
/// @dev Replaces continuous LMSR with discrete tick-based pricing
///      Outcome shares are ERC1155 tokens (token ID 0 = YES, token ID 1 = NO)
contract SoothMarket is ERC1155, Ownable, ISoothMarket {
    using TickMath for uint16;
    using TickLMSR for TickLMSR.TickCostArray;

    // ============ Token IDs ============
    uint256 public constant YES_TOKEN_ID = 0;
    uint256 public constant NO_TOKEN_ID = 1;

    // ============ State ============
    // ============ State ============
    ISoothGovernorVault public governorVault;
    address public traderVault;
    ISoothFeeController public feeController;

    uint256 public marketId;
    bytes32 public adjudicatorId;
    
    // Liquidity parameters
    uint256 public bBase;      // Base liquidity parameter
    int256 public reserve;     // Net market PnL
    
    // Tick-based AMM state
    uint16 public currentTick; // Current probability tick [0, 1000]
    TickLMSR.TickCostArray private tickCosts;
    
    address public governor;
    uint256 public constant MAX_BPS = 10000;

    bool public isLive;
    bool public isSettled;
    uint8 public winningOutcome;

    // ============ Unified Orderbook ============
    // OrderV3 struct inherited from ISoothMarket

    mapping(uint256 => OrderV3) private _orders;
    mapping(uint256 => uint256) public nextOrder;
    
    uint256 public bestAsk;   // Lowest yesPrice (best for YES buyers)
    uint256 public bestBid;   // Highest yesPrice (best for NO buyers)
    uint256 public nextOrderId = 1;

    // Events inherited from ISoothMarket except Merged (Wait, Merged is NOT in ISoothMarket yet? I logic added merge function. I need to check.) 
    // ISoothMarket has OrderCreated, OrderMatched, OrderCancelled, TradeAMM.
    // It DOES NOT have Initialized, Settled, BBaseIncrease.
    // It DOES NOT have Merged (I added merge function but not event to interface?).
    
    // Check Step 381 diff: I added merge() to interface, but did I add Merged event? No.
    // So Merged event stays. Initialized, Settled, BBaseIncrease stay.
    // OrderCreated, OrderMatched, OrderCancelled, TradeAMM remove.

    event Initialized(uint256 indexed marketId, address traderVault, uint256 b);
    event Settled(uint8 winningOutcome);
    event BBaseIncrease(uint256 amount, uint256 newBBase);
    event Merged(address indexed user, uint256 amount);

    // ============ Constructor ============
    constructor() ERC1155("") Ownable() {}

    // ============ Initialization ============

    function initialize(
        uint256 _marketId,
        address _governorVault,
        address _traderVault,
        address _feeController,
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
        adjudicatorId = _adjudicatorId;
        marketId = _marketId;
        bBase = _bBase;
        governor = _governor;
        
        // Set initial tick (typically 500 = 50%)
        currentTick = _initialTick;
        
        // Initialize tick costs
        tickCosts.initializeTickCosts();

        isLive = true;

        emit Initialized(_marketId, _traderVault, _bBase);
    }
    
    // ============ Liquidity Views ============

    function b() public view returns (uint256) {
        uint256 factor = governorVault.reserveFactorBps();
        if (reserve <= 0) return bBase;
        return bBase + (uint256(reserve) * factor / MAX_BPS);
    }

    function feeLMSR() public view returns (uint256) {
        return governorVault.defaultFeeBps();
    }

    function getPrice(uint8 outcome) external view returns (uint256) {
        if (outcome == 0) {
            return TickLMSR.priceAtTick(currentTick);
        } else {
            return TickLMSR.noPriceAtTick(currentTick);
        }
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

    // ============ Core Trading: Tick-Based AMM ============

    /// @notice Execute an AMM trade using tick-based pricing
    /// @param trader Address of the trader
    /// @param outcome 0 = YES, 1 = NO
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

        // If selling, burn tokens first
        if (deltaShares < 0) {
            uint256 tokenId = outcome == 0 ? YES_TOKEN_ID : NO_TOKEN_ID;
            require(balanceOf(trader, tokenId) >= absShares, "Market: insufficient balance");
            _burn(trader, tokenId, absShares);
        }

        // Calculate tick movement based on shares
        // For YES buys: probability increases (tick goes up)
        // For YES sells: probability decreases (tick goes down)
        uint16 targetTick;
        (targetTick, cost) = _calculateTradeTicksAndCost(absShares, buyingYes);

        // Apply fee
        uint256 absCost = cost >= 0 ? uint256(cost) : uint256(-cost);
        fee = (absCost * feeLMSR()) / MAX_BPS;

        // Update state
        currentTick = targetTick;
        reserve += int256(fee);

        // If buying, mint tokens
        if (deltaShares > 0) {
            uint256 tokenId = outcome == 0 ? YES_TOKEN_ID : NO_TOKEN_ID;
            _mint(trader, tokenId, absShares, "");
        }

        emit TradeAMM(trader, outcome, deltaShares, cost, fee);
    }

    /// @notice Calculate target tick and cost for a trade
    function _calculateTradeTicksAndCost(
        uint256 shares,
        bool buyingYes
    ) internal view returns (uint16 targetTick, int256 cost) {
        // Simplified: assume 1 share = 1 tick movement at current b
        // In production, this would use the tickCosts array properly
        
        // Calculate how many ticks this trade moves
        uint256 ticksToMove = (shares * TickMath.TOTAL_TICKS) / b();
        if (ticksToMove == 0) ticksToMove = 1; // Minimum 1 tick
        if (ticksToMove > TickMath.TOTAL_TICKS) ticksToMove = TickMath.TOTAL_TICKS;

        if (buyingYes) {
            // Moving tick up
            targetTick = currentTick + uint16(ticksToMove);
            if (targetTick > TickMath.TOTAL_TICKS) targetTick = TickMath.TOTAL_TICKS;
            cost = tickCosts.costToMove(currentTick, targetTick, b());
        } else {
            // Moving tick down
            if (uint16(ticksToMove) >= currentTick) {
                targetTick = 0;
            } else {
                targetTick = currentTick - uint16(ticksToMove);
            }
            cost = tickCosts.costToMove(currentTick, targetTick, b());
        }
    }

    // ============ Merge Function (Pre-Settlement Exit) ============

    /// @notice Merge YES + NO tokens to unlock collateral
    /// @dev Burns 1 YES + 1 NO per unit, credits $1 worth of collateral (locked)
    /// @param amount Number of complete sets to merge
    function merge(uint256 amount) external onlyLive {
        require(amount > 0, "Market: zero amount");
        require(balanceOf(msg.sender, YES_TOKEN_ID) >= amount, "Market: insufficient YES");
        require(balanceOf(msg.sender, NO_TOKEN_ID) >= amount, "Market: insufficient NO");

        // Burn both tokens
        _burn(msg.sender, YES_TOKEN_ID, amount);
        _burn(msg.sender, NO_TOKEN_ID, amount);

        // Amount in collateral = amount * 1e18 (1 complete set = $1)
        // This is a capital exit, so proceeds are locked
        // Call TraderVault to credit locked proceeds
        ISoothTraderVault(traderVault).creditMergeProceeds(msg.sender, amount);

        emit Merged(msg.sender, amount);
    }

    // ============ View Functions ============

    function orders(uint256 orderId) external view returns (OrderV3 memory) {
        return _orders[orderId];
    }

    function bestOrder(uint256 outcome) external view returns (uint256) {
        if (outcome == 0) {
            return bestAsk;
        } else {
            return bestBid;
        }
    }

    // Note: yesBalance and noBalance replaced by ERC1155 balanceOf
    // Wrappers for ISoothMarket compatibility
    function yesBalance(address user) external view override returns (uint256) {
        return balanceOf(user, YES_TOKEN_ID);
    }

    function noBalance(address user) external view override returns (uint256) {
        return balanceOf(user, NO_TOKEN_ID);
    }

    /// @notice Transfer shares wrapper for TraderVault
    function transferShares(
        address from,
        address to,
        uint8 outcome,
        uint256 amount
    ) external override onlyTraderVault {
        require(outcome < 2, "Market: invalid outcome");
        uint256 id = outcome == 0 ? YES_TOKEN_ID : NO_TOKEN_ID;
        _safeTransferFrom(from, to, id, amount, "");
    }

    // ============ Orderbook Functions ============
    // (Simplified - full implementation would include matching logic)

    function createOrder(
        address maker,
        uint8 outcome,
        uint256 price,
        uint256 amount
    ) external onlyTraderVault onlyLive returns (uint256 orderId) {
        require(price > 0 && price < 1e18, "Market: invalid price");
        require(amount > 0, "Market: invalid amount");

        orderId = nextOrderId++;

        uint256 yesPrice;
        bool isBuySide;
        if (outcome == 0) {
            yesPrice = price;
            isBuySide = true;
        } else {
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

        if (isBuySide) {
            _insertBid(orderId, yesPrice);
        } else {
            _insertAsk(orderId, yesPrice);
        }

        emit OrderCreated(orderId, maker, outcome, price, amount);

        _tryMatch(orderId);
    }

    function cancelOrder(
        uint256 orderId,
        address maker
    ) external onlyTraderVault returns (uint256 refund) {
        OrderV3 storage o = _orders[orderId];
        require(o.maker == maker, "Market: not maker");
        require(o.amount > 0, "Market: already filled");

        uint256 price = o.isBuySide ? o.yesPrice : (1e18 - o.yesPrice);
        refund = price * o.amount / 1e18;

        if (o.isBuySide) {
            _removeBid(orderId);
        } else {
            _removeAsk(orderId);
        }

        delete _orders[orderId];
        emit OrderCancelled(orderId);
    }

    // ============ Internal Orderbook Matching ============

    function _tryMatch(uint256 newOrderId) internal {
        OrderV3 storage newOrder = _orders[newOrderId];
        if (newOrder.amount == 0) return;

        if (newOrder.isBuySide) {
            _matchBuyOrder(newOrderId);
        } else {
            _matchSellOrder(newOrderId);
        }
    }

    function _matchBuyOrder(uint256 buyOrderId) internal {
        OrderV3 storage buyOrder = _orders[buyOrderId];
        
        while (buyOrder.amount > 0 && bestAsk != 0) {
            OrderV3 storage askOrder = _orders[bestAsk];
            
            if (buyOrder.yesPrice < askOrder.yesPrice) {
                break;
            }

            uint256 matchPrice = askOrder.yesPrice;
            uint256 matchAmount = _min(buyOrder.amount, askOrder.amount);

            // Mint tokens via complete set creation
            _mint(buyOrder.maker, YES_TOKEN_ID, matchAmount, "");
            _mint(askOrder.maker, NO_TOKEN_ID, matchAmount, "");

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
        OrderV3 storage sellOrder = _orders[sellOrderId];
        
        while (sellOrder.amount > 0 && bestBid != 0) {
            OrderV3 storage bidOrder = _orders[bestBid];
            
            if (sellOrder.yesPrice > bidOrder.yesPrice) {
                break;
            }

            uint256 matchPrice = bidOrder.yesPrice;
            uint256 matchAmount = _min(sellOrder.amount, bidOrder.amount);

            _mint(bidOrder.maker, YES_TOKEN_ID, matchAmount, "");
            _mint(sellOrder.maker, NO_TOKEN_ID, matchAmount, "");

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

    function increaseBBase(uint256 amount) external onlyGovernor {
        bBase += amount;
        emit BBaseIncrease(amount, bBase);
    }

    function setGovernor(address _governor) external onlyGovernor {
        governor = _governor;
    }

    // ============ ERC1155 Metadata ============

    function uri(uint256 tokenId) public view virtual override returns (string memory) {
        if (tokenId == YES_TOKEN_ID) {
            return "ipfs://sooth/market/yes";
        } else if (tokenId == NO_TOKEN_ID) {
            return "ipfs://sooth/market/no";
        }
        return "";
    }
}
