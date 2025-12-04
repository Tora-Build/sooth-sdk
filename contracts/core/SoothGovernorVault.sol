// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./SoothInterfaces.sol";

/// @notice Governor Vault for LP liquidity management.
/// @dev Simplified architecture: No RiskManager, manual b management.
///      Acts as a pool for LP funds and counterparty for AMM trades.
contract SoothGovernorVault is ISoothGovernorVault, Ownable {
    IERC20 public immutable override asset;
    uint256 public immutable override decimalsScale;

    // --- LP Share State ---
    string public name = "Sooth LP Shares";
    string public symbol = "sLP";
    uint8 public decimals;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    
    // --- Asset Tracking ---
    uint256 public override totalAssets; 
    
    // --- Market State ---
    mapping(uint256 => int256) public marketReserves; // PnL per market
    mapping(uint256 => uint256) public lockedExposure; // Max loss allocated
    uint256 public totalLockedExposure;

    mapping(address => bool) public authorizedSpender;

    // --- Events ---
    event Deposit(address indexed lp, uint256 assets, uint256 shares);
    event Withdraw(address indexed lp, uint256 assets, uint256 shares);
    event MarketFlow(uint256 indexed marketId, int256 amount, int256 newReserve);
    event AuthorizedSet(address indexed who, bool allowed);
    event ExposureAllocated(uint256 indexed marketId, uint256 amount);
    event ExposureReleased(uint256 indexed marketId, uint256 amount);

    constructor(IERC20 _asset) {
        asset = _asset;
        uint8 assetDecimals = IERC20Metadata(address(_asset)).decimals();
        decimals = assetDecimals;
        decimalsScale = 10 ** (18 - assetDecimals);
    }

    modifier onlyAuthorized() {
        require(authorizedSpender[msg.sender], "GovernorVault: not authorized");
        _;
    }

    function setAuthorized(address who, bool allowed) external onlyOwner {
        authorizedSpender[who] = allowed;
        emit AuthorizedSet(who, allowed);
    }

    // --- LP Actions ---

    function depositFor(address lp, uint256 assets) external override returns (uint256) {
        require(assets > 0, "Zero deposit");
        
        uint256 shares;
        if (totalSupply == 0) {
            shares = assets;
        } else {
            shares = assets * totalSupply / totalAssets;
        }

        require(asset.transferFrom(msg.sender, address(this), assets), "Transfer failed");
        
        balanceOf[lp] += shares;
        totalSupply += shares;
        totalAssets += assets;
        
        emit Deposit(lp, assets, shares);
        return shares;
    }

    function withdrawFor(address lp, uint256 assets, address receiver) external override returns (uint256) {
        require(assets > 0, "Zero withdraw");
        
        uint256 shares;
        if (totalAssets == 0) {
            shares = assets;
        } else {
            shares = assets * totalSupply / totalAssets;
        }
        
        require(balanceOf[lp] >= shares, "Insufficient shares");
        require(totalAssets >= totalLockedExposure + assets, "Locked funds");

        balanceOf[lp] -= shares;
        totalSupply -= shares;
        totalAssets -= assets;
        
        require(asset.transfer(receiver, assets), "Transfer failed");
        
        emit Withdraw(lp, assets, shares);
        return shares;
    }

    // --- Market Actions ---

    function allocateExposure(uint256 marketId, uint256 amount) external override onlyAuthorized {
        lockedExposure[marketId] += amount;
        totalLockedExposure += amount;
        require(totalLockedExposure <= totalAssets, "Overexposed");
        emit ExposureAllocated(marketId, amount);
    }

    function releaseExposure(uint256 marketId, uint256 amount) external override onlyAuthorized {
        if (amount > lockedExposure[marketId]) amount = lockedExposure[marketId];
        lockedExposure[marketId] -= amount;
        totalLockedExposure -= amount;
        emit ExposureReleased(marketId, amount);
    }

    /// @notice Called when Market/TraderVault sends funds (Profit)
    function receiveFunds(uint256 marketId, uint256 amount) external override onlyAuthorized {
        // Funds assumed to be transferred already (Push model)
        // We trust the authorized caller to have sent the funds
        marketReserves[marketId] += int256(amount);
        totalAssets += amount; 
        emit MarketFlow(marketId, int256(amount), marketReserves[marketId]);
    }

    /// @notice Called when Market requests payment (Loss/Settlement)
    function sendFunds(uint256 marketId, address recipient, uint256 amount) external override onlyAuthorized {
        require(totalAssets >= amount, "Insufficient assets");
        
        marketReserves[marketId] -= int256(amount);
        totalAssets -= amount;
        
        require(asset.transfer(recipient, amount), "Transfer failed");
        emit MarketFlow(marketId, -int256(amount), marketReserves[marketId]);
    }

    function getMarketReserve(uint256 marketId) external view override returns (int256) {
        return marketReserves[marketId];
    }
}
