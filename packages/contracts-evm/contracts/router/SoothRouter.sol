// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/ISoothTraderVault.sol";
import "../interfaces/ISoothMarket.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";

/// @title SoothRouter
/// @notice Helper for atomic Hybrid Execution (Orderbook + AMM)
contract SoothRouter is ERC1155Holder {
    using SafeERC20 for IERC20;

    ISoothTraderVault public immutable traderVault;
    IERC20 public immutable usdc;

    struct RouteParams {
        uint256 amountToBook;
        uint256 amountToAMM;
        uint256 limitPrice; // 1e18
        uint256 minOutput;  // Slippage protection needed?
    }

    constructor(address _traderVault) {
        traderVault = ISoothTraderVault(_traderVault);
        usdc = IERC20(traderVault.asset());
        
        // Infinite approve TraderVault for USDC (for trading)
        usdc.forceApprove(_traderVault, type(uint256).max);
    }

    /// @notice Execute a Hybrid Order (Atomic Split)
    /// @dev Requires user to approve USDC to Router
    /// @param market The market address
    /// @param outcome The outcome to buy (0=YES, 1=NO)
    /// @param params Routing parameters
    function executeHybridOrder(
        address market,
        uint8 outcome,
        RouteParams calldata params
    ) external returns (uint256 totalShares) {
        uint256 totalCost = 0;
        
        // 1. Pull USDC from user
        // We need to estimate max cost roughly or pull precise amounts?
        // Simpler: Pull generous amount, refund remainder.
        // Cost = (amountBook * price) + (amountAMM * ~price)
        // Let's rely on transferFrom in the loop? No, vault pulls from msg.sender (Router)
        
        // For simplicity, we calculate expected max cost + buffer
        uint256 maxCostBook = (params.amountToBook * params.limitPrice) / 1e18;
        uint256 maxCostAMM = (params.amountToAMM * 1e18) / 1e18; // Worst case 1.0 price
        uint256 rawPullAmount = maxCostBook + maxCostAMM;

        // Scale down to Asset Decimals
        uint8 assetDecimals = 18;
        try IERC20Metadata(address(usdc)).decimals() returns (uint8 d) {
            assetDecimals = d;
        } catch {}

        uint256 pullAmount = rawPullAmount;
        if (assetDecimals < 18) {
            uint256 scale = 10**(18 - assetDecimals);
            // Add buffer for rounding?
            pullAmount = (rawPullAmount + (scale - 1)) / scale; 
        }

        usdc.safeTransferFrom(msg.sender, address(this), pullAmount);

        // Deposit into Vault so Router has trading capacity
        traderVault.deposit(pullAmount);

        // 2. Execute Orderbook Portion
        if (params.amountToBook > 0) {
            uint256 orderId = traderVault.placeOrder(
                market,
                outcome,
                params.limitPrice, 
                params.amountToBook
            );
            
            // The order might fill immediately or rest. 
            // If it rests, Router owns the order.
            // Requirement: Hybrid execution implies proactive hitting of resting orders.
            // If it doesn't fill immediately, we cancel it? 
            // Or we transfer the order ownership? (Vault doesn't support order transfer)
            
            // Constraint: This Router is for TAKING liquidity.
            // If it rests, it failed to take.
            // We should cancel immediately if not filled?
            // "Fill or Kill" logic for book portion effectively.
            
            ISoothMarket mkt = ISoothMarket(market);
            ISoothMarket.OrderV3 memory o = mkt.orders(orderId);
            
            if (o.amount > 0) {
                // It didn't fully fill. Cancel remainder.
                // Note: cancelOrder takes market, orderId. Vault wraps it.
                traderVault.cancelOrder(market, orderId);
                // Refund adds to 'available' balance in Vault
                // We'll withdraw it at the end
            }
            
            // Calculate filled amount
            uint256 filled = params.amountToBook - o.amount;
            if (filled > 0) {
                totalShares += filled;
                // Shares are now in Router's Vault Account (internal balance)
                // We need to transfer them to User
                traderVault.transferShares(market, msg.sender, outcome, filled);
            }
        }

        // 3. Execute AMM Portion
        if (params.amountToAMM > 0) {
            int256 delta = int256(params.amountToAMM); // Buying is positive
            
            // Trade
            traderVault.tradeAMM(
                market,
                outcome,
                delta,
                int256(maxCostAMM) // Max cost
            );
            
            totalShares += params.amountToAMM;
            // Transfer shares to User
            traderVault.transferShares(market, msg.sender, outcome, params.amountToAMM);
        }

        // 4. Refund unused USDC
        // Vault 'available' balance might have increased from cancel refund or trade change
        uint256 vaultBal = traderVault.availableBalance(address(this));
        if (vaultBal > 0) {
            traderVault.withdraw(vaultBal); // Move from Vault -> Router
        }
        
        uint256 routerBal = usdc.balanceOf(address(this));
        if (routerBal > 0) {
            usdc.safeTransfer(msg.sender, routerBal);
        }
    }
}
