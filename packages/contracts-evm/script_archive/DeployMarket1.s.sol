// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/core/SoothMarketV4.sol";
import "../contracts/core/OutcomeToken.sol";
import "../contracts/core/SoothGovernorVault.sol";
import "../contracts/core/SoothTraderVaultV4.sol";

/// @title DeployMarket1
/// @notice Deploy Market 1: Trump 2024 Win
contract DeployMarket1 is Script {
    address constant GOVERNOR_VAULT = 0x0C96BcCa40f5D45D0a000C91276E3b5ac3A45e6f;
    address constant TRADER_VAULT = 0xee91e05f95cBaACD46f58432DF72CB5C451e98E0;
    address constant FEE_CONTROLLER = 0xa367B312Ca1845B7c6076345cB5cd529F935B4FA;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        vm.startBroadcast(deployerPrivateKey);

        SoothGovernorVault governorVault = SoothGovernorVault(GOVERNOR_VAULT);
        SoothTraderVaultV4 traderVault = SoothTraderVaultV4(TRADER_VAULT);

        OutcomeToken outcomeToken = new OutcomeToken();
        SoothMarketV4 market = new SoothMarketV4();
        
        outcomeToken.initialize(address(market), TRADER_VAULT);
        market.initialize(1, GOVERNOR_VAULT, TRADER_VAULT, FEE_CONTROLLER, address(outcomeToken), bytes32(0), 10_000 * 1e18, deployer, 500);
        
        traderVault.setMarket(address(market), true);
        governorVault.setAuthorized(address(market), true);
        
        console.log("Market 1 (Trump 2024):", address(market));
        console.log("OutcomeToken:", address(outcomeToken));
        vm.stopBroadcast();
    }
}
