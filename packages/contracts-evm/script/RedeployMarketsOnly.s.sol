// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/core/SoothMarketV4.sol";
import "../contracts/core/OutcomeToken.sol";
import "../contracts/core/SoothGovernorVault.sol";
import "../contracts/core/SoothTraderVaultV4.sol";

contract RedeployMarketsOnly is Script {
    // Current addresses from deployments.json
    address constant GOVERNOR_VAULT = 0x6c60D3e25FEf9AECf3DC2F66287322641D8651Be;
    address constant TRADER_VAULT = 0x8348A02D742e59B2ad9fe7Bfe354fAE01176d17d;
    address constant FEE_CONTROLLER = 0x2300BBe091E5176410eCcb3c3710ef67781B68ff;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        vm.startBroadcast(deployerPrivateKey);

        console.log("=== Redeploying All Markets (Fix Ghost Order) ===");
        console.log("TraderVault:", TRADER_VAULT);
        console.log("GovernorVault:", GOVERNOR_VAULT);
        
        SoothGovernorVault governorVault = SoothGovernorVault(GOVERNOR_VAULT);
        SoothTraderVaultV4 traderVault = SoothTraderVaultV4(TRADER_VAULT);

        // --- Market 1: Alien Life ---
        OutcomeToken outcomeToken1 = new OutcomeToken();
        SoothMarketV4 market1 = new SoothMarketV4();
        
        outcomeToken1.initialize(address(market1), TRADER_VAULT);
        market1.initialize(
            1, GOVERNOR_VAULT, TRADER_VAULT, FEE_CONTROLLER,
            address(outcomeToken1), bytes32(0), 10_000e18, deployer, 0, 0
        );
        traderVault.setMarket(address(market1), true);
        governorVault.setAuthorized(address(market1), true);

        console.log("NEW Market 1 (Alien):", address(market1));
        console.log("NEW OutcomeToken 1:", address(outcomeToken1));

        // --- Market 2: BTC ---
        OutcomeToken outcomeToken2 = new OutcomeToken();
        SoothMarketV4 market2 = new SoothMarketV4();
        
        outcomeToken2.initialize(address(market2), TRADER_VAULT);
        market2.initialize(
            2, GOVERNOR_VAULT, TRADER_VAULT, FEE_CONTROLLER,
            address(outcomeToken2), bytes32(0), 15_000e18, deployer, 0, 0
        );
        traderVault.setMarket(address(market2), true);
        governorVault.setAuthorized(address(market2), true);

        console.log("NEW Market 2 (BTC):", address(market2));
        console.log("NEW OutcomeToken 2:", address(outcomeToken2));

        vm.stopBroadcast();
    }
}
