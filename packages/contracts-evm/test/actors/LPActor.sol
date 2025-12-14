// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../contracts/core/SoothGovernorVault.sol";
import "../../contracts/core/SoothInterfaces.sol";

/// @title LP Actor for Multi-Role Testing
/// @notice Simulates liquidity provider behavior
contract LPActor {
    SoothGovernorVault public governor;
    IERC20 public usdc;
    uint256 public depositedShares;
    
    constructor(SoothGovernorVault _governor, IERC20 _usdc) {
        governor = _governor;
        usdc = _usdc;
        usdc.approve(address(_governor), type(uint256).max);
    }
    
    /// @notice Deposit USDC to become LP
    function deposit(uint256 amount) external returns (uint256 shares) {
        uint256 balance = usdc.balanceOf(address(this));
        if (amount > balance) amount = balance;
        if (amount == 0) return 0;
        
        shares = governor.depositFor(address(this), amount);
        depositedShares += shares;
        return shares;
    }
    
    /// @notice Withdraw USDC (by asset amount)
    function withdraw(uint256 assets) external returns (uint256 sharesBurned) {
        if (assets == 0) return 0;
        
        try governor.withdrawFor(address(this), assets, address(this)) returns (uint256 burned) {
            sharesBurned = burned;
            if (depositedShares >= burned) depositedShares -= burned;
        } catch {
            // May fail if funds locked
        }
    }
    
    /// @notice Get tracked LP shares
    function getShares() external view returns (uint256) {
        return depositedShares;
    }
}
