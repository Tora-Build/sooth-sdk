// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/launchpad/LaunchpadFactory.sol";
import "../contracts/launchpad/LaunchpadMarket.sol";
import "../contracts/launchpad/LaunchpadQuoter.sol";
import "../contracts/launchpad/LaunchpadOutcomeToken.sol";
import "../contracts/core/SoothLiquidityVault.sol";
import "../contracts/core/SoothTraderVaultV4.sol";
import "../contracts/core/SoothFeeController.sol";
import "../contracts/core/ProtocolConfig.sol";
import "../contracts/core/SoothAdjudicatorRegistry.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title DeployV4Markets  
/// @notice Phase 2: Deploy markets using infrastructure from Phase 0 & 1
/// @dev Requires TickCostRegistry to be deployed and initialized first
contract DeployV4Markets is Script {
    // Phase 0 addresses (utilities - deployed 2025-12-09) - NOT USED in V4.6
    address constant TICK_REGISTRY = 0xF8928d461BB54F5B8473A133DF1d77BC043Af605;
    address constant NEW_USDC = 0xa0eEa05Cc350Ac218683815e85Cac4A1a1eF36dd;
    
    // Phase 1 addresses (infrastructure - updated 2025-12-21 for V6.1.9)
    address constant USDC = 0x8dD2ABE2a78BB70F8E0fFE363BbFdc6022aA00Cd;
    address constant GOVERNOR_VAULT = 0xDE5639BC20a0de20a0bEF2EdDE36b9C5DE79CEfB;
    address constant TRADER_VAULT = 0x1364d5CCc14251C73823e0291EF57e9EA4b9E673;
    address constant FEE_CONTROLLER = 0x3D20145Ec9b15b2AC27292459aB2FaCb3921aCA9;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        vm.startBroadcast(deployerPrivateKey);

        console.log("=== Phase 2: Deploy Launchpad Markets ===");
        console.log("Using infrastructure:");
        console.log("  LiquidityVault:", GOVERNOR_VAULT);
        console.log("  TraderVault:", TRADER_VAULT);

        // Get contracts (used for market registration)
        SoothTraderVaultV4 traderVault = SoothTraderVaultV4(TRADER_VAULT);
        
        // Mint USDC for deployer if needed (MockUSDC only)
        // Need to import MockUSDC or use low-level call
        (bool mintSuccess, ) = USDC.call(abi.encodeWithSignature("mint(address,uint256)", deployer, 1000000 * 1e6));
        require(mintSuccess, "USDC mint failed");
        
        // Get USDC contract
        IERC20 usdc = IERC20(USDC);

        // Deploy Launchpad Factory
        LaunchpadOutcomeToken outcomeTokenImpl = new LaunchpadOutcomeToken();
        LaunchpadMarket marketImpl = new LaunchpadMarket();
        ProtocolConfig protocolConfig = new ProtocolConfig(deployer, 0);
        SoothAdjudicatorRegistry adjudicatorRegistry = new SoothAdjudicatorRegistry(deployer);
        adjudicatorRegistry.setAdjudicator(deployer, 1, true, bytes32(0));
        LaunchpadQuoter quoter = new LaunchpadQuoter();
        
        console.log("\n[Quoter] LaunchpadQuoter:", address(quoter));

        LaunchpadFactory factory = new LaunchpadFactory(
            address(marketImpl),
            USDC,
            TRADER_VAULT,
            FEE_CONTROLLER,
            address(outcomeTokenImpl),
            deployer, // treasury
            deployer, // adjudicator
            address(adjudicatorRegistry),
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
            90 days,
            address(0)
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
            90 days,
            address(0)
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
        console.log("");
        console.log("NOTE: Do NOT create test markets with names like 'aaa' or 'AAA' in production deployments.");
    }
}
