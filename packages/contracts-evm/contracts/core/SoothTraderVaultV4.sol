// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../core/SoothInterfaces.sol";
import "../interfaces/ISoothMarket.sol";
import "../interfaces/IOutcomeToken.sol";
import "../interfaces/IYieldStrategy.sol";
import "../interfaces/ITimeLock.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title SoothTraderVaultV4
/// @notice V4: Dual-venue trading with Lock-on-Buy policy
/// @dev AMM trades are internal positions (locked on buy). Orderbook uses ERC1155.
contract SoothTraderVaultV4 is Ownable {
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
    
    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event TradeExecuted(address indexed user, address indexed market, uint8 outcome, int256 deltaShares, int256 cost);
    event OrderPlaced(address indexed user, address indexed market, uint256 orderId, uint8 outcome, uint256 price, uint256 amount);
    event OrderCancelled(address indexed user, address indexed market, uint256 orderId, uint256 refund);
    event ProceedsClaimed(address indexed user, uint256 amount);
    event MergeCredit(address indexed user, uint256 amount);
    event SharesRedeemed(address indexed user, address indexed market, uint8 winningOutcome, uint256 shares);
    event AMMBuy(address indexed user, address indexed market, uint8 outcome, uint256 shares, uint256 cost, uint256 unlockTime);
    event AMMSell(address indexed user, address indexed market, uint8 outcome, uint256 shares, uint256 proceeds);

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

        ISoothMarket mkt = ISoothMarket(market);
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
    
    function placeOrder(
        address market,
        uint8 outcome,
        uint256 price,
        uint256 amount
    ) external returns (uint256 orderId) {
        require(_isMarket[market], "TraderVault: invalid market");
        require(price > 0 && price < 1e18, "TraderVault: invalid price");
        require(amount > 0, "TraderVault: invalid amount");

        // Calculate cost
        uint256 rawCost = price * amount / 1e18;
        uint256 cost = rawCost / scalar;

        require(accounts[msg.sender].available >= cost, "TraderVault: insufficient balance");

        // Debit user
        accounts[msg.sender].available -= cost;

        // Create order on market
        orderId = ISoothMarket(market).createOrder(msg.sender, outcome, price, amount);

        emit OrderPlaced(msg.sender, market, orderId, outcome, price, amount);
    }

    function cancelOrder(address market, uint256 orderId) external {
        require(_isMarket[market], "TraderVault: invalid market");

        uint256 rawRefund = ISoothMarket(market).cancelOrder(orderId, msg.sender);
        uint256 refund = rawRefund / scalar;

        // Credit user immediately
        accounts[msg.sender].available += refund;

        emit OrderCancelled(msg.sender, market, orderId, refund);
    }

    // ============ View Functions ============
    
    function availableBalance(address user) external view returns (uint256) {
        return accounts[user].available;
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

    function asset() external view returns (IERC20) {
        return _asset;
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
        
        uint256 proceeds = amount / scalar;
        
        // V4: Merge is FREE (instant credit)
        accounts[user].available += proceeds;
        
        emit MergeCredit(user, proceeds);
    }

    /// @notice Redeem winning shares after market settlement
    function redeem(address market) external {
        require(_isMarket[market], "TraderVault: invalid market");
        
        ISoothMarket mkt = ISoothMarket(market);
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
        
        // Scale down and credit (1 share = $1)
        uint256 payout = shares / scalar;
        
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
