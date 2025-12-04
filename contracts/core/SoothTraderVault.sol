// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../core/SoothInterfaces.sol";
import "../interfaces/ISoothTraderVault.sol";
import "../interfaces/ISoothMarket.sol";
import "../interfaces/IYieldStrategy.sol";
import "../interfaces/ITimeLock.sol";

/// @title SoothTraderVault
/// @notice Single entry point for all Sooth trading - deposit, withdraw, trade AMM, trade orderbook
/// @dev Manages user accounts with available/pending balances, integrates yield and time-lock modules
contract SoothTraderVault is ISoothTraderVault, Ownable {
    // ============ State ============

    IERC20 public immutable _asset;

    struct UserAccount {
        uint256 available;  // Can trade or withdraw
        uint256 pending;    // Locked, awaiting unlock (simplified: no time-lock module yet)
    }

    mapping(address => UserAccount) public accounts;
    mapping(address => bool) private _isMarket;

    // Optional modules (can be address(0))
    IYieldStrategy public yieldStrategy;
    ITimeLock public timeLock;

    // Governor vault for LP liquidity
    ISoothGovernorVault public governorVault;

    // ============ Constructor ============

    constructor(IERC20 asset_, ISoothGovernorVault governorVault_) {
        _asset = asset_;
        governorVault = governorVault_;
    }

    // ============ Modifiers ============

    modifier onlyMarket() {
        require(_isMarket[msg.sender], "TraderVault: not market");
        _;
    }

    // ============ User Actions ============

    function deposit(uint256 amount) external override {
        require(amount > 0, "TraderVault: zero amount");
        
        // Auto-cleanup unlocked pending (if any)
        _processUnlocks(msg.sender);
        
        require(_asset.transferFrom(msg.sender, address(this), amount), "TraderVault: transfer failed");
        
        accounts[msg.sender].available += amount;
        emit Deposit(msg.sender, amount);

        // Optional: Rebalance to yield strategy
        _rebalanceYield();
    }

    function withdraw(uint256 amount) external override {
        require(amount > 0, "TraderVault: zero amount");
        
        // Auto-cleanup unlocked pending first
        _processUnlocks(msg.sender);
        
        require(accounts[msg.sender].available >= amount, "TraderVault: insufficient available");

        accounts[msg.sender].available -= amount;

        // Ensure we have enough liquid funds
        _ensureLiquidity(amount);
        
        require(_asset.transfer(msg.sender, amount), "TraderVault: transfer failed");
        emit Withdraw(msg.sender, amount);
    }

    function claimUnlocked() external override returns (uint256 amount) {
        // If time-lock module is set, delegate to it
        if (address(timeLock) != address(0)) {
            amount = timeLock.claimUnlockedFor(msg.sender);
            
            // Move funds from pending to available
            // Note: TimeLock tracks pending amount, but Vault holds actual funds.
            // Vault's `accounts[user].pending` should match TimeLock's `pendingBalance(user)`.
            // When TimeLock says X is unlocked, we reduce pending by X and increase available by X.
            
            if (amount > 0) {
                accounts[msg.sender].pending -= amount;
                accounts[msg.sender].available += amount;
            }
        } else {
            // No time-lock: pending is immediately claimable
            amount = accounts[msg.sender].pending;
            accounts[msg.sender].pending = 0;
            accounts[msg.sender].available += amount;
        }
        
        if (amount > 0) {
            emit ProceedsClaimed(msg.sender, amount);
        }
    }

    // ============ Trading ============

    function tradeAMM(
        address market,
        uint8 outcome,
        int256 deltaShares,
        int256 maxCost
    ) external override {
        require(_isMarket[market], "TraderVault: invalid market");
        require(deltaShares != 0, "TraderVault: zero shares");

        ISoothMarket mkt = ISoothMarket(market);

        // Execute trade on market
        (int256 cost, uint256 fee) = mkt.executeAMMTrade(msg.sender, outcome, deltaShares);

        // Handle fund movement
        if (cost > 0) {
            // User is BUYING - debit their account
            uint256 totalCost = uint256(cost) + fee;
            require(int256(totalCost) <= maxCost, "TraderVault: slippage exceeded");
            require(accounts[msg.sender].available >= totalCost, "TraderVault: insufficient balance");
            
            accounts[msg.sender].available -= totalCost;
            
            // Pay to governor vault
            _ensureLiquidity(totalCost);
            require(_asset.transfer(address(governorVault), totalCost), "TraderVault: transfer failed");
            governorVault.receiveFunds(mkt.marketId(), totalCost);
        } else if (cost < 0) {
            // User is SELLING - credit proceeds (potentially locked)
            uint256 grossProceeds = uint256(-cost);
            uint256 netProceeds = grossProceeds > fee ? grossProceeds - fee : 0;
            require(-int256(netProceeds) >= maxCost, "TraderVault: slippage exceeded");

            // Receive from governor vault
            governorVault.sendFunds(mkt.marketId(), address(this), grossProceeds);

            // Credit user (locked if time-lock enabled)
            _creditProceeds(msg.sender, netProceeds);
        }

        emit TradeExecuted(msg.sender, market, outcome, deltaShares, cost);
    }

    function placeOrder(
        address market,
        uint8 outcome,
        uint256 price,
        uint256 amount
    ) external override returns (uint256 orderId) {
        require(_isMarket[market], "TraderVault: invalid market");
        require(price > 0 && price < 1e18, "TraderVault: invalid price");
        require(amount > 0, "TraderVault: invalid amount");

        // Calculate cost: user pays price * amount upfront
        uint256 cost = price * amount / 1e18;
        require(accounts[msg.sender].available >= cost, "TraderVault: insufficient balance");

        // Debit user
        accounts[msg.sender].available -= cost;

        // Create order on market
        orderId = ISoothMarket(market).createOrder(msg.sender, outcome, price, amount);

        emit OrderPlaced(msg.sender, market, orderId, outcome, price, amount);
    }

    function cancelOrder(address market, uint256 orderId) external override {
        require(_isMarket[market], "TraderVault: invalid market");

        // Cancel on market, get refund amount
        uint256 refund = ISoothMarket(market).cancelOrder(orderId, msg.sender);

        // Credit user immediately (not locked - this wasn't trading profit)
        accounts[msg.sender].available += refund;

        emit OrderCancelled(msg.sender, market, orderId, refund);
    }

    /// @notice Redeem winning shares after market settlement
    /// @param market The market address
    function redeem(address market) external override {
        require(_isMarket[market], "TraderVault: invalid market");
        
        ISoothMarket mkt = ISoothMarket(market);
        require(mkt.isSettled(), "TraderVault: market not settled");
        
        uint8 winningOutcome = mkt.winningOutcome();
        uint256 shares;
        
        // Get user's winning shares
        if (winningOutcome == 0) {
            shares = mkt.yesBalance(msg.sender);
            require(shares > 0, "TraderVault: no YES shares");
        } else {
            shares = mkt.noBalance(msg.sender);
            require(shares > 0, "TraderVault: no NO shares");
        }
        
        // Burn shares on market (market will update balances)
        // Note: Market should have a function to burn shares, or we track internally
        // For now, we'll request funds from GovernorVault
        
        // Credit user 1 USDC per share (no time-lock for redemption)
        governorVault.sendFunds(mkt.marketId(), address(this), shares);
        accounts[msg.sender].available += shares;
        
        emit SharesRedeemed(msg.sender, market, winningOutcome, shares);
    }

    // ============ Market Callbacks ============

    /// @notice Called by market when an order is matched
    /// @param buyer The buyer address
    /// @param seller The seller address  
    /// @param buyerCost Cost paid by buyer (already debited when order placed)
    /// @param sellerProceeds Proceeds to seller (needs to be credited)
    function onOrderMatched(
        address buyer,
        address seller,
        uint256 buyerCost,
        uint256 sellerProceeds
    ) external onlyMarket {
        // Buyer's cost was already debited when they placed the order
        // Seller's order was also already debited
        
        // Complete set is funded: buyerCost + sellerProceeds = 1 * shares
        // Credit seller (locked)
        _creditProceeds(seller, sellerProceeds);
        
        // The buyerCost stays in the vault for settlement
    }

    // ============ View Functions (Lazy Calculation) ============

    /// @notice Returns available balance including unlockable pending
    function availableBalance(address user) external view override returns (uint256) {
        return accounts[user].available + _getUnlockable(user);
    }

    /// @notice Returns truly locked balance (not yet unlockable)
    function pendingBalance(address user) external view override returns (uint256) {
        return accounts[user].pending - _getUnlockable(user);
    }

    function totalBalance(address user) external view override returns (uint256) {
        return accounts[user].available + accounts[user].pending;
    }

    function asset() external view override returns (address) {
        return address(_asset);
    }

    function isMarket(address market) external view override returns (bool) {
        return _isMarket[market];
    }

    /// @notice Get amount that is unlockable (unlock time passed) but not yet claimed
    function _getUnlockable(address user) internal view returns (uint256 unlockable) {
        if (address(timeLock) == address(0)) {
            return accounts[user].pending; // No time-lock = all pending is available
        }
        
        // Query TimeLock for pending unlocks
        ITimeLock.PendingUnlock[] memory unlocks = timeLock.getPendingUnlocks(user);
        for (uint256 i = 0; i < unlocks.length; i++) {
            if (unlocks[i].unlockTime <= block.timestamp) {
                unlockable += unlocks[i].amount;
            }
        }
    }

    // ============ Admin Functions ============

    function setMarket(address market, bool enabled) external override onlyOwner {
        _isMarket[market] = enabled;
    }

    function setYieldStrategy(IYieldStrategy strategy) external override onlyOwner {
        yieldStrategy = strategy;
    }

    function setTimeLock(ITimeLock _timeLock) external override onlyOwner {
        timeLock = _timeLock;
    }

    function setGovernorVault(ISoothGovernorVault _governorVault) external onlyOwner {
        governorVault = _governorVault;
    }

    // ============ Internal Functions ============

    /// @notice Process all unlocked pending items for a user (cleanup stale records)
    function _processUnlocks(address user) internal {
        if (address(timeLock) == address(0)) {
            // No time-lock module: move all pending to available
            if (accounts[user].pending > 0) {
                accounts[user].available += accounts[user].pending;
                accounts[user].pending = 0;
            }
            return;
        }
        
        // Delegate to TimeLock to claim and cleanup records
        uint256 claimed = timeLock.claimUnlockedFor(user);
        if (claimed > 0) {
            accounts[user].pending -= claimed;
            accounts[user].available += claimed;
        }
    }

    function _creditProceeds(address user, uint256 amount) internal {
        if (address(timeLock) != address(0)) {
            // Time-lock enabled: lock proceeds
            timeLock.lockProceeds(user, amount);
            accounts[user].pending += amount;
            emit ProceedsLocked(user, amount, block.timestamp + timeLock.lockDuration());
        } else {
            // No time-lock: immediate credit
            accounts[user].available += amount;
        }
    }

    function _rebalanceYield() internal {
        if (address(yieldStrategy) == address(0)) return;

        // TODO: Implement yield rebalancing logic
        // For now, this is a no-op stub
    }

    function _ensureLiquidity(uint256 needed) internal {
        uint256 liquid = _asset.balanceOf(address(this));
        if (liquid >= needed) return;

        if (address(yieldStrategy) != address(0)) {
            // Withdraw from yield strategy
            uint256 deficit = needed - liquid;
            yieldStrategy.withdraw(deficit);
        }
    }

    // ============ Helper for Market ============

    /// @notice Get market ID from market contract (for governorVault calls)
    function _getMarketId(address market) internal view returns (uint256) {
        // Markets should expose marketId
        (bool success, bytes memory data) = market.staticcall(abi.encodeWithSignature("marketId()"));
        require(success, "TraderVault: marketId call failed");
        return abi.decode(data, (uint256));
    }
}
