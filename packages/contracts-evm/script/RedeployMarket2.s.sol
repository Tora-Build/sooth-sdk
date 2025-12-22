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

contract RedeployMarket2 is Script {
    // Correct Addresses from deployments.json
    address constant GOVERNOR_VAULT = 0x880bCcb111F39CF922b4A85481Ca2eE54507cdb5;
    address constant TRADER_VAULT = 0xAd461C1c55bf552756Ad29Ac96f341A1fC007176;
    address constant FEE_CONTROLLER = 0x2F7a6df471285Cc6893951a16fB67bdBaD026E46;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        vm.startBroadcast(deployerPrivateKey);

        console.log("=== Redeploying Market 2 (BTC) ===");
        console.log("  TraderVault:", TRADER_VAULT);

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

        // ===== MARKET 2: BTC 7-day TWAP >= $100k =====
        
        (address market2Addr, ) = factory.createMarket(
            "BTC 7-day TWAP >= $100k",
            "BTC100K",
            "Will BTC 7-day TWAP reach $100k?",
            2, // tier 2
            false,
            90 days
        );
        LaunchpadMarket market2 = LaunchpadMarket(market2Addr);
        
        // Whitelist New Market in Vault
        traderVault.setMarket(address(market2), true);
        traderVault.setOutcomeToken(address(market2.outcomeToken()), true);
        
        console.log("");
        console.log("NEW Market 2: BTC 7-day TWAP >= $100k");
        console.log("  Market:", address(market2));
        console.log("  OutcomeToken:", address(market2.outcomeToken()));

        vm.stopBroadcast();
    }
}
