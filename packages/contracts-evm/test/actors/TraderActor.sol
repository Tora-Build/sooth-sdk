// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../contracts/core/SoothTraderVaultV4.sol";
import "../../contracts/launchpad/LaunchpadMarket.sol";
import "../../contracts/core/SoothInterfaces.sol";

/// @title Trader Actor for Invariant Testing
/// @notice Simulates trader behavior for fuzz/invariant tests
contract TraderActor {
    SoothTraderVaultV4 public vault;
    LaunchpadMarket public market;
    IERC20 public usdc;
    
    constructor(SoothTraderVaultV4 _vault, LaunchpadMarket _market, IERC20 _usdc) {
        vault = _vault;
        market = _market;
        usdc = _usdc;
        
        // Approve vault for deposits
        usdc.approve(address(_vault), type(uint256).max);
    }
    
    // ============ Actions ============
    
    /// @notice Deposit USDC into vault
    function deposit(uint256 amount) external {
        uint256 balance = usdc.balanceOf(address(this));
        if (amount > balance) amount = balance;
        if (amount == 0) return;
        
        vault.deposit(amount);
    }
    
    /// @notice Withdraw USDC from vault
    function withdraw(uint256 amount) external {
        uint256 available = vault.availableBalance(address(this));
        if (amount > available) amount = available;
        if (amount == 0) return;
        
        vault.withdraw(amount);
    }
    
    /// @notice Buy YES shares via AMM
    function buyYes(uint256 shares) external {
        if (shares == 0) return;
        
        // Bound shares to reasonable amount
        if (shares > 1000e18) shares = 1000e18;
        
        uint256 available = vault.availableBalance(address(this));
        if (available < 10e18) return; // Need minimum balance
        
        try vault.tradeAMM(address(market), 0, int256(shares), int256(available)) {
            // Success
        } catch {
            // Ignore failures (slippage, insufficient balance, etc.)
        }
    }
    
    /// @notice Buy NO shares via AMM
    function buyNo(uint256 shares) external {
        if (shares == 0) return;
        if (shares > 1000e18) shares = 1000e18;
        
        uint256 available = vault.availableBalance(address(this));
        if (available < 10e18) return;
        
        try vault.tradeAMM(address(market), 1, int256(shares), int256(available)) {
            // Success
        } catch {
            // Ignore failures
        }
    }
    
    /// @notice Sell YES shares via AMM
    function sellYes(uint256 shares) external {
        (uint256 yesBalance, , , ) = vault.getAMMPosition(address(this), address(market));
        if (shares > yesBalance) shares = yesBalance;
        if (shares == 0) return;
        
        try vault.tradeAMM(address(market), 0, -int256(shares), 0) {
            // Success - proceeds locked
        } catch {
            // Ignore failures
        }
    }
    
    /// @notice Sell NO shares via AMM
    function sellNo(uint256 shares) external {
        (, uint256 noBalance, , ) = vault.getAMMPosition(address(this), address(market));
        if (shares > noBalance) shares = noBalance;
        if (shares == 0) return;
        
        try vault.tradeAMM(address(market), 1, -int256(shares), 0) {
            // Success - proceeds locked
        } catch {
            // Ignore failures
        }
    }
    
    /// @notice Claim unlocked proceeds
    function claimUnlocked() external {
        try vault.claimUnlocked() {
            // Success
        } catch {
            // Nothing to claim or still locked
        }
    }
    
    /// @notice Place limit buy order
    function placeBuyOrder(uint256 price, uint256 amount) external {
        if (price == 0 || price >= 1e18) return;
        if (amount == 0 || amount > 1000) return;
        
        uint256 available = vault.availableBalance(address(this));
        uint256 collateral = (price * amount) / 1e18;
        if (available < collateral) return;
        
        try vault.placeOrder(address(market), 0, price, amount, true) {
            // Success
        } catch {
            // Ignore failures
        }
    }
    
    // ============ View Helpers ============
    
    function getAvailable() external view returns (uint256) {
        return vault.availableBalance(address(this));
    }
    
    function getLocked() external view returns (uint256) {
        return vault.lockedBalance(address(this));
    }
    
    function getYesShares() external view returns (uint256) {
        (uint256 yes, , , ) = vault.getAMMPosition(address(this), address(market));
        return yes;
    }
    
    function getNoShares() external view returns (uint256) {
        (, uint256 no, , ) = vault.getAMMPosition(address(this), address(market));
        return no;
    }
}
