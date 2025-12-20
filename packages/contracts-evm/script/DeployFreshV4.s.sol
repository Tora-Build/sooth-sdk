// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/mocks/MockUSDC.sol";
import "../contracts/core/SoothFeeController.sol";
import "../contracts/core/SoothLiquidityVault.sol";
import "../contracts/core/SoothTraderVaultV4.sol";
import "../contracts/launchpad/LaunchpadFactory.sol";
import "../contracts/launchpad/LaunchpadMarket.sol";
import "../contracts/launchpad/LaunchpadOutcomeToken.sol";
import "../contracts/core/ProtocolConfig.sol";
import "../contracts/core/ISoothLiquidityVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract DeployFreshV4 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        vm.startBroadcast(deployerPrivateKey);

        console.log("=== Deploying Fresh V4 System (6-decimal USDC) ===");
        
        // 1. Deploy NEW MockUSDC with 6 decimals (like real USDC)
        MockUSDC usdc = new MockUSDC();
        console.log("NEW MockUSDC (6 decimals):", address(usdc));

        // 2. Deploy FeeController
        SoothFeeController feeController = new SoothFeeController(deployer);
        feeController.setOrderbookFee(10); // 0.1%
        console.log("FeeController:", address(feeController));

        // 3. Deploy LiquidityVault (for TraderVault's global locked proceeds tracking)
        SoothLiquidityVault liquidityVault = new SoothLiquidityVault(IERC20(address(usdc)));
        console.log("LiquidityVault:", address(liquidityVault));

        // 4. Deploy TraderVaultV4
        SoothTraderVaultV4 traderVault = new SoothTraderVaultV4(
            IERC20(address(usdc)), 
            ISoothLiquidityVault(address(liquidityVault))
        );
        console.log("TraderVaultV4:", address(traderVault));

        // 5. Deploy Launchpad Factory
        LaunchpadOutcomeToken outcomeTokenImpl = new LaunchpadOutcomeToken();
        LaunchpadMarket marketImpl = new LaunchpadMarket();
        ProtocolConfig protocolConfig = new ProtocolConfig(deployer, 0);
        
        LaunchpadFactory factory = new LaunchpadFactory(
            address(marketImpl),
            address(usdc),
            address(traderVault),
            address(feeController),
            address(outcomeTokenImpl),
            deployer, // treasury
            deployer, // adjudicator
            address(protocolConfig)
        );
        console.log("LaunchpadFactory:", address(factory));

        // Set factory on TraderVault
        traderVault.setLaunchpadFactory(address(factory));

        // 6. Create Launchpad Markets
        // Fund deployer with USDC (6 decimals: 100,000 USDC for testing)
        usdc.mint(deployer, 100_000 * 1e6);
        usdc.approve(address(factory), type(uint256).max);
        
        // Also approve TraderVault for deposits
        usdc.approve(address(traderVault), type(uint256).max);
        
        // Market 1
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
        
        console.log("Market 1 (Alien):", address(market1));
        console.log("OutcomeToken 1:", address(market1.outcomeToken()));

        // Market 2
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

        console.log("Market 2 (BTC):", address(market2));
        console.log("OutcomeToken 2:", address(market2.outcomeToken()));

        vm.stopBroadcast();
    }
}
