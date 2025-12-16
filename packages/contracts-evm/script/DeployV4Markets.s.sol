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
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title DeployV4Markets  
/// @notice Phase 2: Deploy markets using infrastructure from Phase 0 & 1
/// @dev Requires TickCostRegistry to be deployed and initialized first
contract DeployV4Markets is Script {
    // Phase 0 addresses (utilities - deployed 2025-12-09) - NOT USED in V4.6
    address constant TICK_REGISTRY = 0xF8928d461BB54F5B8473A133DF1d77BC043Af605;
    address constant NEW_USDC = 0xa0eEa05Cc350Ac218683815e85Cac4A1a1eF36dd;
    
    // Phase 1 addresses (infrastructure - deployed 2025-12-12 V4.6 Lock-on-Sell)
    address constant USDC = 0x53d34066A316AE1699d434753B70593A6D59Fec1;
    address constant GOVERNOR_VAULT = 0x2A2DfA1B3B3F4db798b759d07064Bb800BD10fB1;
    address constant TRADER_VAULT = 0xa8aDE73124B3256F98f510F6A9E7C1e3Aa71d20B;
    address constant FEE_CONTROLLER = 0x1a646107e7E88aa01Fadff3145Af08156679198e;
    
    function run() external {
        require(TICK_REGISTRY != address(0), "Set TICK_REGISTRY address first");
        
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        vm.startBroadcast(deployerPrivateKey);

        console.log("=== Phase 2: Deploy Launchpad Markets ===");
        console.log("Using infrastructure:");
        console.log("  LiquidityVault:", GOVERNOR_VAULT);
        console.log("  TraderVault:", TRADER_VAULT);

        SoothLiquidityVault liquidityVault = SoothLiquidityVault(GOVERNOR_VAULT);
        SoothTraderVaultV4 traderVault = SoothTraderVaultV4(TRADER_VAULT);
        SoothFeeController feeController = SoothFeeController(FEE_CONTROLLER);
        
        // Get USDC contract
        IERC20 usdc = IERC20(USDC);

        // Deploy Launchpad Factory
        OutcomeToken outcomeTokenImpl = new OutcomeToken();
        LaunchpadMarket marketImpl = new LaunchpadMarket();
        ProtocolConfig protocolConfig = new ProtocolConfig(deployer, 0);
        
        LaunchpadFactory factory = new LaunchpadFactory(
            address(marketImpl),
            USDC,
            TRADER_VAULT,
            FEE_CONTROLLER,
            address(outcomeTokenImpl),
            deployer, // treasury
            deployer, // adjudicator
            address(protocolConfig)
        );
        
        console.log("\n[Factory] LaunchpadFactory:", address(factory));

        // Fund deployer for market creation (assuming deployer already has USDC)
        // In production, deployer should have USDC balance
        usdc.approve(address(factory), type(uint256).max);

        // ===== MARKET 1: UN Confirms Alien Life =====
        
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
        
        console.log("");
        console.log("Market 1: UN Confirms Alien Life");
        console.log("  Market:", address(market1));
        console.log("  OutcomeToken:", address(market1.outcomeToken()));
        
        // ===== MARKET 2: BTC > $100k =====
        
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
        
        console.log("");
        console.log("Market 2: BTC 7-day TWAP >= $100k");
        console.log("  Market:", address(market2));
        console.log("  OutcomeToken:", address(market2.outcomeToken()));

        vm.stopBroadcast();

        console.log("");
        console.log("=== Launchpad Markets Deployed ===");
        console.log("1. Alien Life:", address(market1));
        console.log("2. BTC 7-day TWAP >= $100k:", address(market2));
    }
}
