// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/launchpad/LaunchpadFactory.sol";
import "../contracts/launchpad/LaunchpadMarket.sol";
import "../contracts/core/OutcomeToken.sol";
import "../contracts/core/SoothLiquidityVault.sol";
import "../contracts/core/SoothTraderVaultV4.sol";
import "../contracts/core/SoothFeeController.sol";
import "../contracts/core/ProtocolConfig.sol";
import "../contracts/core/ISoothLiquidityVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract RedeployMarketsOnly is Script {
    // Current addresses from deployments.json
    address constant GOVERNOR_VAULT = 0x6c60D3e25FEf9AECf3DC2F66287322641D8651Be;
    address constant TRADER_VAULT = 0x8348A02D742e59B2ad9fe7Bfe354fAE01176d17d;
    address constant FEE_CONTROLLER = 0x2300BBe091E5176410eCcb3c3710ef67781B68ff;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        vm.startBroadcast(deployerPrivateKey);

        console.log("=== Redeploying All Launchpad Markets ===");
        console.log("TraderVault:", TRADER_VAULT);
        console.log("LiquidityVault:", GOVERNOR_VAULT);
        
        SoothLiquidityVault liquidityVault = SoothLiquidityVault(GOVERNOR_VAULT);
        SoothTraderVaultV4 traderVault = SoothTraderVaultV4(TRADER_VAULT);
        SoothFeeController feeController = SoothFeeController(FEE_CONTROLLER);
        IERC20 usdc = IERC20(0x2D2Aed066C34523913ab7084B668bFf3529cB176); // Existing USDC

        // Deploy Launchpad Factory
        OutcomeToken outcomeTokenImpl = new OutcomeToken();
        LaunchpadMarket marketImpl = new LaunchpadMarket();
        ProtocolConfig protocolConfig = new ProtocolConfig(deployer, 0);
        
        LaunchpadFactory factory = new LaunchpadFactory(
            address(marketImpl),
            address(usdc),
            TRADER_VAULT,
            FEE_CONTROLLER,
            address(outcomeTokenImpl),
            deployer, // treasury
            deployer, // adjudicator
            address(protocolConfig), 6
        );
        console.log("LaunchpadFactory:", address(factory));

        // Fund deployer for market creation
        usdc.approve(address(factory), type(uint256).max);

        // --- Market 1: Alien Life ---
        (address market1Addr, ) = factory.createMarket(
            "UN Confirms Alien Life",
            "ALIEN",
            "Will the UN confirm the existence of alien life?",
            1, // tier 1
            false,
            90 days
        );
        LaunchpadMarket market1 = LaunchpadMarket(market1Addr);
        traderVault.setMarket(address(market1), true);
        traderVault.setOutcomeToken(address(market1.outcomeToken()), true);
        liquidityVault.setAuthorized(address(traderVault), true);

        console.log("NEW Market 1 (Alien):", address(market1));
        console.log("NEW OutcomeToken 1:", address(market1.outcomeToken()));

        // --- Market 2: BTC ---
        (address market2Addr, ) = factory.createMarket(
            "BTC 7-day TWAP >= $100k",
            "BTC100K",
            "Will BTC 7-day TWAP reach $100k?",
            2, // tier 2
            false,
            90 days
        );
        LaunchpadMarket market2 = LaunchpadMarket(market2Addr);
        traderVault.setMarket(address(market2), true);
        traderVault.setOutcomeToken(address(market2.outcomeToken()), true);

        console.log("NEW Market 2 (BTC):", address(market2));
        console.log("NEW OutcomeToken 2:", address(market2.outcomeToken()));

        vm.stopBroadcast();
    }
}
