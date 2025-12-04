// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./SoothInterfaces.sol";

/// @notice Infinite-end YES/NO market using a pluggable AMM and dynamic b.
/// @dev AMM is pluggable; default is SoothLMSRReal. You can swap in alternatives
///      without changing this contract.
contract SoothMarket is Ownable {
    ISoothVault public vault;
    IRiskManager public riskManager;
    ISoothAMM public amm;

    uint256 public marketId;
    bytes32 public adjudicatorId;

    bool public isLive;
    bool public isSettled;

    uint8 public winningOutcome;
    uint64 public truthTime; // T*

    ISoothAMM.State public ammState; // qYes, qNo

    mapping(address => uint256) public yesBalance;
    mapping(address => uint256) public noBalance;

    // --- Orderbook State ---
    mapping(uint256 => Order) public orders;
    mapping(uint256 => uint256) public nextOrder; // Linked list: orderId -> nextOrderId
    mapping(uint8 => uint256) public bestOrder;   // Linked list head: outcome -> orderId
    uint256 public nextOrderId = 1;

    event OrderPlaced(uint256 indexed orderId, address indexed maker, uint8 outcome, uint256 price, uint256 amount);
    event OrderCancelled(uint256 indexed orderId);
    event OrderFilled(uint256 indexed orderId, uint256 amount);

    event Initialized(
        uint256 indexed marketId,
        address vault,
        address riskManager,
        address amm,
        bytes32 adjudicatorId
    );
    event Trade(address indexed trader, uint8 outcomeIndex, int256 deltaShares, int256 cost);
    event Settled(uint8 winningOutcome, uint64 truthTime);

    constructor() {}

    function initialize(
        uint256 _marketId,
        ISoothVault _vault,
        IRiskManager _riskManager,
        ISoothAMM _amm,
        bytes32 _adjudicatorId,
        int256 _initialQuantity
    ) external onlyOwner {
        require(address(vault) == address(0), "Market: already init");
        require(_initialQuantity > 0, "Market: invalid initial quantity");
        
        vault = _vault;
        riskManager = _riskManager;
        amm = _amm;
        adjudicatorId = _adjudicatorId;
        marketId = _marketId;
        isLive = true;
        
        // Initialize with balanced quantities for 50/50 starting price
        // This prevents LMSR pricing breakdown at (0,0)
        ammState = ISoothAMM.State({
            qYes: _initialQuantity,
            qNo: _initialQuantity
        });

        emit Initialized(_marketId, address(_vault), address(_riskManager), address(_amm), _adjudicatorId);
    }

    modifier onlyLive() {
        require(isLive && !isSettled, "Market: not live");
        _;
    }

    /// @notice outcomeIndex: 0 = YES, 1 = NO
    /// @param deltaShares > 0 to buy, < 0 to sell.
    /// @param maxCost Maximum cost willing to pay (buy) or minimum proceeds to receive (sell).
    ///                For buys: positive value representing max tokens to spend.
    ///                For sells: negative value representing min tokens to receive.
    function trade(uint8 outcomeIndex, int256 deltaShares, int256 maxCost) external onlyLive {
        require(deltaShares != 0, "Market: zero trade");

        // spot-style restriction: no synthetic shorts – must own before selling
        if (deltaShares < 0) {
            uint256 shares = uint256(-deltaShares);
            if (outcomeIndex == 0) {
                require(yesBalance[msg.sender] >= shares, "Market: not enough YES");
                yesBalance[msg.sender] -= shares;
            } else {
                require(noBalance[msg.sender] >= shares, "Market: not enough NO");
                noBalance[msg.sender] -= shares;
            }
        }

        uint256 b = riskManager.getBForMarket(marketId);
        int256 totalCost = 0;
        int256 remainingShares = deltaShares;

        // --- Unified Ladder Execution ---
        
        // Determine which orderbook side to match against
        // If Buying X (delta > 0): Match against Short X (outcomeIndex)
        // If Selling X (delta < 0): Match against Short Y (1 - outcomeIndex)
        uint8 matchOutcome = (deltaShares > 0) ? outcomeIndex : (1 - outcomeIndex);
        
        // Match against Orderbook
        // We match if Order Price is better than AMM Price.
        // For simplicity in this iteration: We greedily fill Orderbook if Price <= AMM Price.
        // Note: AMM price moves, so strictly we should interleave. 
        // Here we check spot price.
        
        while (remainingShares != 0) {
            uint256 bestId = bestOrder[matchOutcome];
            
            // If no orders, break to AMM
            if (bestId == 0) break;

            Order storage o = orders[bestId];
            uint256 ammPrice = amm.price(ammState, matchOutcome, b);
            
            // Check if Order is better or equal to AMM
            // Order Price is for Shorting `matchOutcome`.
            // If we are Buying `matchOutcome` (delta > 0), we pay `o.price`. Lower is better.
            // If we are Selling `matchOutcome` (delta < 0), we are effectively Buying `1-matchOutcome`.
            // Wait, logic check:
            // If delta > 0 (Buy YES): Match Short YES. Pay `o.price`. Compare `o.price` vs `ammPrice`.
            // If `o.price <= ammPrice`, take Order.
            
            // If delta < 0 (Sell YES): Match Short NO.
            // We are effectively Buying NO? No, we are Selling YES.
            // Selling YES is economically equivalent to Buying NO (ignoring fees/slippage).
            // But here we match against Short NO.
            // Short NO price is `P_no`.
            // Implied YES price is `1 - P_no`.
            // We receive `1 - P_no`.
            // AMM YES Price is `P_yes_amm`.
            // We want to sell at Highest Price.
            // `1 - P_no >= P_yes_amm`  =>  `1 - P_yes_amm >= P_no`  =>  `P_no_amm >= P_no`.
            // So if `o.price (P_no) <= ammPrice (P_no_amm)`, take Order.
            // Logic holds: Always check `o.price <= amm.price(matchOutcome)`.
            
            if (o.price > ammPrice) {
                break; // AMM is better
            }

            // Fill Order
            uint256 amount = (deltaShares > 0) ? uint256(remainingShares) : uint256(-remainingShares);
            uint256 fill = (amount < o.amount) ? amount : o.amount;
            
            // Calculate Cost/Proceeds
            // If Buy (delta > 0): Cost = fill * price
            // If Sell (delta < 0): Proceeds = fill * (1 - price) => Cost = -Proceeds
            int256 stepCost;
            if (deltaShares > 0) {
                stepCost = int256(fill * o.price / 1e18);
            } else {
                // Selling YES matches Short NO (price P_no).
                // Receive (1 - P_no).
                stepCost = -int256(fill * (1e18 - o.price) / 1e18);
            }
            
            totalCost += stepCost;
            
            // Update Order
            o.amount -= fill;
            if (o.amount == 0) {
                _removeOrder(matchOutcome, bestId);
                delete orders[bestId];
                emit OrderFilled(bestId, fill);
            } else {
                emit OrderFilled(bestId, fill);
            }
            
            // Update Remaining
            if (deltaShares > 0) {
                remainingShares -= int256(fill);
            } else {
                remainingShares += int256(fill);
            }
        }

        // Fill remainder with AMM
        if (remainingShares != 0) {
            (int256 ammCost, ISoothAMM.State memory newState) =
                amm.costDelta(ammState, outcomeIndex, remainingShares, b);
            
            totalCost += ammCost;
            ammState = newState;
        }

        // Slippage protection
        require(totalCost <= maxCost, "Market: slippage exceeded");

        // Record Flow
        vault.recordMarketFlow(marketId, totalCost, msg.sender);

        if (deltaShares > 0) {
            uint256 shares = uint256(deltaShares);
            if (outcomeIndex == 0) {
                yesBalance[msg.sender] += shares;
            } else {
                noBalance[msg.sender] += shares;
            }
        }

        emit Trade(msg.sender, outcomeIndex, deltaShares, totalCost);
    }

    function markSettled(uint8 _winningOutcome, uint64 _truthTime) external onlyOwner {
        require(!isSettled, "Market: already settled");
        isSettled = true;
        isLive = false;
        winningOutcome = _winningOutcome;
        truthTime = _truthTime;
        emit Settled(_winningOutcome, _truthTime);
    }

    // --- Orderbook Functions ---

    /// @notice Place a limit order to SELL an outcome (Short position).
    /// @param outcome 0 for YES, 1 for NO.
    /// @param price Price per share (1e18).
    /// @param amount Number of shares.
    function placeOrder(uint8 outcome, uint256 price, uint256 amount) external onlyLive returns (uint256) {
        require(price > 0 && price < 1e18, "Market: invalid price");
        require(amount > 0, "Market: invalid amount");

        // Lock collateral: (1 - price) * amount
        // Maker pays this to the Vault.
        uint256 collateral = (1e18 - price) * amount / 1e18;
        vault.recordMarketFlow(marketId, int256(collateral), msg.sender);

        uint256 id = nextOrderId++;
        orders[id] = Order({
            id: id,
            maker: msg.sender,
            outcome: outcome,
            price: price,
            amount: amount,
            timestamp: block.timestamp
        });

        _insertOrder(outcome, id, price);
        emit OrderPlaced(id, msg.sender, outcome, price, amount);
        return id;
    }

    function cancelOrder(uint256 orderId) external onlyLive {
        Order storage o = orders[orderId];
        require(o.maker == msg.sender, "Market: not maker");
        require(o.amount > 0, "Market: already filled/cancelled");

        // Refund collateral
        uint256 collateral = (1e18 - o.price) * o.amount / 1e18;
        vault.recordMarketFlow(marketId, -int256(collateral), msg.sender);

        _removeOrder(o.outcome, orderId);
        delete orders[orderId];
        emit OrderCancelled(orderId);
    }

    // --- Internal Linked List Helpers ---

    function _insertOrder(uint8 outcome, uint256 id, uint256 price) internal {
        uint256 prev = 0;
        uint256 curr = bestOrder[outcome];

        // Sort by Price ASC (Cheapest first).
        // If equal price, FIFO (older timestamp is better, but here we just append to end of price tier? 
        // Simple logic: if price < curr.price, insert before.
        while (curr != 0) {
            if (price < orders[curr].price) {
                break;
            }
            prev = curr;
            curr = nextOrder[curr];
        }

        if (prev == 0) {
            nextOrder[id] = bestOrder[outcome];
            bestOrder[outcome] = id;
        } else {
            nextOrder[id] = nextOrder[prev];
            nextOrder[prev] = id;
        }
    }

    function _removeOrder(uint8 outcome, uint256 id) internal {
        uint256 prev = 0;
        uint256 curr = bestOrder[outcome];

        while (curr != 0) {
            if (curr == id) {
                if (prev == 0) {
                    bestOrder[outcome] = nextOrder[curr];
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
}
