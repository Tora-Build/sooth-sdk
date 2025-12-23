// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ITraderVaultLite} from "./interfaces/ITraderVaultLite.sol";

/**
 * @title TraderVaultLite
 * @notice Minimal USDC custody vault for V8 architecture
 * @dev Logicless vault - only handles deposits and withdrawals
 *      All trading logic is delegated to AMM Engine and TickBook
 */
contract TraderVaultLite is ITraderVaultLite {
    using SafeERC20 for IERC20;

    // ============================================
    // State Variables
    // ============================================

    /// @notice USDC token address
    address public immutable assetAddress;
    
    /// @notice USDC token interface
    IERC20 private immutable _asset;

    /// @notice User balances (user => USDC balance in WAD)
    mapping(address => uint256) private _balances;

    /// @notice Total USDC held in vault
    uint256 private _totalAssets;

    // ============================================
    // Constructor
    // ============================================

    /**
     * @notice Initialize vault with USDC address
     * @param usdc USDC token address
     */
    constructor(address usdc) {
        require(usdc != address(0), "TraderVaultLite: zero address");
        assetAddress = usdc;
        _asset = IERC20(usdc);
    }
    
    /**
     * @inheritdoc ITraderVaultLite
     */
    function asset() external view override returns (address) {
        return assetAddress;
    }

    // ============================================
    // Deposit/Withdraw
    // ============================================

    /**
     * @inheritdoc ITraderVaultLite
     */
    function deposit(uint256 amount) external override {
        require(amount > 0, "TraderVaultLite: zero amount");

        // Transfer USDC from user
        _asset.safeTransferFrom(msg.sender, address(this), amount);

        // Update balances
        _balances[msg.sender] += amount;
        _totalAssets += amount;

        emit Deposited(msg.sender, amount);
    }

    /**
     * @inheritdoc ITraderVaultLite
     */
    function withdraw(uint256 amount) external override {
        require(amount > 0, "TraderVaultLite: zero amount");
        require(_balances[msg.sender] >= amount, "TraderVaultLite: insufficient balance");

        // Update balances
        _balances[msg.sender] -= amount;
        _totalAssets -= amount;

        // Transfer USDC to user
        _asset.safeTransfer(msg.sender, amount);

        emit Withdrawn(msg.sender, amount);
    }

    // ============================================
    // View Functions
    // ============================================

    /**
     * @inheritdoc ITraderVaultLite
     */
    function balanceOf(address user) external view override returns (uint256) {
        return _balances[user];
    }

    /**
     * @inheritdoc ITraderVaultLite
     */
    function totalAssets() external view override returns (uint256) {
        return _totalAssets;
    }
}
