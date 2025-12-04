// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/core/SoothInterfaces.sol";
import "../contracts/core/SoothVault.sol";
import "../contracts/core/SoothLMSRReal.sol";
import "../contracts/core/SoothRiskManager.sol";
import "../contracts/core/SoothAdjudicatorRegistry.sol";
import "../contracts/core/SoothMarketFactory.sol";
import "../contracts/settlement/SoothSettlement.sol";

contract MockERC20 is IERC20Metadata {
    string private _name = "Mock USDC";
    string private _symbol = "mUSDC";
    uint8 private _decimals = 18;

    uint256 public override totalSupply;
    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function name() external view override returns (string memory) {
        return _name;
    }

    function symbol() external view override returns (string memory) {
        return _symbol;
    }

    function decimals() external view override returns (uint8) {
        return _decimals;
    }

    function _mint(address to, uint256 amount) external {
        totalSupply += amount;
        balanceOf[to] += amount;
    }

    function transfer(address to, uint256 amount) external override returns (bool) {
        require(balanceOf[msg.sender] >= amount, "ERC20: balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "ERC20: allowance");
        require(balanceOf[from] >= amount, "ERC20: balance");
        allowance[from][msg.sender] = allowed - amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

/// @notice Deployment script for Sooth Protocol on Monad Testnet
/// @dev Deploys core contracts + 5 attestation-type markets with different risk profiles
contract DeployMonad is Script {
    struct MarketConfig {
        string name;
        bytes32 adjudicatorId;
        SoothRiskManager.RiskClass riskClass;
        string description;
    }

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        vm.startBroadcast(deployerKey);

        console2.log("\n=== MONAD TESTNET DEPLOYMENT ===");
        console2.log("Chain ID: 10143");
        console2.log("Deployer:", deployer);
        console2.log("Deployer Balance:", deployer.balance);

        // ============================================
        // STEP 1: Deploy Core Infrastructure
        // ============================================
        console2.log("\n[1/7] Deploying Mock Collateral Token...");
        MockERC20 collateral = new MockERC20();
        collateral._mint(deployer, 10_000_000 ether); // 10M tokens
        console2.log("MockERC20:", address(collateral));
        console2.log("Initial mint: 10,000,000 mUSDC");

        console2.log("\n[2/7] Deploying SoothVault...");
        SoothVault vault = new SoothVault(collateral);
        console2.log("SoothVault:", address(vault));
        console2.log("Vault decimals:", vault.decimals());
        console2.log("Decimals scale:", vault.decimalsScale());

        console2.log("\n[3/7] Deploying SoothRiskManager...");
        SoothRiskManager riskManager = new SoothRiskManager(vault);
        console2.log("SoothRiskManager:", address(riskManager));

        console2.log("\n[4/7] Deploying SoothLMSRReal AMM...");
        SoothLMSRReal amm = new SoothLMSRReal();
        console2.log("SoothLMSRReal:", address(amm));

        console2.log("\n[5/7] Deploying SoothAdjudicatorRegistry...");
        SoothAdjudicatorRegistry adjRegistry = new SoothAdjudicatorRegistry();
        console2.log("SoothAdjudicatorRegistry:", address(adjRegistry));

        console2.log("\n[6/7] Deploying SoothSettlement...");
        SoothSettlement settlement = new SoothSettlement(vault, adjRegistry);
        console2.log("SoothSettlement:", address(settlement));

        console2.log("\n[7/7] Deploying SoothMarketFactory...");
        SoothMarketFactory factory = new SoothMarketFactory(vault, riskManager, amm);
        console2.log("SoothMarketFactory:", address(factory));

        // ============================================
        // STEP 2: Configure Authorizations
        // ============================================
        console2.log("\n=== CONFIGURING AUTHORIZATIONS ===");
        vault.setAuthorized(address(settlement), true);
        console2.log("Authorized Settlement on Vault");
        
        vault.setAuthorized(address(factory), true);
        console2.log("Authorized Factory on Vault");
        
        riskManager.setAuthorized(address(factory), true);
        console2.log("Authorized Factory on RiskManager");

        // ============================================
        // STEP 3: Initialize Vault Liquidity
        // ============================================
        console2.log("\n=== INITIALIZING VAULT LIQUIDITY ===");
        uint256 initialLiquidity = 500_000 ether; // 500k tokens
        collateral.approve(address(vault), initialLiquidity);
        vault.depositFor(deployer, initialLiquidity);
        console2.log("Deposited:", initialLiquidity / 1e18, "mUSDC");
        console2.log("Vault totalAssets:", vault.totalAssets() / 1e18, "mUSDC");
        console2.log("LP shares:", vault.balanceOfLP(deployer) / 1e18);

        // ============================================
        // STEP 4: Register 5 Adjudicator Types
        // ============================================
        console2.log("\n=== REGISTERING ADJUDICATORS ===");
        
        bytes32[] memory adjudicatorIds = new bytes32[](5);
        string[] memory adjudicatorNames = new string[](5);

        // 1. UMA Optimistic Oracle
        adjudicatorIds[0] = keccak256("UMA_OPTIMISTIC");
        adjudicatorNames[0] = "UMA Optimistic Oracle";
        adjRegistry.registerAdjudicator(
            adjudicatorIds[0],
            SoothAdjudicatorRegistry.AdjudicatorConfig({
                classId: 1,
                externalContract: address(0), // Mock for testnet
                params: "bond=1000,liveness=7200",
                enabled: true
            })
        );
        console2.log("1. Registered:", adjudicatorNames[0]);

        // 2. Chainlink Functions
        adjudicatorIds[1] = keccak256("CHAINLINK_FUNCTIONS");
        adjudicatorNames[1] = "Chainlink Functions";
        adjRegistry.registerAdjudicator(
            adjudicatorIds[1],
            SoothAdjudicatorRegistry.AdjudicatorConfig({
                classId: 2,
                externalContract: address(0), // Mock for testnet
                params: "subscriptionId=123,gasLimit=300000",
                enabled: true
            })
        );
        console2.log("2. Registered:", adjudicatorNames[1]);

        // 3. Tellor Oracle
        adjudicatorIds[2] = keccak256("TELLOR_ORACLE");
        adjudicatorNames[2] = "Tellor Oracle";
        adjRegistry.registerAdjudicator(
            adjudicatorIds[2],
            SoothAdjudicatorRegistry.AdjudicatorConfig({
                classId: 3,
                externalContract: address(0), // Mock for testnet
                params: "disputePeriod=86400,minStake=100",
                enabled: true
            })
        );
        console2.log("3. Registered:", adjudicatorNames[2]);

        // 4. Multisig Committee
        adjudicatorIds[3] = keccak256("MULTISIG_COMMITTEE");
        adjudicatorNames[3] = "Multisig Committee";
        adjRegistry.registerAdjudicator(
            adjudicatorIds[3],
            SoothAdjudicatorRegistry.AdjudicatorConfig({
                classId: 4,
                externalContract: address(0), // Mock for testnet
                params: "threshold=3,signers=5",
                enabled: true
            })
        );
        console2.log("4. Registered:", adjudicatorNames[3]);

        // 5. Governance Vote
        adjudicatorIds[4] = keccak256("GOVERNANCE_VOTE");
        adjudicatorNames[4] = "Governance Vote";
        adjRegistry.registerAdjudicator(
            adjudicatorIds[4],
            SoothAdjudicatorRegistry.AdjudicatorConfig({
                classId: 5,
                externalContract: address(0), // Mock for testnet
                params: "votingPeriod=259200,quorum=1000000",
                enabled: true
            })
        );
        console2.log("5. Registered:", adjudicatorNames[4]);

        // ============================================
        // STEP 5: Create 5 Markets with Different Risk Classes
        // ============================================
        console2.log("\n=== CREATING MARKETS ===");

        MarketConfig[] memory configs = new MarketConfig[](5);
        
        configs[0] = MarketConfig({
            name: "BTC Price Market",
            adjudicatorId: adjudicatorIds[0],
            riskClass: SoothRiskManager.RiskClass.LOW,
            description: "Will BTC price exceed $100k by Dec 31?"
        });

        configs[1] = MarketConfig({
            name: "ETH Gas Market",
            adjudicatorId: adjudicatorIds[1],
            riskClass: SoothRiskManager.RiskClass.LOW,
            description: "Will ETH gas exceed 100 gwei average?"
        });

        configs[2] = MarketConfig({
            name: "Monad Launch Market",
            adjudicatorId: adjudicatorIds[2],
            riskClass: SoothRiskManager.RiskClass.MEDIUM,
            description: "Will Monad mainnet launch in Q1 2026?"
        });

        configs[3] = MarketConfig({
            name: "Sooth TVL Market",
            adjudicatorId: adjudicatorIds[3],
            riskClass: SoothRiskManager.RiskClass.HIGH,
            description: "Will Sooth Protocol TVL exceed $10M?"
        });

        configs[4] = MarketConfig({
            name: "Monad Top 10 Market",
            adjudicatorId: adjudicatorIds[4],
            riskClass: SoothRiskManager.RiskClass.CRITICAL,
            description: "Will Monad become top 10 L1 by TVL?"
        });

        address[] memory marketAddresses = new address[](5);
        uint256[] memory marketIds = new uint256[](5);
        uint256[] memory bMarkets = new uint256[](5);

        for (uint256 i = 0; i < 5; i++) {
            console2.log("\n--- Market ID:", i + 1);
            console2.log("Name:", configs[i].name);
            console2.log("Adjudicator:", adjudicatorNames[i]);
            console2.log("Risk Class:", uint8(configs[i].riskClass));

            SoothMarket market = factory.createMarket(
                configs[i].adjudicatorId,
                configs[i].riskClass
            );

            marketAddresses[i] = address(market);
            marketIds[i] = market.marketId();
            bMarkets[i] = riskManager.getBForMarket(marketIds[i]);

            // Authorize market on vault
            vault.setAuthorized(address(market), true);

            console2.log("Market Address:", address(market));
            console2.log("Market ID:", marketIds[i]);
            console2.log("b parameter:", bMarkets[i] / 1e18, "mUSDC");

            (int256 qYes, int256 qNo) = market.ammState();
            console2.log("Initial qYes:", uint256(qYes) / 1e18);
            console2.log("Initial qNo:", uint256(qNo) / 1e18);
        }

        // ============================================
        // STEP 6: Generate Deployment Artifacts (BEFORE stopBroadcast)
        // ============================================
        console2.log("\n=== GENERATING DEPLOYMENT ARTIFACTS ===");

        // Generate deployments-monad.json
        string memory deploymentsJson = "{";
        deploymentsJson = string.concat(deploymentsJson, "\"chainId\":10143,");
        deploymentsJson = string.concat(deploymentsJson, "\"network\":\"monad-testnet\",");
        deploymentsJson = string.concat(deploymentsJson, "\"MockERC20\":\"", vm.toString(address(collateral)), "\",");
        deploymentsJson = string.concat(deploymentsJson, "\"SoothVault\":\"", vm.toString(address(vault)), "\",");
        deploymentsJson = string.concat(deploymentsJson, "\"SoothRiskManager\":\"", vm.toString(address(riskManager)), "\",");
        deploymentsJson = string.concat(deploymentsJson, "\"SoothLMSRReal\":\"", vm.toString(address(amm)), "\",");
        deploymentsJson = string.concat(deploymentsJson, "\"SoothAdjudicatorRegistry\":\"", vm.toString(address(adjRegistry)), "\",");
        deploymentsJson = string.concat(deploymentsJson, "\"SoothSettlement\":\"", vm.toString(address(settlement)), "\",");
        deploymentsJson = string.concat(deploymentsJson, "\"SoothMarketFactory\":\"", vm.toString(address(factory)), "\"");
        deploymentsJson = string.concat(deploymentsJson, "}");

        vm.writeFile("deployments-monad.json", deploymentsJson);
        console2.log("Written: deployments-monad.json");

        // Generate markets-monad.json
        string memory marketsJson = "[";
        for (uint256 i = 0; i < 5; i++) {
            if (i > 0) marketsJson = string.concat(marketsJson, ",");
            marketsJson = string.concat(marketsJson, "{");
            marketsJson = string.concat(marketsJson, "\"id\":", vm.toString(marketIds[i]), ",");
            marketsJson = string.concat(marketsJson, "\"address\":\"", vm.toString(marketAddresses[i]), "\",");
            marketsJson = string.concat(marketsJson, "\"name\":\"", configs[i].name, "\",");
            marketsJson = string.concat(marketsJson, "\"description\":\"", configs[i].description, "\",");
            marketsJson = string.concat(marketsJson, "\"adjudicator\":\"", adjudicatorNames[i], "\",");
            marketsJson = string.concat(marketsJson, "\"riskClass\":", vm.toString(uint8(configs[i].riskClass)), ",");
            marketsJson = string.concat(marketsJson, "\"bMarket\":", vm.toString(bMarkets[i]));
            marketsJson = string.concat(marketsJson, "}");
        }
        marketsJson = string.concat(marketsJson, "]");

        vm.writeFile("markets-monad.json", marketsJson);
        console2.log("Written: markets-monad.json");

        vm.stopBroadcast();

        // ============================================
        // FINAL SUMMARY
        // ============================================
        console2.log("\n=== DEPLOYMENT COMPLETE ===");
        console2.log("Network: Monad Testnet (Chain ID: 10143)");
        console2.log("Deployer:", deployer);
        console2.log("\nCore Contracts:");
        console2.log("  MockERC20:", address(collateral));
        console2.log("  SoothVault:", address(vault));
        console2.log("  SoothRiskManager:", address(riskManager));
        console2.log("  SoothLMSRReal:", address(amm));
        console2.log("  SoothAdjudicatorRegistry:", address(adjRegistry));
        console2.log("  SoothSettlement:", address(settlement));
        console2.log("  SoothMarketFactory:", address(factory));
        
        console2.log("\nMarkets Created:");
        for (uint256 i = 0; i < 5; i++) {
            console2.log("  Market", i + 1);
            console2.log("     Address:", marketAddresses[i]);
            console2.log("     ID:", marketIds[i]);
            console2.log("     Risk:", uint8(configs[i].riskClass));
        }

        console2.log("\nVault Status:");
        console2.log("  Total Assets:", vault.totalAssets() / 1e18, "mUSDC");
        console2.log("  LP Shares:", vault.balanceOfLP(deployer) / 1e18);
        console2.log("  Locked Exposure:", vault.totalLockedExposure() / 1e18, "mUSDC");
        console2.log("  Available Buffer:", (vault.totalAssets() - vault.totalLockedExposure()) / 1e18, "mUSDC");

        console2.log("\nNext Steps:");
        console2.log("  1. Verify contracts on Monad explorer");
        console2.log("  2. Update frontend with deployments-monad.json");
        console2.log("  3. Import markets-monad.json to dApp");
        console2.log("  4. Test trading on all 5 markets");
        console2.log("  5. Document deployment in MONAD_DEPLOYMENT_SUMMARY.md");
    }
}
