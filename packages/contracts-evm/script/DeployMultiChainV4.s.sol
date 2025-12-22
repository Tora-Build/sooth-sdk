// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/core/SoothTraderVaultV4.sol";
import "../contracts/launchpad/LaunchpadFactory.sol";
import "../contracts/launchpad/LaunchpadMarket.sol";
import "../contracts/core/OutcomeToken.sol";
import "../contracts/core/SoothLiquidityVault.sol";
import "../contracts/core/SoothFeeController.sol";
import "../contracts/core/ProtocolConfig.sol";
import "../contracts/core/SoothAdjudicatorRegistry.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title MockUSDC for testnet deployments
contract MockUSDC is IERC20 {
    string public name = "Mock USDC";
    string public symbol = "mUSDC";
    uint8 public decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function transfer(address recipient, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[recipient] += amount;
        return true;
    }
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool) {
        allowance[sender][msg.sender] -= amount;
        balanceOf[sender] -= amount;
        balanceOf[recipient] += amount;
        return true;
    }
    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }
}

/// @title DeployMultiChainV4
/// @notice Full V4.5 deployment: Infrastructure + 2 Markets
/// @dev Run with: forge script script/DeployMultiChainV4.s.sol --rpc-url $RPC --broadcast
contract DeployMultiChainV4 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        vm.startBroadcast(deployerPrivateKey);

        console.log("=== V4.5 Multi-Chain Deployment ===");
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);

        // ==================== PHASE 1: INFRASTRUCTURE ====================
        
        // 1. MockUSDC
        MockUSDC usdc = new MockUSDC();
        usdc.mint(deployer, 1_000_000 * 1e18);
        console.log("\n[1/4] USDC:", address(usdc));

        // 2. FeeController
        SoothFeeController feeController = new SoothFeeController(deployer);
        feeController.setOrderbookFee(10); // 0.1%
        console.log("[2/4] FeeController:", address(feeController));

        // 3. LiquidityVault (for TraderVault's global locked proceeds tracking)
        SoothLiquidityVault liquidityVault = new SoothLiquidityVault(IERC20(address(usdc)));
        console.log("[3/4] LiquidityVault:", address(liquidityVault));

        // 4. TraderVaultV4
        SoothTraderVaultV4 traderVault = new SoothTraderVaultV4(
            IERC20(address(usdc)), 
            ISoothLiquidityVault(address(liquidityVault))
        );
        console.log("[4/4] TraderVaultV4:", address(traderVault));

        // 5. Setup permissions
        liquidityVault.setAuthorized(address(traderVault), true);
        liquidityVault.setAuthorized(deployer, true);

        // 6. Fund vault with initial liquidity
        usdc.approve(address(liquidityVault), 500_000 * 1e18);
        usdc.transfer(address(liquidityVault), 500_000 * 1e18);
        liquidityVault.receiveFunds(0, 500_000 * 1e18);

        // ==================== PHASE 2: LAUNCHPAD FACTORY ====================

        console.log("\n=== Deploying Launchpad Factory ===");

        // Deploy Launchpad components
        OutcomeToken outcomeTokenImpl = new OutcomeToken();
        LaunchpadMarket marketImpl = new LaunchpadMarket();
        ProtocolConfig protocolConfig = new ProtocolConfig(deployer, 0); // 0% liquidation fee
        SoothAdjudicatorRegistry adjudicatorRegistry = new SoothAdjudicatorRegistry(deployer);
        adjudicatorRegistry.setAdjudicator(deployer, 1, true, bytes32(0));
        
        LaunchpadFactory factory = new LaunchpadFactory(
            address(marketImpl),
            address(usdc),
            address(traderVault),
            address(feeController),
            address(outcomeTokenImpl),
            deployer, // treasury
            deployer, // adjudicator
            address(adjudicatorRegistry),
            address(protocolConfig)
        );
        
        console.log("[Factory] LaunchpadFactory:", address(factory));
        console.log("[Factory] MarketImpl:", address(marketImpl));
        console.log("[Factory] OutcomeTokenImpl:", address(outcomeTokenImpl));
        console.log("[Factory] ProtocolConfig:", address(protocolConfig));

        // ==================== PHASE 3: MARKETS ====================

        console.log("\n=== Creating Launchpad Markets ===");

        // Fund deployer for market creation
        usdc.mint(deployer, 10_000 * 1e18);
        usdc.approve(address(factory), type(uint256).max);

        // Market 1: UN Confirms Alien Life
        // Use tier 1 ($1k deposit, b ~ 1442.69e18)
        (address market1Addr, ) = factory.createMarket(
            "UN Confirms Alien Life",
            "ALIEN",
            "Will the UN confirm the existence of alien life?",
            1, // tier 1
            false, // fixed deadline
            5 days, // duration
            address(0)
        );
        LaunchpadMarket market1 = LaunchpadMarket(market1Addr);
        
        traderVault.setMarket(address(market1), true);
        traderVault.setOutcomeToken(address(market1.outcomeToken()), true);
        
        console.log("\nMarket 1: UN Confirms Alien Life");
        console.log("  Address:", address(market1));
        console.log("  OutcomeToken:", address(market1.outcomeToken()));

        // Market 2: BTC 7-day TWAP >= $100k
        // Use tier 2 ($10k deposit, b ~ 14426.95e18)
        (address market2Addr, ) = factory.createMarket(
            "BTC 7-day TWAP >= $100k",
            "BTC100K",
            "Will BTC 7-day TWAP reach $100k?",
            2, // tier 2
            false, // fixed deadline
            5 days, // duration
            address(0)
        );
        LaunchpadMarket market2 = LaunchpadMarket(market2Addr);
        
        traderVault.setMarket(address(market2), true);
        traderVault.setOutcomeToken(address(market2.outcomeToken()), true);
        
        console.log("\nMarket 2: BTC 7-day TWAP >= $100k");
        console.log("  Address:", address(market2));
        console.log("  OutcomeToken:", address(market2.outcomeToken()));

        vm.stopBroadcast();

        // ==================== SUMMARY ====================
        console.log("\n========================================");
        console.log("=== DEPLOYMENT COMPLETE ===");
        console.log("========================================");
        console.log("Chain ID:", block.chainid);
        console.log("\nInfrastructure:");
        console.log("  MockUSDC:", address(usdc));
        console.log("  LiquidityVault:", address(liquidityVault));
        console.log("  TraderVaultV4:", address(traderVault));
        console.log("  FeeController:", address(feeController));
        console.log("\nMarkets:");
        console.log("  Market1 (Alien):", address(market1));
        console.log("  Token1:", address(market1.outcomeToken()));
        console.log("  Market2 (BTC):", address(market2));
        console.log("  Token2:", address(market2.outcomeToken()));
        console.log("========================================");
    }
}
