// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./SoothInterfaces.sol";

/// @notice ERC4626-compliant vault per (chain, adjudicatorClass).
/// @dev Tracks LP deposits as ERC20 share tokens and per-market locked exposure.
///      Implements full ERC4626 standard with decimals normalization for security.
contract SoothVault is ISoothVault, Ownable {
    IERC20 public immutable override asset;

    /// @notice Decimals scaling factor: 10^(18 - assetDecimals).
    /// @dev Used by RiskManager to normalize all collateral amounts to 18 decimals for pricing.
    uint256 public immutable decimalsScale;

    // --- ERC20 Share Token State ---
    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public totalSupply;
    
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    /// @notice Total underlying assets held by the vault.
    uint256 public override totalAssets;

    /// @notice Reserved exposure per marketId.
    mapping(uint256 => uint256) public lockedExposure;

    /// @notice Sum of all lockedExposure across markets.
    uint256 public totalLockedExposure;

    /// @notice Accumulated reserves (PnL) per marketId.
    mapping(uint256 => int256) public marketReserves;

    /// @notice Authorized spenders (markets + settlement).
    mapping(address => bool) public authorizedSpender;

    // --- Events ---
    event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
    event Withdraw(address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares);
    event ExposureAllocated(uint256 indexed marketId, uint256 amount);
    event ExposureReleased(uint256 indexed marketId, uint256 amount);
    event SettlementDeltaApplied(address indexed account, int256 pnlDelta);
    event AuthorizedSpenderSet(address indexed who, bool allowed);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event MarketFlow(uint256 indexed marketId, int256 amount, int256 newReserve);

    constructor(IERC20 _asset) {
        asset = _asset;
        
        // Read decimals and compute scaling factor
        // This prevents price attacks when using tokens with < 18 decimals
        uint8 assetDecimals = IERC20Metadata(address(_asset)).decimals();
        require(assetDecimals <= 18, "Vault: decimals > 18 not supported");
        
        // decimalsScale = 10^(18 - assetDecimals)
        // For 18-decimal tokens: scale = 1 (no scaling)
        // For 6-decimal tokens (USDC): scale = 10^12
        decimalsScale = 10 ** (18 - assetDecimals);

        // Initialize ERC20 metadata
        name = "Sooth Vault Shares";
        symbol = "svToken";
        decimals = assetDecimals; // Shares have same decimals as underlying asset
    }

    modifier onlyAuthorized() {
        require(authorizedSpender[msg.sender], "Vault: not authorized");
        _;
    }

    function setAuthorized(address who, bool allowed) external onlyOwner {
        authorizedSpender[who] = allowed;
        emit AuthorizedSpenderSet(who, allowed);
    }

    // --- ERC20 Functions ---

    function transfer(address to, uint256 amount) external returns (bool) {
        require(to != address(0), "Vault: transfer to zero address");
        require(balanceOf[msg.sender] >= amount, "Vault: insufficient balance");
        
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(to != address(0), "Vault: transfer to zero address");
        require(balanceOf[from] >= amount, "Vault: insufficient balance");
        
        uint256 allowed = allowance[from][msg.sender];
        if (msg.sender != from && allowed != type(uint256).max) {
            require(allowed >= amount, "Vault: insufficient allowance");
            allowance[from][msg.sender] = allowed - amount;
        }
        
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        
        emit Transfer(from, to, amount);
        return true;
    }

    // --- ERC4626 View Functions ---

    function maxDeposit(address) external pure returns (uint256) {
        return type(uint256).max; // No deposit limit
    }

    function maxMint(address) external pure returns (uint256) {
        return type(uint256).max;
    }

    function maxWithdraw(address owner) external view returns (uint256) {
        uint256 shares = balanceOf[owner];
        uint256 available = totalAssets > totalLockedExposure ? totalAssets - totalLockedExposure : 0;
        return shares > available ? available : shares; // 1:1 shares to assets
    }

    function maxRedeem(address owner) external view returns (uint256) {
        uint256 shares = balanceOf[owner];
        uint256 available = totalAssets > totalLockedExposure ? totalAssets - totalLockedExposure : 0;
        return shares > available ? available : shares;
    }

    function previewDeposit(uint256 assets) external pure returns (uint256) {
        return assets; // 1:1 conversion
    }

    function previewMint(uint256 shares) external pure returns (uint256) {
        return shares; // 1:1 conversion
    }

    function previewWithdraw(uint256 assets) external pure returns (uint256) {
        return assets; // 1:1 conversion
    }

    function previewRedeem(uint256 shares) external pure returns (uint256) {
        return shares; // 1:1 conversion
    }

    function convertToShares(uint256 assets) external pure returns (uint256) {
        return assets; // 1:1 conversion
    }

    function convertToAssets(uint256 shares) external pure returns (uint256) {
        return shares; // 1:1 conversion
    }

    // --- LP flows (ERC4626-compliant) ---

    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        require(assets > 0, "Vault: zero deposit");
        
        shares = assets; // 1:1 conversion
        
        asset.transferFrom(msg.sender, address(this), assets);
        
        balanceOf[receiver] += shares;
        totalSupply += shares;
        totalAssets += assets;
        
        emit Deposit(msg.sender, receiver, assets, shares);
        emit Transfer(address(0), receiver, shares);
        
        return shares;
    }

    function mint(uint256 shares, address receiver) external returns (uint256 assets) {
        require(shares > 0, "Vault: zero mint");
        
        assets = shares; // 1:1 conversion
        
        asset.transferFrom(msg.sender, address(this), assets);
        
        balanceOf[receiver] += shares;
        totalSupply += shares;
        totalAssets += assets;
        
        emit Deposit(msg.sender, receiver, assets, shares);
        emit Transfer(address(0), receiver, shares);
        
        return assets;
    }

    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares) {
        require(receiver != address(0), "Vault: zero receiver");
        require(assets > 0, "Vault: zero withdraw");
        
        shares = assets; // 1:1 conversion
        
        // Check allowance if caller is not owner
        if (msg.sender != owner) {
            uint256 allowed = allowance[owner][msg.sender];
            if (allowed != type(uint256).max) {
                require(allowed >= shares, "Vault: insufficient allowance");
                allowance[owner][msg.sender] = allowed - shares;
            }
        }
        
        require(balanceOf[owner] >= shares, "Vault: insufficient shares");
        require(totalAssets >= totalLockedExposure + assets, "Vault: locked");
        
        balanceOf[owner] -= shares;
        totalSupply -= shares;
        totalAssets -= assets;
        
        asset.transfer(receiver, assets);
        
        emit Withdraw(msg.sender, receiver, owner, assets, shares);
        emit Transfer(owner, address(0), shares);
        
        return shares;
    }

    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
        require(receiver != address(0), "Vault: zero receiver");
        require(shares > 0, "Vault: zero redeem");
        
        assets = shares; // 1:1 conversion
        
        // Check allowance if caller is not owner
        if (msg.sender != owner) {
            uint256 allowed = allowance[owner][msg.sender];
            if (allowed != type(uint256).max) {
                require(allowed >= shares, "Vault: insufficient allowance");
                allowance[owner][msg.sender] = allowed - shares;
            }
        }
        
        require(balanceOf[owner] >= shares, "Vault: insufficient shares");
        require(totalAssets >= totalLockedExposure + assets, "Vault: locked");
        
        balanceOf[owner] -= shares;
        totalSupply -= shares;
        totalAssets -= assets;
        
        asset.transfer(receiver, assets);
        
        emit Withdraw(msg.sender, receiver, owner, assets, shares);
        emit Transfer(owner, address(0), shares);
        
        return assets;
    }

    // --- Legacy interface for backward compatibility ---

    function depositFor(address lp, uint256 assets) external override returns (uint256) {
        require(assets > 0, "Vault: zero deposit");
        
        asset.transferFrom(msg.sender, address(this), assets);
        
        balanceOf[lp] += assets;
        totalSupply += assets;
        totalAssets += assets;
        
        emit Deposit(msg.sender, lp, assets, assets);
        emit Transfer(address(0), lp, assets);
        
        return assets;
    }

    function withdrawFor(address lp, uint256 assets, address receiver)
        external
        override
        returns (uint256)
    {
        require(receiver != address(0), "Vault: zero receiver");
        require(balanceOf[lp] >= assets, "Vault: insufficient shares");
        require(totalAssets >= totalLockedExposure + assets, "Vault: locked");

        balanceOf[lp] -= assets;
        totalSupply -= assets;
        totalAssets -= assets;
        
        asset.transfer(receiver, assets);
        
        emit Withdraw(msg.sender, receiver, lp, assets, assets);
        emit Transfer(lp, address(0), assets);
        
        return assets;
    }

    // --- Backward compatibility helper ---
    function balanceOfLP(address lp) external view returns (uint256) {
        return balanceOf[lp];
    }

    // --- Read helpers for RiskManager ---

    function getTreasuryBalance() external view override returns (uint256) {
        return totalAssets;
    }

    function getLiquidBufferBalance() external view override returns (uint256) {
        return totalAssets - totalLockedExposure;
    }

    // --- Exposure management ---

    function allocateExposure(uint256 marketId, uint256 amount) external override onlyAuthorized {
        lockedExposure[marketId] += amount;
        totalLockedExposure += amount;
        require(totalLockedExposure <= totalAssets, "Vault: overexposed");
        emit ExposureAllocated(marketId, amount);
    }

    function releaseExposure(uint256 marketId, uint256 amount) external override onlyAuthorized {
        uint256 locked = lockedExposure[marketId];
        if (amount > locked) {
            amount = locked;
        }
        lockedExposure[marketId] = locked - amount;
        totalLockedExposure -= amount;
        emit ExposureReleased(marketId, amount);
    }

    // --- Settlement PnL application ---

    function applySettlementDelta(uint256 marketId, address account, int256 pnlDelta)
        external
        override
        onlyAuthorized
    {
        if (pnlDelta > 0) {
            uint256 amount = uint256(pnlDelta);
            require(totalAssets >= amount, "Vault: insufficient assets");
            totalAssets -= amount;
            asset.transfer(account, amount);
        } else if (pnlDelta < 0) {
            uint256 amount = uint256(-pnlDelta);
            asset.transferFrom(account, address(this), amount);
            totalAssets += amount;
        }
        
        // Update market reserves: pnlDelta is user's PnL, so Vault's PnL is -pnlDelta
        marketReserves[marketId] -= pnlDelta;
        
        emit SettlementDeltaApplied(account, pnlDelta);
        emit MarketFlow(marketId, -pnlDelta, marketReserves[marketId]);
    }

    // --- Market Flow Tracking ---

    /// @notice Records market flow (trading P&L) without affecting totalAssets.
    /// @dev Market reserves represent UNREALIZED P&L and should not affect LP share value
    ///      until settlement. Only settlement realizes P&L and updates totalAssets.
    function recordMarketFlow(uint256 marketId, int256 amount, address user) external override onlyAuthorized {
        if (amount > 0) {
            // User pays Vault (unrealized profit for vault)
            uint256 pay = uint256(amount);
            asset.transferFrom(user, address(this), pay);
            // NOTE: totalAssets NOT modified - this is unrealized P&L
        } else if (amount < 0) {
            // Vault pays User (unrealized loss for vault)
            uint256 pay = uint256(-amount);
            // Check we have enough physical tokens (including unrealized reserves)
            require(asset.balanceOf(address(this)) >= pay, "Vault: insufficient balance");
            asset.transfer(user, pay);
            // NOTE: totalAssets NOT modified - this is unrealized P&L
        }
        
        // Track unrealized P&L separately from totalAssets
        marketReserves[marketId] += amount;
        emit MarketFlow(marketId, amount, marketReserves[marketId]);
    }

    function getMarketReserve(uint256 marketId) external view override returns (int256) {
        return marketReserves[marketId];
    }
}
