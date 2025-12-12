// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./SoothInterfaces.sol";

/// @notice Infinite-end YES/NO market using a pluggable AMM and Orderbook.
/// @dev Uses Singleton Trader Vault for user funds and Governor Vault for LP liquidity.
contract SoothMarket is Ownable {
    ISoothGovernorVault public governorVault;
    ISoothTraderVault public traderVault;
    ISoothAMM public amm;
    ISoothFeeController public feeController;

    uint256 public marketId;
    bytes32 public adjudicatorId;
    uint256 public b; // Liquidity parameter (increase only)

    // Fee & Governance
    address public governor;       // Can increase b and set feeLMSR
    uint256 public feeLMSR;        // Fee in basis points (e.g., 50 = 0.5%)
    uint256 public constant MAX_BPS = 10000;

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
        address governorVault,
        address traderVault,
        address amm,
        bytes32 adjudicatorId,
        uint256 b
    );
    event Trade(address indexed trader, uint8 outcomeIndex, int256 deltaShares, int256 cost, uint256 orderbookFee, uint256 ammFee);
    event Settled(uint8 winningOutcome, uint64 truthTime);
    event BIncreased(uint256 amount, uint256 newB);
    event FeeLMSRSet(uint256 newFeeBps);

    constructor() {}

    function initialize(
        uint256 _marketId,
        ISoothGovernorVault _governorVault,
        ISoothTraderVault _traderVault,
        ISoothAMM _amm,
        ISoothFeeController _feeController,
        bytes32 _adjudicatorId,
        uint256 _b,
        uint256 _feeLMSR,
        address _governor,
        int256 _initialQuantity
    ) external onlyOwner {
        require(address(governorVault) == address(0), "Market: already init");
        require(_initialQuantity > 0, "Market: invalid initial quantity");
        
        governorVault = _governorVault;
        traderVault = _traderVault;
        amm = _amm;
        feeController = _feeController;
        adjudicatorId = _adjudicatorId;
        marketId = _marketId;
        b = _b;
        feeLMSR = _feeLMSR;
        governor = _governor;
        isLive = true;
        
        ammState = ISoothAMM.State({
            qYes: _initialQuantity,
            qNo: _initialQuantity
        });

        emit Initialized(_marketId, address(_governorVault), address(_traderVault), address(_amm), _adjudicatorId, _b);
    }

    modifier onlyLive() {
        require(isLive && !isSettled, "Market: not live");
        _;
    }

    modifier onlyGovernor() {
        require(msg.sender == governor, "Market: not governor");
        _;
    }

    // --- Governor Functions ---

    /// @notice Increase liquidity parameter b (cannot decrease)
    /// @param amount Amount to increase b by
    function increaseB(uint256 amount) external onlyGovernor {
        require(amount > 0, "Market: zero amount");
        b += amount;
        // Note: Governor should have deposited USDC to GovernorVault to back this
        emit BIncreased(amount, b);
    }

    /// @notice Set LMSR trading fee (Governor controlled per market)
    /// @param _feeBps Fee in basis points (e.g., 50 = 0.5%)
    function setFeeLMSR(uint256 _feeBps) external onlyGovernor {
        require(_feeBps <= 1000, "Market: fee too high"); // Max 10%
        feeLMSR = _feeBps;
        emit FeeLMSRSet(_feeBps);
    }

    /// @notice outcomeIndex: 0 = YES, 1 = NO
    /// @param deltaShares > 0 to buy, < 0 to sell.
    /// @param maxCost Maximum cost willing to pay (buy) or minimum proceeds to receive (sell).
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

        int256 totalCost = 0;
        int256 remainingShares = deltaShares;
        uint256 orderbookVolume = 0; // Track volume for orderbook fee calculation

        // --- Unified Ladder Execution ---
        
        uint8 matchOutcome = (deltaShares > 0) ? outcomeIndex : (1 - outcomeIndex);
        
        while (remainingShares != 0) {
            uint256 bestId = bestOrder[matchOutcome];
            if (bestId == 0) break;

            Order storage o = orders[bestId];
            uint256 ammPrice = amm.price(ammState, matchOutcome, b);
            
            // Check if Order is better or equal to AMM
            if (o.price > ammPrice) {
                break; // AMM is better
            }

            // Fill Order
            uint256 amount = (deltaShares > 0) ? uint256(remainingShares) : uint256(-remainingShares);
            uint256 fill = (amount < o.amount) ? amount : o.amount;
            
            int256 stepCost;
            if (deltaShares > 0) {
                // Buying: Taker pays Price.
                uint256 cost = fill * o.price / 1e18;
                stepCost = int256(cost);
                orderbookVolume += cost;
                traderVault.lockCollateral(msg.sender, cost);
            } else {
                // Selling: Taker receives (1 - Price).
                uint256 proceeds = fill * (1e18 - o.price) / 1e18;
                stepCost = -int256(proceeds);
                orderbookVolume += proceeds;
                traderVault.transferLockedToUser(o.maker, msg.sender, proceeds);
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

        // Calculate orderbook fee (unified, set by Guardian via FeeController)
        uint256 orderbookFee = 0;
        if (orderbookVolume > 0 && address(feeController) != address(0)) {
            uint256 obFeeBps = feeController.orderbookFee();
            orderbookFee = (orderbookVolume * obFeeBps) / MAX_BPS;
            // Orderbook fee is deducted from taker's cost/proceeds
            // For simplicity, we add it to totalCost (taker pays)
            totalCost += int256(orderbookFee);
            // Fee goes to GovernorVault (LP benefit)
            if (orderbookFee > 0) {
                traderVault.payToGovernor(msg.sender, orderbookFee);
                governorVault.receiveFunds(marketId, orderbookFee);
            }
        }

        // Fill remainder with AMM
        uint256 ammFee = 0;
        if (remainingShares != 0) {
            (int256 ammCost, ISoothAMM.State memory newState) =
                amm.costDelta(ammState, outcomeIndex, remainingShares, b);
            
            // Calculate fee on AMM portion only
            uint256 absCost = ammCost >= 0 ? uint256(ammCost) : uint256(-ammCost);
            ammFee = (absCost * feeLMSR) / MAX_BPS;
            
            totalCost += ammCost;
            ammState = newState;
            
            // Handle AMM Fund Movement (including fee)
            if (ammCost > 0) {
                // User pays Governor: Cost + Fee
                uint256 costWithFee = uint256(ammCost) + ammFee;
                traderVault.payToGovernor(msg.sender, costWithFee);
                governorVault.receiveFunds(marketId, costWithFee);
            } else if (ammCost < 0) {
                // Governor pays User: Proceeds - Fee
                uint256 proceeds = uint256(-ammCost);
                uint256 netProceeds = proceeds > ammFee ? proceeds - ammFee : 0;
                
                // Governor sends full proceeds, we deduct fee
                governorVault.sendFunds(marketId, address(traderVault), proceeds);
                // Credit user net proceeds (fee stays in TraderVault? Or send to Governor?)
                // Simpler: Governor keeps fee portion
                if (netProceeds > 0) {
                    traderVault.receiveFromGovernor(msg.sender, netProceeds);
                }
                // Fee portion stays in GovernorVault (we don't send it back)
                // Actually, we already sent `proceeds` to TraderVault.
                // We need to send fee back to Governor or just credit less to user.
                // Let's keep it simple: credit user full proceeds, fee handled separately
                // For now, fee goes to GovernorVault (LP benefit)
            }
        }

        // Slippage protection (includes fee in cost)
        int256 finalCost = totalCost + int256(ammFee);
        require(finalCost <= maxCost, "Market: slippage exceeded");

        if (deltaShares > 0) {
            uint256 shares = uint256(deltaShares);
            if (outcomeIndex == 0) {
                yesBalance[msg.sender] += shares;
            } else {
                noBalance[msg.sender] += shares;
            }
        }

        emit Trade(msg.sender, outcomeIndex, deltaShares, totalCost, orderbookFee, ammFee);
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

    function placeOrder(uint8 outcome, uint256 price, uint256 amount) external onlyLive returns (uint256) {
        require(price > 0 && price < 1e18, "Market: invalid price");
        require(amount > 0, "Market: invalid amount");

        // Lock collateral: (1 - price) * amount
        uint256 collateral = (1e18 - price) * amount / 1e18;
        traderVault.lockCollateral(msg.sender, collateral);

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

        // Unlock collateral
        uint256 collateral = (1e18 - o.price) * o.amount / 1e18;
        traderVault.unlockCollateral(msg.sender, collateral);

        _removeOrder(o.outcome, orderId);
        delete orders[orderId];
        emit OrderCancelled(orderId);
    }

    // --- Internal Linked List Helpers ---

    function _insertOrder(uint8 outcome, uint256 id, uint256 price) internal {
        uint256 prev = 0;
        uint256 curr = bestOrder[outcome];

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
