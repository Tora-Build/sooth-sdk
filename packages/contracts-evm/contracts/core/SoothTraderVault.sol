// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../core/SoothInterfaces.sol";
import "../interfaces/ISoothTraderVault.sol";
import "../interfaces/ISoothMarket.sol";
import "../interfaces/IYieldStrategy.sol";
import "../interfaces/ITimeLock.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title SoothTraderVault
/// @notice Single entry point for all Sooth trading - deposit, withdraw, trade AMM, trade orderbook
/// @dev Manages user accounts with available/pending balances, integrates yield and time-lock modules
contract SoothTraderVault is ISoothTraderVault, Ownable {
    // ============ State ============

    IERC20 private immutable _asset;
    uint256 public immutable scalar; // Scale factor from Asset to WAD (e.g. 1e12 for USDC)

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
        
        // Scalar to convert Asset -> WAD (multiply) or WAD -> Asset (divide)
        // Assume asset <= 18 decimals
        if (decimals <= 18) {
            scalar = 10**(18 - decimals);
        } else {
            scalar = 1; // Not supported, treat as 18
        }
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
        (int256 rawCost, uint256 rawFee) = mkt.executeAMMTrade(msg.sender, outcome, deltaShares);

        // Scale down from AMM (18 decimals) to Asset (e.g. 6 decimals)
        // Note: GovernorVault defines the scale (10^(18-decimals))
        uint256 scale = governorVault.decimalsScale();
        int256 cost = rawCost / int256(scale);
        uint256 fee = rawFee / scale;

        // Handle fund movement
        if (cost > 0) {
            // User is BUYING - debit their account
            // Cost is in WAD. Scale to Asset.
            // e.g. 25e18 cost -> 25e6 USDC (divide by 1e12)
            uint256 wadCost = uint256(cost);
            uint256 wadFee = fee;
            
            // Round up for safety when paying
            uint256 assetCost = (wadCost + scalar - 1) / scalar;
            uint256 assetFee = (wadFee + scalar - 1) / scalar;
            uint256 totalAssetCost = assetCost + assetFee;

            require(int256(totalAssetCost) <= maxCost, "TraderVault: slippage exceeded");
            require(accounts[msg.sender].available >= totalAssetCost, "TraderVault: insufficient balance");
            
            accounts[msg.sender].available -= totalAssetCost;
            
            // Pay to governor vault
            _ensureLiquidity(totalAssetCost);
            require(_asset.transfer(address(governorVault), totalAssetCost), "TraderVault: transfer failed");
            governorVault.receiveFunds(mkt.marketId(), totalAssetCost);
        } else if (cost < 0) {
            // User is SELLING
            uint256 wadGross = uint256(-cost);
            uint256 wadFee = fee;
            
            // Round down proceeds
            uint256 assetGross = wadGross / scalar;
            uint256 assetFee = (wadFee + scalar - 1) / scalar;
            
            uint256 netProceeds = assetGross > assetFee ? assetGross - assetFee : 0;
            
            // Slippage check for sells:
            if (maxCost != type(int256).min) {
                 require(int256(netProceeds) >= -maxCost, "TraderVault: slippage exceeded");
            }

            // Receive NET PROCEEDS from governor vault (Fee stays in Governor)
            governorVault.sendFunds(mkt.marketId(), address(this), netProceeds);

            // Credit user (net)
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
        // CAUTION: price and amount are 1e18. Result is 1e18. 
        // We must scale down to asset decimals.
        uint256 rawCost = price * amount / 1e18;
        uint256 scale = governorVault.decimalsScale();
        uint256 cost = rawCost / scale;

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
        // Cancel on market, get refund amount
        uint256 rawRefund = ISoothMarket(market).cancelOrder(orderId, msg.sender);
        
        uint256 scale = governorVault.decimalsScale();
        uint256 refund = rawRefund / scale;

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

    /// @notice Called by V3 market when user merges YES+NO tokens
    /// @dev Merge is a capital exit (collateral unlock), so proceeds are locked
    /// @param user The user merging tokens
    /// @param amount Amount of complete sets merged (1 set = $1 worth)
    function creditMergeProceeds(address user, uint256 amount) external onlyMarket {
        require(amount > 0, "TraderVault: zero amount");
        
        // Scale from WAD to asset decimals
        uint256 scale = governorVault.decimalsScale();
        uint256 proceeds = amount / scale;
        
        // V3 Policy: Merge is FREE (no lock)
        // Rationale: User holds delta-neutral position (YES+NO). No oracle exploit risk.
        // Direct credit to available balance enables atomic arbitrage.
        accounts[user].available += proceeds;
        
        emit MergeCredit(user, proceeds);
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

    // ============ ERC4626 Implementation ============

    function totalAssets() external view override returns (uint256) {
        return _asset.balanceOf(address(this));
    }

    function totalSupply() external view override returns (uint256) {
        return _asset.balanceOf(address(this)); // 1:1 ratio, includes pending
    }

    function balanceOf(address account) external view override returns (uint256) {
        return accounts[account].available + _getUnlockable(account);
    }

    function convertToShares(uint256 assets) external pure override returns (uint256) {
        return assets;
    }

    function convertToAssets(uint256 shares) external pure override returns (uint256) {
        return shares;
    }

    function maxDeposit(address) external view override returns (uint256) {
        return type(uint256).max;
    }

    function maxMint(address) external view override returns (uint256) {
        return type(uint256).max;
    }

    function maxWithdraw(address owner) external view override returns (uint256) {
        return accounts[owner].available + _getUnlockable(owner);
    }

    function maxRedeem(address owner) external view override returns (uint256) {
        return accounts[owner].available + _getUnlockable(owner);
    }

    function previewDeposit(uint256 assets) external pure override returns (uint256) {
        return assets;
    }

    function previewMint(uint256 shares) external pure override returns (uint256) {
        return shares;
    }

    function previewWithdraw(uint256 assets) external pure override returns (uint256) {
        return assets;
    }

    function previewRedeem(uint256 shares) external pure override returns (uint256) {
        return shares;
    }

    function deposit(uint256 assets, address receiver) external override returns (uint256) {
        require(assets > 0, "TraderVault: zero amount");
        
        _processUnlocks(receiver); // Cleanup for receiver
        
        require(_asset.transferFrom(msg.sender, address(this), assets), "TraderVault: transfer failed");
        
        accounts[receiver].available += assets;
        emit Deposit(msg.sender, receiver, assets, assets);
        emit Deposit(receiver, assets); // Legacy event
        
        _rebalanceYield();
        return assets;
    }

    function mint(uint256 shares, address receiver) external override returns (uint256) {
        return this.deposit(shares, receiver);
    }

    function withdraw(uint256 assets, address receiver, address owner) external override returns (uint256) {
        require(assets > 0, "TraderVault: zero amount");
        
        if (msg.sender != owner) {
            _spendAllowance(owner, msg.sender, assets);
        }

        _processUnlocks(owner);
        
        require(accounts[owner].available >= assets, "TraderVault: insufficient available");
        accounts[owner].available -= assets;
        
        _ensureLiquidity(assets);
        require(_asset.transfer(receiver, assets), "TraderVault: transfer failed");
        
        emit Withdraw(msg.sender, receiver, owner, assets, assets);
        emit Withdraw(owner, assets); // Legacy event
        
        return assets;
    }

    function redeem(uint256 shares, address receiver, address owner) external override returns (uint256) {
        return this.withdraw(shares, receiver, owner);
    }

    // ============ ERC20 Implementation ============

    function name() external view override returns (string memory) {
        return string.concat("Sooth Vault ", IERC20Metadata(address(_asset)).name());
    }

    function symbol() external view override returns (string memory) {
        return string.concat("sv", IERC20Metadata(address(_asset)).symbol());
    }

    function decimals() external view override returns (uint8) {
        return IERC20Metadata(address(_asset)).decimals();
    }

    // ============ Transfers ============

    function transferShares(
        address market,
        address to,
        uint8 outcome,
        uint256 amount
    ) external override {
        require(_isMarket[market], "TraderVault: invalid market");
        
        // User must own the shares (Market checks balance)
        ISoothMarket(market).transferShares(msg.sender, to, outcome, amount);

        emit ShareTransfer(market, msg.sender, to, outcome, amount);
    }

    function transfer(address to, uint256 amount) external override returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function allowance(address owner, address spender) external view override returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        _spendAllowance(from, msg.sender, amount);
        _transfer(from, to, amount);
        return true;
    }

    mapping(address => mapping(address => uint256)) private _allowances;

    function _approve(address owner, address spender, uint256 amount) internal {
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function _spendAllowance(address owner, address spender, uint256 amount) internal {
        uint256 currentAllowance = _allowances[owner][spender];
        if (currentAllowance != type(uint256).max) {
            require(currentAllowance >= amount, "ERC20: insufficient allowance");
            _approve(owner, spender, currentAllowance - amount);
        }
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(from != address(0), "ERC20: transfer from the zero address");
        require(to != address(0), "ERC20: transfer to the zero address");

        _processUnlocks(from);
        
        uint256 fromBalance = accounts[from].available;
        require(fromBalance >= amount, "ERC20: transfer amount exceeds balance");
        
        accounts[from].available = fromBalance - amount;
        accounts[to].available += amount;

        emit Transfer(from, to, amount);
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
        
        // Safety check: Ensure we don't underflow if TimeLock and Vault are out of sync
        if (claimed > accounts[user].pending) {
            claimed = accounts[user].pending;
        }

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
