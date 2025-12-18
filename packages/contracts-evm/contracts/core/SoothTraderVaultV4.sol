// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../core/ISoothLiquidityVault.sol";
import "../core/SoothInterfaces.sol"; // For Ownable and other interfaces
import "../interfaces/ISoothMarketV4.sol";
import "../interfaces/ISoothTraderVaultV4.sol";
import "../interfaces/IOutcomeToken.sol";
import "../interfaces/IYieldStrategy.sol";
import "../interfaces/ITimeLock.sol";
import "../launchpad/interfaces/ILaunchpadFactory.sol";
import "../launchpad/interfaces/ILaunchpadMarket.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";

/// @title SoothTraderVaultV4
/// @notice V4: Dual-venue trading with Lock-on-Sell policy
/// @dev AMM trades are internal positions. Orderbook uses ERC1155.
contract SoothTraderVaultV4 is ISoothTraderVaultV4, SoothOwnable, ERC1155Holder {
    using SafeERC20 for IERC20;

    // ============ Constants ============
    
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
    }

    mapping(address => UserAccount) public accounts;
    mapping(address => mapping(address => AMMPosition)) public ammPositions;
    // ammPositions[user][market] = position
    
    mapping(address => bool) private _isMarket;
    mapping(address => bool) private _isOutcomeToken;

    ISoothLiquidityVault public liquidityVault;
    IYieldStrategy public yieldStrategy;
    ITimeLock public timeLock;

    // ============ Events ============
    
    // Events inherited from ISoothTraderVaultV4

    // ============ Constructor ============
    
    constructor(
        IERC20 asset_,
        ISoothLiquidityVault liquidityVault_
    ) {
        require(address(asset_) != address(0), "TraderVault: zero asset");
        require(address(liquidityVault_) != address(0), "TraderVault: zero vault");
        
        _asset = asset_;
        liquidityVault = liquidityVault_;
        
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
        require(_isValidMarket(msg.sender), "TraderVault: not market");
        _;
    }

    modifier onlyMarketOrOwner(address market) {
        require(msg.sender == market || msg.sender == owner, "TraderVault: denied");
        _;
    }

    modifier onlyOutcomeToken() {
        require(_isOutcomeToken[msg.sender], "TraderVault: not outcomeToken");
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

        // Block withdrawals if user has locked proceeds globally
        // Check all markets for locked proceeds
        uint256 globalLocked = liquidityVault.lockedBalance(msg.sender);
        require(globalLocked == 0, "TraderVault: has locked proceeds, cannot withdraw");

        accounts[msg.sender].available -= amount;
        require(_asset.transfer(msg.sender, amount), "TraderVault: transfer failed");
        emit Withdraw(msg.sender, amount);
    }

    function claimUnlocked() external returns (uint256 amount) {
        // Default to global liquidity vault for direct user claim
        // Note: Launchpad markets are their own vault, but global vault may still be used for legacy/global operations
        amount = _claimUnlockedInternal(liquidityVault, msg.sender);
    }
    
    // Overload for specific liquidity vault
    function claimUnlocked(ISoothLiquidityVault vault) external returns (uint256 amount) {
        amount = _claimUnlockedInternal(vault, msg.sender);
    }

    // Lock proceeds on a specific liquidity vault
    function _lockProceedsOnVault(ISoothLiquidityVault targetVault, address user, uint256 marketId, uint256 amount) internal {
        // Claim any previously unlocked funds from this specific vault
        _claimUnlockedInternal(targetVault, user);

        uint64 unlockTime = targetVault.lockProceeds(marketId, user, amount);
        emit Locked(user, amount, unlockTime);
    }

    function _claimUnlockedInternal(ISoothLiquidityVault targetVault, address user) internal returns (uint256 claimed) {
        claimed = targetVault.claimUnlocked(user, address(this));

        if (claimed > 0) {
            accounts[user].available += claimed;
            emit Unlocked(user, claimed);
            emit Claimed(user, claimed);
        }
    }

    // ============ AMM Trading (V4: Lock on Sell) ============

    /// @notice Trade with AMM - proceeds from SELL are time-locked
    function tradeAMM(
        address market,
        uint8 outcome,
        int256 deltaShares,
        int256 maxCost
    ) external {
        require(_isValidMarket(market), "TraderVault: invalid market");
        require(deltaShares != 0, "TraderVault: zero shares");
        require(outcome < 2, "TraderVault: invalid outcome");

        ISoothMarketV4 mkt = ISoothMarketV4(market);
        
        // Fetch liquidity vault from the market itself
        // Launchpad markets are their own vault (implement ISoothLiquidityVault)
        ISoothLiquidityVault marketVault = mkt.liquidityVault();
        require(address(marketVault) != address(0), "TraderVault: zero vault");

        AMMPosition storage pos = ammPositions[msg.sender][market];

        if (deltaShares > 0) {
            // ========== BUY ==========
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
            
            // V6: Check if this is a Launchpad pre-grad market and use locked proceeds if available
            bool isLaunchpadPreGrad = false;
            uint256 locked = 0;
            try ILaunchpadMarket(market).isGraduated() returns (bool graduated) {
                if (!graduated) {
                    isLaunchpadPreGrad = true;
                    try ILaunchpadMarket(market).lockedProceeds(msg.sender) returns (uint256 lockedAmount) {
                        locked = lockedAmount;
                    } catch {}
                }
            } catch {}
            
            if (isLaunchpadPreGrad && locked > 0 && totalCost <= locked) {
                // Use locked proceeds for the entire cost
                ILaunchpadMarket(market).useLockedProceeds(msg.sender, totalCost);
                // Funds stay in market (no transfer needed)
            } else {
                // Use available balance
            require(accounts[msg.sender].available >= totalCost, "TraderVault: insufficient balance");
            accounts[msg.sender].available -= totalCost;
            
            // Pay to liquidity vault attached to THIS market
            require(_asset.transfer(address(marketVault), totalCost), "TraderVault: transfer failed");
            marketVault.receiveFunds(mkt.marketId(), totalCost);
            }
            
            // Credit internal shares
            if (outcome == 0) {
                pos.yesShares += shares;
            } else {
                pos.noShares += shares;
            }
            emit AMMBuy(msg.sender, market, outcome, shares, totalCost, 0);
            emit TradeExecuted(msg.sender, market, outcome, deltaShares, rawCost);

        } else {
            // ========== SELL: Lock proceeds ==========
            uint256 shares = uint256(-deltaShares);

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
            
            // Always lock proceeds (both pre and post-graduation)
            // Pre-graduation: Proceeds locked, can be used for reinvestment via useLockedProceeds()
            // Post-graduation: Normal 24h lock-on-sell
            _lockProceedsOnVault(marketVault, msg.sender, mkt.marketId(), netProceeds);

            emit AMMSell(msg.sender, market, outcome, shares, netProceeds);
            emit TradeExecuted(msg.sender, market, outcome, deltaShares, rawCost);
        }
    }

    // ============ Orderbook Trading (uses OutcomeToken ERC1155) ============
    
    // ============ Custodial State (V4 Update) ============

    // user => market => outcome => balance
    mapping(address => mapping(address => mapping(uint8 => uint256))) public shareBalances;
    
    // orderId => owner
    mapping(uint256 => address) public orderOwners;

    // ============ Custodial Actions ============

    function depositShares(address market, uint8 outcome, uint256 amount) external {
        require(_isValidMarket(market), "TraderVault: invalid market");
        require(amount > 0, "TraderVault: zero amount");
        require(outcome < 2, "TraderVault: invalid outcome");

        // Transfer USER -> VAULT (ERC1155)
        IOutcomeToken token = ISoothMarketV4(market).outcomeToken();
        token.safeTransferFrom(msg.sender, address(this), outcome, amount, "");

        // Credit Internal Ledger
        shareBalances[msg.sender][market][outcome] += amount;
        
        emit Deposit(msg.sender, amount); // Reusing event (amount is opaque)
    }

    function withdrawShares(address market, uint8 outcome, uint256 amount) external {
        require(shareBalances[msg.sender][market][outcome] >= amount, "TraderVault: insufficient shares");
        require(amount > 0, "TraderVault: zero amount");

        // Debit Internal Ledger
        shareBalances[msg.sender][market][outcome] -= amount;

        // Transfer VAULT -> USER (ERC1155)
        IOutcomeToken token = ISoothMarketV4(market).outcomeToken();
        token.safeTransferFrom(address(this), msg.sender, outcome, amount, "");
        
        emit Withdraw(msg.sender, amount);
    }

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
        return _placeOrder(msg.sender, market, outcome, price, amount, isBuy);
    }

    function _placeOrder(
        address user,
        address market,
        uint8 outcome,
        uint256 price,
        uint256 amount,
        bool isBuy
    ) internal returns (uint256 orderId) {
        require(_isValidMarket(market), "TraderVault: invalid market");
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

        require(accounts[user].available >= cost, "TraderVault: insufficient balance");
        accounts[user].available -= cost;
        accounts[user].pending += cost; // Track Reserved Collateral

        // Create order on market (Sender is User)
        uint256 matchedAmount;
        uint256 matchedValue;
        
        // Predict Order ID to handle synchronous callback (onOrderMatched)
        orderId = ISoothMarketV4(market).nextOrderId();
        orderOwners[orderId] = user;
        
        // Custodial: Vault is Maker
        (uint256 actualId, uint256 mAmount, uint256 mValue) = ISoothMarketV4(market).createOrder(address(this), targetOutcome, targetPrice, amount);
        require(actualId == orderId, "TraderVault: orderId mismatch");
        
        matchedAmount = mAmount;
        matchedValue = mValue;

        // Refund Logic
        if (matchedAmount > 0) {
            uint256 refund;
            uint256 usedCost;
            
            if (isBuy) {
                // Buy: Refund = (LimitPrice * Matched / 1e18) - ActualValue
                // targetPrice and matchedAmount are both WAD, so multiply creates WAD*WAD
                uint256 limitValue = (targetPrice * matchedAmount) / 1e18;
                refund = limitValue > matchedValue ? limitValue - matchedValue : 0;
                // Cost Used = ActualValue (already WAD)
                usedCost = matchedValue;
            } else {
                // Short Sell: Refund = matchedValue - (price * matchedAmount / 1e18)
                uint256 sellerReceives = (price * matchedAmount) / 1e18;
                refund = matchedValue > sellerReceives ? matchedValue - sellerReceives : 0;
                // Collateral Used = (1-price) * matchedAmount / 1e18
                usedCost = ((1e18 - price) * matchedAmount) / 1e18;
            }

            // Scale
            uint256 scaledUsed = usedCost / 1e18 / scalar;
            
            if (refund > 0) {
                uint256 scaledRefund = refund / scalar;
                accounts[user].available += scaledRefund;
                emit MergeCredit(user, scaledRefund);
            }
            
            // Release Pending for the matched portion
            // Note: If refund > 0 (price improvement), pending still reduces by the *base cost* of the matched amount.
            // Wait, logic:
            // Initial Pending = Cost (Limit Price based).
            // Matched Amount M.
            // Cost for M = M * Price (or 1-Price).
            // We reduce pending by this Cost for M.
            if (accounts[user].pending >= scaledUsed) {
                accounts[user].pending -= scaledUsed;
            } else {
                accounts[user].pending = 0; // Safety
            }
        }

        emit OrderPlaced(user, market, orderId, outcome, price, amount);
    }
    
    function placeSpotOrder(
        address market,
        uint8 outcome,
        uint256 price,
        uint256 amount
    ) external override returns (uint256 orderId) {
        return _placeSpotOrder(msg.sender, market, outcome, price, amount);
    }

    function _placeSpotOrder(
        address user,
        address market,
        uint8 outcome,
        uint256 price,
        uint256 amount
    ) internal returns (uint256 orderId) {
        require(_isValidMarket(market), "TraderVault: invalid market");
        require(price > 0 && price < 1e18, "TraderVault: invalid price");
        require(amount > 0, "TraderVault: invalid amount");
        
        // Lock Shares - Deduct from Internal Ledger (Custodial)
        require(shareBalances[user][market][outcome] >= amount, "TraderVault: insufficient shares");
        shareBalances[user][market][outcome] -= amount;

        // Target: Buy Opposite (to close)
        uint256 targetPrice = 1e18 - price;
        uint8 targetOutcome = outcome == 0 ? 1 : 0;
        
        // Pre-map orderId
        orderId = ISoothMarketV4(market).nextOrderId();
        
        spotOrders[orderId] = SpotOrder({
            user: user,
            market: market,
            outcome: outcome,
            amount: amount
        });
        
        // Place Order (Maker = Vault)
        (uint256 actualId, , ) = ISoothMarketV4(market).createOrder(address(this), targetOutcome, targetPrice, amount);
        require(actualId == orderId, "TraderVault: orderId mismatch");
        
        emit OrderPlaced(user, market, orderId, outcome, price, amount);
    }

    function executeHybridSell(
        address market,
        uint8 outcome,
        uint256 price,
        uint256 totalAmount
    ) external override {
        require(totalAmount > 0, "TraderVault: zero amount");
        
        // 1. Check Internal Balance
        uint256 balance = shareBalances[msg.sender][market][outcome];
        
        // 2. Calculate Split
        uint256 spotAmount = balance > totalAmount ? totalAmount : balance;
        uint256 shortAmount = totalAmount - spotAmount;
        
        // 3. Execute Spot Sell (if any)
        if (spotAmount > 0) {
            _placeSpotOrder(msg.sender, market, outcome, price, spotAmount);
        }
        
        // 4. Execute Short Sell (if any)
        if (shortAmount > 0) {
            _placeOrder(msg.sender, market, outcome, price, shortAmount, false);
        }
    }
    
    // Updated 3-arg callback
    function onOrderMatched(uint256 orderId, uint256 matchedAmount, uint256 matchedValue) external override onlyMarket {
        SpotOrder storage info = spotOrders[orderId];
        
        // 1. Spot Sell Match
        if (info.user != address(0)) {
            require(info.amount >= matchedAmount, "TraderVault: overmatch");
            info.amount -= matchedAmount;
            
            address user = info.user; // Cache user before deletion
            
            if (info.amount == 0) {
                delete spotOrders[orderId];
            }
            
            // Merge shares -> USDC
            IOutcomeToken token = ISoothMarketV4(msg.sender).outcomeToken();
            
            // This triggers creditMergeProceeds(address(this), amount)
            // Which pulls 1.00 USDC from liquidity vault.
            token.merge(matchedAmount);
            
            // matchedAmount is already WAD (1 share = 1e18)
            // Each share redeems for 1.00 USDC, so proceeds = matchedAmount
            uint256 proceeds = matchedAmount; // FIX: Was matchedAmount * 1e18 (overflow!)
            
            // Spot Sell: User gets (1.00 - matchPrice) per share
            // proceeds = total redemption value, matchedValue = what buyer paid
            // userPayoutRaw is in WAD
            uint256 userPayoutRaw = proceeds > matchedValue ? proceeds - matchedValue : 0;
            uint256 scaledPayout = userPayoutRaw / scalar;
            
            accounts[user].available += scaledPayout;
            emit MergeCredit(user, scaledPayout);
            
            return;
        }

        // 2. Custodial Share Credit (Buy/Short)
        address owner = orderOwners[orderId];
        if (owner != address(0)) {
            // Determine outcome received
            ISoothMarketV4.OrderV4 memory o = ISoothMarketV4(msg.sender).orders(orderId);
            uint8 receivedOutcome = o.isBuySide ? 0 : 1;
            
            shareBalances[owner][msg.sender][receivedOutcome] += matchedAmount;

            // Release Pending (Collateral Used)
            uint256 usedCost;
            if (o.isBuySide) {
                // Buy: Used = Price * Amount
                usedCost = (o.yesPrice * matchedAmount) / 1e18;
            } else {
                // Short: Used = (1-Price) * Amount
                usedCost = ((1e18 - o.yesPrice) * matchedAmount) / 1e18;
            }
            
            uint256 scaledUsed = usedCost / scalar;
            if (accounts[owner].pending >= scaledUsed) {
                accounts[owner].pending -= scaledUsed;
            } else {
                accounts[owner].pending = 0;
            }
        }
    }

    function cancelLimitOrder(address market, uint256 orderId) public {
        require(orderOwners[orderId] == msg.sender, "TraderVault: not owner");
        
        // Cancel on Market (Vault is Maker)
        uint256 refund = ISoothMarketV4(market).cancelOrder(orderId, address(this));
        
        // Refund = Unused Collateral (WAD)
        uint256 scaledRefund = refund / scalar;
        
        accounts[msg.sender].available += scaledRefund;
        
        // Release from Pending
        if (accounts[msg.sender].pending >= scaledRefund) {
            accounts[msg.sender].pending -= scaledRefund;
        } else {
            accounts[msg.sender].pending = 0;
        }

        delete orderOwners[orderId];
        emit OrderCancelled(msg.sender, market, orderId, refund);
    }
    
    // Legacy mapping support or catch-all
    function cancelOrder(address market, uint256 orderId) external {
        cancelLimitOrder(market, orderId);
    }
    
    function cancelSpotOrder(address market, uint256 orderId) external {
        SpotOrder storage info = spotOrders[orderId];
        require(info.user == msg.sender, "TraderVault: not owner");
        require(info.market == market, "TraderVault: market mismatch");
        
        // Cancel on market (vault is maker)
        ISoothMarketV4(market).cancelOrder(orderId, address(this));
        
        // Unlock (Custodial: Credit internal ledger)
        shareBalances[msg.sender][market][info.outcome] += info.amount;
        
        delete spotOrders[orderId];
        emit OrderCancelled(msg.sender, market, orderId, 0);
    }

    // ============ View Functions ============

    function availableBalance(address user) external view returns (uint256) {
        return accounts[user].available;
    }

    function totalBalance(address user) external view returns (uint256) {
        return accounts[user].available + accounts[user].pending + liquidityVault.lockedBalance(user);
    }

    function lockedBalance(address user) public view returns (uint256) {
        return liquidityVault.lockedBalance(user);
    }

    function claimableBalance(address user) public view returns (uint256 claimable) {
        claimable = liquidityVault.claimableBalance(user);
    }

    function getLockEntries(address user) external view returns (uint256[] memory amounts, uint64[] memory unlockTimes) {
        (amounts, unlockTimes) = liquidityVault.getLockEntries(user);
    }

    function nextUnlock(address user) external view returns (uint256 amount, uint64 unlockTime) {
        (amount, unlockTime) = liquidityVault.nextUnlock(user);
    }

    function isMarket(address market) external view returns (bool) {
        return _isValidMarket(market);
    }

    function isOutcomeToken(address token) external view returns (bool) {
        return _isOutcomeToken[token];
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
        unlockTime = 0;
        isUnlocked = true;
    }

    function asset() external view returns (address) {
        return address(_asset);
    }

    // ============ Admin Functions ============
    
    function setMarket(address market, bool enabled) external onlyOwner {
        _isMarket[market] = enabled;
    }

    function setOutcomeToken(address token, bool enabled) external onlyOwner {
        _isOutcomeToken[token] = enabled;
    }

    address public launchpadFactory;

    function setLiquidityVault(ISoothLiquidityVault _liquidityVault) external onlyOwner {
        liquidityVault = _liquidityVault;
    }

    function setLaunchpadFactory(address _launchpadFactory) external onlyOwner {
        launchpadFactory = _launchpadFactory;
    }

    function _isValidMarket(address market) internal view returns (bool) {
        if (_isMarket[market]) return true;
        if (launchpadFactory != address(0)) {
            try ILaunchpadFactory(launchpadFactory).isMarket(market) returns (bool valid) {
                return valid;
            } catch {
                return false;
            }
        }
        return false;
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
    function creditMergeProceeds(address user, uint256 amount) external onlyOutcomeToken {
        require(amount > 0, "TraderVault: zero amount");
        
        // Pull Funds from liquidity vault? 
        // NO. Orderbook liquidity is held in TraderVault (float).
        // Only AMM liquidity is in liquidity vault.
        // If OutcomeToken is strictly Orderbook, we simply release the Float.
        
        // Amount is WAD. Price is 1.0 (WAD). Value is Amount.
        // Convert WAD Amount to Asset Decimals
        uint256 proceeds = amount / scalar;
        
        // liquidityVault.sendFunds(marketId, address(this), proceeds); <--- REMOVED
        
        // Credit User (unless it's the Vault itself)
        if (user != address(this)) {
            accounts[user].available += proceeds;
            emit MergeCredit(user, proceeds);
        }
    }

    /// @notice Redeem winning shares after market settlement
    function redeem(address market) external {
        require(_isValidMarket(market), "TraderVault: invalid market");
        
        ISoothMarketV4 mkt = ISoothMarketV4(market);
        require(mkt.isSettled(), "TraderVault: market not settled");
        
        uint8 winningOutcome = mkt.winningOutcome();
        
        // 1. Redeem AMM Positions
        AMMPosition storage pos = ammPositions[msg.sender][market];
        uint256 shares;
        if (winningOutcome == 0) {
            shares = pos.yesShares;
            pos.yesShares = 0;
        } else {
            shares = pos.noShares;
            pos.noShares = 0;
        }
        
        // 2. Redeem Custodial Shares
        uint256 custShares = shareBalances[msg.sender][market][winningOutcome];
        if (custShares > 0) {
            shares += custShares;
            shareBalances[msg.sender][market][winningOutcome] = 0;
        }
        
        require(shares > 0, "TraderVault: no winning shares");
        
        // shares is WAD (1e18 per share). Each share redeems for 1.00 USDC.
        // Just scale from WAD to asset decimals.
        uint256 payout = shares / scalar;
        
        liquidityVault.sendFunds(mkt.marketId(), address(this), payout);
        accounts[msg.sender].available += payout;
        
        emit SharesRedeemed(msg.sender, market, winningOutcome, shares);
    }

    // ============ Required Interface Stubs ============
    
    function transferShares(address, address, uint8, uint256) external pure {
        revert("V4: use OutcomeToken for transfers");
    }
}
