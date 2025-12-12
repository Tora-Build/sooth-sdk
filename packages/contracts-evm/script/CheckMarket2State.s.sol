// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/core/SoothTraderVaultV4.sol";
import "../contracts/core/SoothMarketV4.sol";

contract CheckMarket2State is Script {
    function run() external view {
        address marketAddress = 0xf3e12d55bF09dB5A3971C00d7F393255c7C096D4;
        address vaultAddress = 0xAd461C1c55bf552756Ad29Ac96f341A1fC007176;
        address user = 0xEfdB15EE6e7C7C7906cb230AfF1EDb75CcBaA74F;

        SoothMarketV4 market = SoothMarketV4(marketAddress);
        SoothTraderVaultV4 vault = SoothTraderVaultV4(vaultAddress);
        
        uint256 nextId = market.nextOrderId();
        console.log("Market:", marketAddress);
        console.log("Next Order ID:", nextId);
        
        if (nextId > 1) {
            uint256 lastId = nextId - 1;
            SoothMarketV4.OrderV4 memory o = market.orders(lastId);
            console.log("Last Order ID:", lastId);
            console.log("  Maker:", o.maker);
            console.log("  Amount:", o.amount);
            console.log("  Price:", o.yesPrice);
            console.log("  IsBuy:", o.isBuySide);
        }

        // Check Balances
        uint256 available = vault.availableBalance(user);
        uint256 sharesYes = vault.shareBalances(user, marketAddress, 0);
        uint256 sharesNo = vault.shareBalances(user, marketAddress, 1);

        console.log("User:", user);
        console.log("Vault Available USDC:", available);
        console.log("Vault Shares YES:", sharesYes);
        console.log("Vault Shares NO:", sharesNo);
    }
}
