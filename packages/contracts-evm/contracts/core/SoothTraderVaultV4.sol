// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../core/SoothInterfaces.sol";
import "../interfaces/ISoothMarketV4.sol";
import "../interfaces/ISoothTraderVaultV4.sol";
import "../interfaces/IOutcomeToken.sol";
import "../interfaces/IYieldStrategy.sol";
import "../interfaces/ITimeLock.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title SoothTraderVaultV4
/// @notice V4: Dual-venue trading with Lock-on-Buy policy
/// @dev AMM trades are internal positions (locked on buy). Orderbook uses ERC1155.
contract SoothTraderVaultV4 is ISoothTraderVaultV4, Ownable {
    using SafeERC20 for IERC20;

    // ============ Constants ============
    
    uint256 public constant LOCK_DURATION = 24 hours;
    uint256 public constant MAX_BPS = 10000;

    // ============ State ============
    
    IERC20 private immutable _asset;
    uint256 public immutable scalar; // Scale factor from Asset to WAD

    struct UserAccount {
        uint256 available;  // Can trade or withdraw
        uint256 pending;    // Locked USDC (legacy, not used in V4 AMM)
    }

    /// @notice V4: Internal AMM positions (not ERC1155)
    struct AMMPosition {
        uint256 yesShares;
        uint256 noShares;
        uint256 unlockTime;  // When shares become sellable
    }

    mapping(address => UserAccount) public accounts;
    mapping(address => mapping(address => AMMPosition)) public ammPositions;
    // ammPositions[user][market] = position
    
    mapping(address => bool) private _isMarket;

    ISoothGovernorVault public governorVault;
    IYieldStrategy public yieldStrategy;
    ITimeLock public timeLock;

    // ============ Events ============
    
    // Events inherited from ISoothTraderVaultV4

    // ============ Constructor ============
    
    constructor(
        IERC20 asset_,
        ISoothGovernorVault governorVault_
    ) {
        require(address(asset_) != address(0), "TraderVault: zero asset");
        require(address(governorVault_) != address(0), "TraderVault: zero governor");
        
        _asset = asset_;
        governorVault = governorVault_;
        
        uint8 decimals = 18;
        try IERC20Metadata(address(asset_)).decimals() returns (uint8 d) {
            decimals = d;
        } catch {}
        
        if (decimals <= 18) {
            scalar = 10**(18 - decimals);
        } else {
            scalar = 1;
        }
    }

    // ============ Modifiers ============
    
    modifier onlyMarket() {
        require(_isMarket[msg.sender], "TraderVault: not market");
        _;
    }

    modifier onlyMarketOrOwner(address market) {
        require(msg.sender == market || msg.sender == owner, "TraderVault: denied");
        _;
    }

    // ============ User Actions ============
    
    function deposit(uint256 amount) external {
        require(amount > 0, "TraderVault: zero amount");
        require(_asset.transferFrom(msg.sender, address(this), amount), "TraderVault: transfer failed");
        
        accounts[msg.sender].available += amount;
        emit Deposit(msg.sender, amount);
    }

    function withdraw(uint256 amount) external {
        require(amount > 0, "TraderVault: zero amount");
        require(accounts[msg.sender].available >= amount, "TraderVault: insufficient available");

        accounts[msg.sender].available -= amount;
        require(_asset.transfer(msg.sender, amount), "TraderVault: transfer failed");
        emit Withdraw(msg.sender, amount);
    }

    function claimUnlocked() external returns (uint256 amount) {
        // V4: No TimeLock for AMM (lock is on shares, not USDC)
        // This function can be used for legacy orderbook locks if needed
        amount = accounts[msg.sender].pending;
        if (amount > 0) {
            accounts[msg.sender].pending = 0;
            accounts[msg.sender].available += amount;
            emit ProceedsClaimed(msg.sender, amount);
        }
    }

    // ============ AMM Trading (V4: Lock on Buy) ============
    
    /// @notice Trade with AMM - BUY locks shares, SELL is free after unlock
    function tradeAMM(
        address market,
        uint8 outcome,
        int256 deltaShares,
        int256 maxCost
    ) external {
        require(_isMarket[market], "TraderVault: invalid market");
        require(deltaShares != 0, "TraderVault: zero shares");
        require(outcome < 2, "TraderVault: invalid outcome");

        ISoothMarketV4 mkt = ISoothMarketV4(market);
        AMMPosition storage pos = ammPositions[msg.sender][market];

        if (deltaShares > 0) {
            // ========== BUY: Lock shares for 24h ==========
            uint256 shares = uint256(deltaShares);
            
            // Execute trade on market (returns cost in WAD)
            (int256 rawCost, uint256 rawFee) = mkt.executeAMMTrade(msg.sender, outcome, deltaShares);
            
            // For BUYs, cost should always be positive
            // When buying NO, tick moves down and costToMove returns negative,
            // but user still pays. Take absolute value.
            uint256 absCost = rawCost >= 0 ? uint256(rawCost) : uint256(-rawCost);
            
            // Scale to asset decimals
            uint256 assetCost = (absCost + scalar - 1) / scalar;
            uint256 assetFee = (rawFee + scalar - 1) / scalar;
            uint256 totalCost = assetCost + assetFee;
            
            require(int256(totalCost) <= maxCost, "TraderVault: slippage exceeded");
            require(accounts[msg.sender].available >= totalCost, "TraderVault: insufficient balance");
            
            // Debit user
            accounts[msg.sender].available -= totalCost;
            
            // Pay to governor vault
            require(_asset.transfer(address(governorVault), totalCost), "TraderVault: transfer failed");
            governorVault.receiveFunds(mkt.marketId(), totalCost);
            
            // Credit internal shares (locked until unlockTime)
            if (outcome == 0) {
                pos.yesShares += shares;
            } else {
                pos.noShares += shares;
            }
            pos.unlockTime = block.timestamp + LOCK_DURATION;
            
            emit AMMBuy(msg.sender, market, outcome, shares, totalCost, pos.unlockTime);
            emit TradeExecuted(msg.sender, market, outcome, deltaShares, rawCost);
            
        } else {
            // ========== SELL: Requires unlocked shares ==========
            uint256 shares = uint256(-deltaShares);
            
            // Check shares are unlocked
            require(block.timestamp >= pos.unlockTime, "TraderVault: shares locked");
            
            // Check sufficient shares
            if (outcome == 0) {
                require(pos.yesShares >= shares, "TraderVault: insufficient YES shares");
            } else {
                require(pos.noShares >= shares, "TraderVault: insufficient NO shares");
            }
            
            // Execute trade on market (returns negative cost = proceeds)
            (int256 rawCost, uint256 rawFee) = mkt.executeAMMTrade(msg.sender, outcome, deltaShares);
            require(rawCost < 0, "TraderVault: unexpected positive cost");
            
            // Scale to asset decimals
            uint256 assetGross = uint256(-rawCost) / scalar;
            uint256 assetFee = (rawFee + scalar - 1) / scalar;
            uint256 netProceeds = assetGross > assetFee ? assetGross - assetFee : 0;
            
            // Slippage check
            if (maxCost != type(int256).min) {
                require(int256(netProceeds) >= -maxCost, "TraderVault: slippage exceeded");
            }
            
            // Debit internal shares
            if (outcome == 0) {
                pos.yesShares -= shares;
            } else {
                pos.noShares -= shares;
            }
            
            // Receive from governor vault
            governorVault.sendFunds(mkt.marketId(), address(this), netProceeds);
            
            // Credit user IMMEDIATELY (no lock on sell in V4)
            accounts[msg.sender].available += netProceeds;
            
            emit AMMSell(msg.sender, market, outcome, shares, netProceeds);
            emit TradeExecuted(msg.sender, market, outcome, deltaShares, rawCost);
        }
    }

    // ============ Orderbook Trading (uses OutcomeToken ERC1155) ============
    
    // ============ Spot Order Tracking ============
    
    struct SpotOrder {
        address user;
        address market;
        uint8 outcome; // The outcome being SOLD (Locked)
        uint256 amount;
    }
    
    mapping(uint256 => SpotOrder) public spotOrders; // orderId => SpotOrder

    function placeOrder(
        address market,
        uint8 outcome,
        uint256 price,
        uint256 amount,
        bool isBuy
    ) external override returns (uint256 orderId) {
        require(_isMarket[market], "TraderVault: invalid market");
        require(price > 0 && price < 1e18, "TraderVault: invalid price");
        require(amount > 0, "TraderVault: invalid amount");

        // Calculate cost based on direction
        uint256 rawCost;
        uint256 targetPrice;
        uint8 targetOutcome;
        
        if (isBuy) {
            // Normal Buy
            rawCost = (price * amount) / 1e18;
            targetPrice = price;
            targetOutcome = outcome;
        } else {
            // Short Sell = Buy Opposite
            rawCost = ((1e18 - price) * amount) / 1e18;
            targetPrice = 1e18 - price;
            targetOutcome = outcome == 0 ? 1 : 0;
        }

        uint256 cost = rawCost / scalar;

        require(accounts[msg.sender].available >= cost, "TraderVault: insufficient balance");
        accounts[msg.sender].available -= cost;

        // Create order on market (Sender is User)
        uint256 matchedAmount;
        uint256 matchedValue;
        (orderId, matchedAmount, matchedValue) = ISoothMarketV4(market).createOrder(msg.sender, targetOutcome, targetPrice, amount);

        // Refund Logic
        if (matchedAmount > 0) {
            uint256 refund;
            if (isBuy) {
                // Buy YES: Refund = (LimitPrice * Matched) - ActualValue
                // targetPrice = LimitPrice
                // ActualValue = matchedValue (in terms of YES)
                refund = (targetPrice * matchedAmount) - matchedValue;
            } else {
                // Short Sell (Buy NO): 
                // matchedValue = Sum(ExecPrice * Amt). ExecPrice is YES price.
                // We paid Collateral = (1 - LimitYES) * Matched.
                // We effectively "Sold" at ExecPrice (Received YES price credit vs 1).
                // Or: We bought NO at (1 - ExecPrice).
                // Cost Actual = (1 - ExecPrice) * Amt = Amt - ExecCost.
                // Refund = Cost Limit - Cost Actual
                //        = [(1 - LimitYES) * Amt] - [Amt - ExecVal]
                //        = ExecVal - (LimitYES * Amt)
                // Note: matchedValue = ExecVal
                // targetPrice = 1 - LimitYES. (Wait, targetPrice passed to market IS LimitYES if outcome switched?)
                // NO. Market logic: if outcome switched, we passed `1e18 - price`.
                // In Market `createOrder`: if outcome=1, `yesPrice = 1e18 - (1e18 - price) = price`.
                // So Market Order is actually for YES at `price`?
                // Let's re-read Market.createOrder logic.
                
                // Market.createOrder(targetOutcome=1, targetPrice=1-P):
                // if outcome==1: yesPrice = 1e18 - targetPrice = 1e18 - (1e18 - P) = P.
                // isBuySide = false.
                // So it creates an ASK for YES at P. Correct.
                
                // Matched Value = Sum(MatchPrice * Amount). MatchPrice >= P.
                // Refund = matchedValue - (price * matchedAmount).
                // Example: Limit Sell YES at 0.60. P=0.60.
                // Matches Bid at 0.65. matchedValue = 0.65.
                // Refund = 0.65 - 0.60 = 0.05. CORRECT.
                
                refund = matchedValue - (price * matchedAmount);
            }
            
            // Allow for tiny precision errors or zero refund
            if (refund > 0) {
                uint256 scaledRefund = refund / scalar;
                accounts[msg.sender].available += scaledRefund;
                // Reuse OrderCancelled event with orderId? Or just silent credit?
                // OrderCancelled is for full/partial cancels.
                // For now, silent credit or maybe emit MergeCredit?
                emit MergeCredit(msg.sender, scaledRefund); // Reusing event for "System Credit"
            }
        }

        emit OrderPlaced(msg.sender, market, orderId, outcome, price, amount);
    }
    
    function placeSpotOrder(
        address market,
        uint8 outcome,
        uint256 price,
        uint256 amount
    ) external override returns (uint256 orderId) {
        require(_isMarket[market], "TraderVault: invalid market");
        require(price > 0 && price < 1e18, "TraderVault: invalid price");
        require(amount > 0, "TraderVault: invalid amount");
        
        // Lock Shares
        IOutcomeToken token = ISoothMarketV4(market).outcomeToken();
        token.safeTransferFrom(msg.sender, address(this), outcome, amount, "");
        
        // Target: Buy Opposite (to close)
        uint256 targetPrice = 1e18 - price;
        uint8 targetOutcome = outcome == 0 ? 1 : 0;
        
        // CRITICAL FIX: Predict OrderId and set mapping BEFORE calling createOrder
        // This is necessary because createOrder calls onOrderMatched synchronously
        orderId = ISoothMarketV4(market).nextOrderId();
        
        spotOrders[orderId] = SpotOrder({
            user: msg.sender,
            market: market,
            outcome: outcome,
            amount: amount
        });
        
        // Place Order
        (uint256 actualId, , ) = ISoothMarketV4(market).createOrder(address(this), targetOutcome, targetPrice, amount);
        require(actualId == orderId, "TraderVault: orderId mismatch");
        
        emit OrderPlaced(msg.sender, market, orderId, outcome, price, amount);
    }
    
    function onOrderMatched(uint256 orderId, uint256 matchedAmount) external override onlyMarket {
        SpotOrder storage info = spotOrders[orderId];
        
        // Only process known Spot Orders
        if (info.user != address(0)) {
            require(info.amount >= matchedAmount, "TraderVault: overmatch");
            info.amount -= matchedAmount;
            
            if (info.amount == 0) {
                delete spotOrders[orderId];
            }
            
            // Merge shares -> USDC
            // This burns the shares.
            uint256 proceeds = ISoothMarketV4(msg.sender).merge(matchedAmount);
            
            // CRITICAL FIX: Pull backing capital from GovernorVault
            // The shares burned were backed by collateral in GovernorVault.
            // We must move that collateral to TraderVault to pay the user.
            governorVault.sendFunds(ISoothMarketV4(msg.sender).marketId(), address(this), proceeds);
            
            uint256 scaledProceeds = proceeds / scalar;
            
            // Credit Original User
            accounts[info.user].available += scaledProceeds;
            
            emit MergeCredit(info.user, scaledProceeds);
        }
    }
    
    function cancelOrder(address market, uint256 orderId) external onlyMarketOrOwner(market) {
        // ... (Not called by User directly? User calls cancelOrder on Market usually?)
        // Wait, Market calls this? No, ISoothTraderVault interface says cancelOrder...
        // But implementation in V4 Market calls `cancelOrder` on Market?
        // Ah, `SoothTraderVault.cancelOrder` is a proxy for User interacting with Vault?
        // But the previous code had `onlyMarketOrOwner`. That's suspicious.
        
        // Let's look at `cancelOrder` spec.
        // Usually User calls `market.cancelOrder`.
        // If Maker is Vault (Spot Order), User cannot call `market.cancelOrder` (msg.sender != maker).
        // So User MUST call `vault.cancelSpotOrder`?
        
        revert("Use cancelSpotOrder for spot, or interact with Market directly for others");
    }
    
    function cancelSpotOrder(address market, uint256 orderId) external {
        SpotOrder storage info = spotOrders[orderId];
        require(info.user == msg.sender, "TraderVault: not owner");
        require(info.market == market, "TraderVault: market mismatch");
        
        // Cancel on market (vault is maker)
        ISoothMarketV4(market).cancelOrder(orderId, address(this));
        
        // Unlock (Transfer Vault -> User)
        IOutcomeToken token = ISoothMarketV4(market).outcomeToken();
        token.safeTransferFrom(address(this), msg.sender, info.outcome, info.amount, "");
        
        delete spotOrders[orderId];
        emit OrderCancelled(msg.sender, market, orderId, 0); // 0 refund in USDC
    }

    // ============ View Functions ============
    
    function availableBalance(address user) external view returns (uint256) {
        return accounts[user].available;
    }

    function totalBalance(address user) external view returns (uint256) {
        return accounts[user].available + accounts[user].pending;
    }

    function isMarket(address market) external view returns (bool) {
        return _isMarket[market];
    }

    function pendingBalance(address user) external view returns (uint256) {
        return accounts[user].pending;
    }

    /// @notice Get AMM position for a user in a market
    function getAMMPosition(address user, address market) external view returns (
        uint256 yesShares,
        uint256 noShares,
        uint256 unlockTime,
        bool isUnlocked
    ) {
        AMMPosition storage pos = ammPositions[user][market];
        yesShares = pos.yesShares;
        noShares = pos.noShares;
        unlockTime = pos.unlockTime;
        isUnlocked = block.timestamp >= pos.unlockTime;
    }

    function asset() external view returns (address) {
        return address(_asset);
    }

    // ============ Admin Functions ============
    
    function setMarket(address market, bool enabled) external onlyOwner {
        _isMarket[market] = enabled;
    }

    function setGovernorVault(ISoothGovernorVault _governorVault) external onlyOwner {
        governorVault = _governorVault;
    }

    function setYieldStrategy(IYieldStrategy strategy) external onlyOwner {
        yieldStrategy = strategy;
    }

    function setTimeLock(ITimeLock _timeLock) external onlyOwner {
        timeLock = _timeLock;
    }

    // ============ Market Callbacks ============
    
    /// @notice Called by Market when orderbook tokens are matched
    /// @dev V4: Orderbook tokens are ERC1155, not internal
    function creditMergeProceeds(address user, uint256 amount) external onlyMarket {
        require(amount > 0, "TraderVault: zero amount");
        
        // V4: Shares are Integers (1 Share = 1e18 value in WAD space)
        // proceeds = amount * 1e18 / scalar
        uint256 proceeds = amount * 1e18 / scalar;
        
        // V4: Merge is FREE (instant credit)
        accounts[user].available += proceeds;
        
        emit MergeCredit(user, proceeds);
    }

    /// @notice Redeem winning shares after market settlement
    function redeem(address market) external {
        require(_isMarket[market], "TraderVault: invalid market");
        
        ISoothMarketV4 mkt = ISoothMarketV4(market);
        require(mkt.isSettled(), "TraderVault: market not settled");
        
        uint8 winningOutcome = mkt.winningOutcome();
        AMMPosition storage pos = ammPositions[msg.sender][market];
        
        uint256 shares;
        
        // Get user's winning AMM shares
        if (winningOutcome == 0) {
            shares = pos.yesShares;
            require(shares > 0, "TraderVault: no YES shares");
            pos.yesShares = 0;
        } else {
            shares = pos.noShares;
            require(shares > 0, "TraderVault: no NO shares");
            pos.noShares = 0;
        }
        
        // Send funds to Governor
        // Scale down and credit (1 share = $1)
        // Shares are Integers. Payout = shares * 1e18 / scalar
        uint256 payout = shares * 1e18 / scalar;
        
        governorVault.sendFunds(mkt.marketId(), address(this), payout);
        accounts[msg.sender].available += payout;
        
        emit SharesRedeemed(msg.sender, market, winningOutcome, shares);
    }

    // ============ Required Interface Stubs ============
    
    // These are not used in V4 but required by interface
    function transferShares(address, address, uint8, uint256) external pure {
        revert("V4: use OutcomeToken for transfers");
    }
}
