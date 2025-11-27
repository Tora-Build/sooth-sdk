// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./SoothInterfaces.sol";

/// @notice Singleton vault per (chain, adjudicatorClass).
/// @dev Tracks LP deposits and per-market locked exposure.
///      This is a simplified, non-ERC4626 implementation for dev/testing.
contract SoothVault is ISoothVault, Ownable {
    IERC20 public immutable override asset;

    /// @notice LP share balances (1:1 with underlying asset in this reference).
    mapping(address => uint256) public balanceOfLP;

    /// @notice Total underlying assets held by the vault.
    uint256 public override totalAssets;

    /// @notice Reserved exposure per marketId.
    mapping(uint256 => uint256) public lockedExposure;

    /// @notice Sum of all lockedExposure across markets.
    uint256 public totalLockedExposure;

    /// @notice Authorized spenders (markets + settlement).
    mapping(address => bool) public authorizedSpender;

    event Deposit(address indexed lp, uint256 assets);
    event Withdraw(address indexed lp, uint256 assets, address indexed receiver);
    event ExposureAllocated(uint256 indexed marketId, uint256 amount);
    event ExposureReleased(uint256 indexed marketId, uint256 amount);
    event SettlementDeltaApplied(address indexed account, int256 pnlDelta);
    event AuthorizedSpenderSet(address indexed who, bool allowed);

    constructor(IERC20 _asset) {
        asset = _asset;
    }

    modifier onlyAuthorized() {
        require(authorizedSpender[msg.sender], "Vault: not authorized");
        _;
    }

    function setAuthorized(address who, bool allowed) external onlyOwner {
        authorizedSpender[who] = allowed;
        emit AuthorizedSpenderSet(who, allowed);
    }

    // --- LP flows ---

    function depositFor(address lp, uint256 assets) external override returns (uint256) {
        require(assets > 0, "Vault: zero deposit");
        asset.transferFrom(msg.sender, address(this), assets);
        balanceOfLP[lp] += assets;
        totalAssets += assets;
        emit Deposit(lp, assets);
        return assets;
    }

    function withdrawFor(address lp, uint256 assets, address receiver)
        external
        override
        returns (uint256)
    {
        require(receiver != address(0), "Vault: zero receiver");
        require(balanceOfLP[lp] >= assets, "Vault: insufficient shares");
        require(totalAssets >= totalLockedExposure + assets, "Vault: locked");

        balanceOfLP[lp] -= assets;
        totalAssets -= assets;
        asset.transfer(receiver, assets);
        emit Withdraw(lp, assets, receiver);
        return assets;
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

    function applySettlementDelta(address account, int256 pnlDelta)
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
        emit SettlementDeltaApplied(account, pnlDelta);
    }
}
