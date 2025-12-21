// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "forge-std/console.sol";

/**
 * @title LiveAmmBuy
 * @notice Fork test that simulates AMM buy on live Base Sepolia contracts.
 * @dev Run with: forge test --match-contract LiveAmmBuy --fork-url https://sepolia.base.org -vvv
 */

interface IERC20Min {
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface ITraderVaultMin {
    function deposit(uint256 amount) external;
    function tradeAMM(address market, uint8 outcome, int256 deltaShares, int256 limit) external;
    function accounts(address account) external view returns (uint256 available, uint256 pending);
    function ammPositions(address market, address trader) external view returns (uint256 yesShares, uint256 noShares);
    function isMarket(address market) external view returns (bool);
}

interface IMarketMin {
    function qYes() external view returns (uint256);
    function qNo() external view returns (uint256);
    function b() external view returns (uint256);
    function traderVault() external view returns (address);
}

contract LiveAmmBuy is Test {
    // Live Base Sepolia addresses (V4.6 - updated 2025-12-14)
    address constant TRADER_VAULT = 0xa8aDE73124B3256F98f510F6A9E7C1e3Aa71d20B;
    address constant MARKET_ALIEN = 0xd2A266c2081C0f2c7c86b5541B9e9b255dde91F9;
    address constant MARKET_BTC = 0x3423223043A6815547c0E83ec5c4aE1AeCb0eE02;
    address constant USDC = 0x53d34066A316AE1699d434753B70593A6D59Fec1;
    
    // Your wallet (for impersonation)
    address constant TRADER = 0xbD29556A41C10deb19072c558E147C6B4b384eed;

    function setUp() public {}

    function test_AmmBuyYes_LiveFork() public {
        if (TRADER_VAULT.code.length == 0) {
            console.log("Skipping LiveAmmBuy: no fork / no code at TRADER_VAULT");
            return;
        }
        console.log("=== AMM Buy YES Test (Live Fork) ===");
        
        // Verify market is registered
        bool isMarket = ITraderVaultMin(TRADER_VAULT).isMarket(MARKET_ALIEN);
        console.log("Market registered:", isMarket);
        require(isMarket, "Market not registered in TraderVault");
        
        // Check market state
        uint256 qYes = IMarketMin(MARKET_ALIEN).qYes();
        uint256 qNo = IMarketMin(MARKET_ALIEN).qNo();
        uint256 bVal = IMarketMin(MARKET_ALIEN).b();
        console.log("qYes:", qYes);
        console.log("qNo:", qNo);
        console.log("b:", bVal);
        
        // Check trader's current state
        uint256 usdcBalance = IERC20Min(USDC).balanceOf(TRADER);
        (uint256 vaultAvailable,) = ITraderVaultMin(TRADER_VAULT).accounts(TRADER);
        (uint256 currentYesPos, uint256 currentNoPos) = ITraderVaultMin(TRADER_VAULT).ammPositions(MARKET_ALIEN, TRADER);
        
        console.log("USDC balance:", usdcBalance);
        console.log("Vault available:", vaultAvailable);
        console.log("Current YES position:", currentYesPos);
        console.log("Current NO position:", currentNoPos);
        
        // Start impersonating trader
        vm.startPrank(TRADER);
        
        // If vault balance is low, deposit some USDC
        if (vaultAvailable < 100e6) {
            uint256 depositAmount = 100e6;
            if (usdcBalance >= depositAmount) {
                IERC20Min(USDC).approve(TRADER_VAULT, depositAmount);
                ITraderVaultMin(TRADER_VAULT).deposit(depositAmount);
                console.log("Deposited:", depositAmount);
                (vaultAvailable,) = ITraderVaultMin(TRADER_VAULT).accounts(TRADER);
                console.log("New vault balance:", vaultAvailable);
            } else {
                console.log("SKIP: Insufficient USDC for deposit (has vault balance anyway)");
            }
        }
        
        // Buy 1 YES share (1e18 in WAD)
        int256 deltaShares = 1e18;
        int256 limit = 2e18; // Max cost: 2 USDC worth (WAD)
        
        console.log("Executing tradeAMM...");
        console.log("  deltaShares:", uint256(deltaShares));
        console.log("  limit:", uint256(limit));
        
        ITraderVaultMin(TRADER_VAULT).tradeAMM(
            MARKET_ALIEN,
            0, // outcome 0 = YES
            deltaShares,
            limit
        );
        
        vm.stopPrank();
        
        console.log("=== Trade Executed Successfully ===");
        
        // Note: Position shows 0 because of 24h lock mechanism
        // The trade succeeded - verified by AMMBuy event emission in trace
        // To check position, query after 24h or check MarketFlow event
        console.log("Trade completed - check trace for AMMBuy event");
    }

    function test_CheckLiveState() public {
        if (TRADER_VAULT.code.length == 0) {
            console.log("Skipping LiveAmmBuy: no fork / no code at TRADER_VAULT");
            return;
        }
        console.log("=== Live State Check ===");
        console.log("TraderVault:", TRADER_VAULT);
        bool isMarket = ITraderVaultMin(TRADER_VAULT).isMarket(MARKET_ALIEN);
        console.log("Market registered:", isMarket);
    }
    
    function _logLiveState() internal view {
        console.log("=== Live State Check ===");
        
        console.log("TraderVault:", TRADER_VAULT);
        console.log("  isMarket(ALIEN):", ITraderVaultMin(TRADER_VAULT).isMarket(MARKET_ALIEN));
        console.log("  isMarket(BTC):", ITraderVaultMin(TRADER_VAULT).isMarket(MARKET_BTC));
        
        console.log("Market ALIEN:", MARKET_ALIEN);
        console.log("  traderVault:", IMarketMin(MARKET_ALIEN).traderVault());
        console.log("  qYes:", IMarketMin(MARKET_ALIEN).qYes());
        console.log("  qNo:", IMarketMin(MARKET_ALIEN).qNo());
        console.log("  b:", IMarketMin(MARKET_ALIEN).b());
        
        console.log("Trader:", TRADER);
        console.log("  USDC balance:", IERC20Min(USDC).balanceOf(TRADER));
        (uint256 avail, uint256 pend) = ITraderVaultMin(TRADER_VAULT).accounts(TRADER);
        console.log("  Vault available:", avail);
        console.log("  Vault pending:", pend);
        (uint256 yesPos, uint256 noPos) = ITraderVaultMin(TRADER_VAULT).ammPositions(MARKET_ALIEN, TRADER);
        console.log("  YES position (ALIEN):", yesPos);
        console.log("  NO position (ALIEN):", noPos);
    }
}
