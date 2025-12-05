// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./SoothInterfaces.sol";

/// @notice Singleton Trader Vault for managing user funds and positions.
/// @dev Handles deposits, withdrawals, and proxies trades to markets.
///      Tracks free balances and locked collateral for orderbook positions.
contract SoothTraderVault is ISoothTraderVault, Ownable {
    IERC20 public immutable asset; // USDC
    
    // --- User State ---
    mapping(address => uint256) public shares;           // Free balance (1:1 with USDC)
    mapping(address => uint256) public lockedCollateral; // Locked in orders
    
    // --- Protocol State ---
    address public governorVault;
    mapping(address => bool) public isMarket; // Whitelisted markets

    // --- Events ---
    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event CollateralLocked(address indexed user, uint256 amount);
    event CollateralUnlocked(address indexed user, uint256 amount);
    event MarketSet(address indexed market, bool enabled);
    event GovernorVaultSet(address indexed governor);

    constructor(IERC20 _asset) {
        asset = _asset;
    }

    // --- Admin Functions ---

    function setMarket(address market, bool enabled) external onlyOwner {
        isMarket[market] = enabled;
        emit MarketSet(market, enabled);
    }

    function setGovernorVault(address _governor) external onlyOwner {
        governorVault = _governor;
        emit GovernorVaultSet(_governor);
    }

    // --- User Actions ---

    function deposit(uint256 amount) external override returns (uint256) {
        require(amount > 0, "TraderVault: zero deposit");
        
        // Transfer USDC from user to this vault
        require(asset.transferFrom(msg.sender, address(this), amount), "TraderVault: transfer failed");
        
        shares[msg.sender] += amount;
        emit Deposit(msg.sender, amount);
        
        return amount;
    }

    function withdraw(uint256 amount) external override returns (uint256) {
        require(amount > 0, "TraderVault: zero withdraw");
        require(shares[msg.sender] >= amount, "TraderVault: insufficient free balance");
        
        shares[msg.sender] -= amount;
        
        require(asset.transfer(msg.sender, amount), "TraderVault: transfer failed");
        emit Withdraw(msg.sender, amount);
        
        return amount;
    }

    // --- Market Callbacks (Restricted) ---

    modifier onlyMarket() {
        require(isMarket[msg.sender], "TraderVault: caller not market");
        _;
    }

    function lockCollateral(address user, uint256 amount) external override onlyMarket {
        require(shares[user] >= amount, "TraderVault: insufficient free balance");
        shares[user] -= amount;
        lockedCollateral[user] += amount;
        emit CollateralLocked(user, amount);
    }

    function unlockCollateral(address user, uint256 amount) external override onlyMarket {
        require(lockedCollateral[user] >= amount, "TraderVault: insufficient locked");
        lockedCollateral[user] -= amount;
        shares[user] += amount;
        emit CollateralUnlocked(user, amount);
    }

    /// @notice User buys from AMM (User pays Governor)
    function payToGovernor(address user, uint256 amount) external override onlyMarket {
        require(shares[user] >= amount, "TraderVault: insufficient free balance");
        
        shares[user] -= amount;
        
        // Transfer USDC to Governor Vault
        require(asset.transfer(governorVault, amount), "TraderVault: transfer to governor failed");
    }

    /// @notice User sells to AMM (Governor pays User)
    function receiveFromGovernor(address user, uint256 amount) external override onlyMarket {
        // Funds should have been sent to this contract by GovernorVault BEFORE calling this
        // Or GovernorVault calls depositFor?
        // Pattern: GovernorVault transfers to TraderVault, then Market calls this to credit user?
        // Better: Market calls GovernorVault to pay TraderVault, then calls this to credit user.
        
        shares[user] += amount;
    }

    /// @notice Orderbook Match: Maker (Locked) pays Taker (Free)
    /// @dev Used when Taker Sells to a Maker who was Shorting the other side.
    ///      Maker's locked collateral is transferred to Taker's free balance.
    function transferLockedToUser(address from, address to, uint256 amount) external override onlyMarket {
        require(lockedCollateral[from] >= amount, "TraderVault: insufficient locked");
        lockedCollateral[from] -= amount;
        shares[to] += amount;
        emit CollateralUnlocked(from, amount); // Reusing event or new one?
        // Maybe emit TransferLocked(from, to, amount)?
        // For now, CollateralUnlocked implies it left locked state.
    }

    /// @notice Generic transfer between users (Free -> Free)
    /// @dev Not strictly used in current Orderbook logic but good for flexibility
    function transferBetweenUsers(address from, address to, uint256 amount) external override onlyMarket {
        require(shares[from] >= amount, "TraderVault: insufficient balance");
        shares[from] -= amount;
        shares[to] += amount;
    }
}
