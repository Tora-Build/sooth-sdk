// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/core/SoothGovernorVault.sol";
import "../contracts/core/SoothTraderVault.sol";
import "../contracts/core/SoothLMSRReal.sol";
import "../contracts/core/SoothFeeController.sol";
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

/// @notice Deployment script for Sooth Protocol (Singleton Trader Vault Architecture)
contract DeployBaseSepolia is Script {
    struct MarketConfig {
        string name;
        bytes32 adjudicatorId;
        uint256 b;
        uint256 feeLMSR;  // Fee in basis points
        string description;
    }

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        vm.startBroadcast(deployerKey);

        console2.log("\n=== BASE SEPOLIA DEPLOYMENT (NEW ARCHITECTURE) ===");
        console2.log("Chain ID: 84532");
        console2.log("Deployer:", deployer);

        // ============================================
        // STEP 1: Deploy Core Infrastructure
        // ============================================
        console2.log("\n[1/7] Deploying Mock Collateral Token...");
        MockERC20 collateral = new MockERC20();
        collateral._mint(deployer, 10_000_000 ether); 
        console2.log("MockERC20:", address(collateral));

        console2.log("\n[2/7] Deploying Vaults...");
        SoothGovernorVault governorVault = new SoothGovernorVault(collateral);
        console2.log("SoothGovernorVault:", address(governorVault));
        
        SoothTraderVault traderVault = new SoothTraderVault(collateral);
        console2.log("SoothTraderVault:", address(traderVault));

        console2.log("\n[3/7] Deploying SoothLMSRReal AMM...");
        SoothLMSRReal amm = new SoothLMSRReal();
        console2.log("SoothLMSRReal:", address(amm));

        console2.log("\n[4/7] Deploying SoothAdjudicatorRegistry...");
        SoothAdjudicatorRegistry adjRegistry = new SoothAdjudicatorRegistry();
        console2.log("SoothAdjudicatorRegistry:", address(adjRegistry));

        console2.log("\n[5/7] Deploying SoothSettlement...");
        SoothSettlement settlement = new SoothSettlement(governorVault, traderVault, adjRegistry);
        console2.log("SoothSettlement:", address(settlement));

        console2.log("\n[6/7] Deploying SoothFeeController...");
        SoothFeeController feeController = new SoothFeeController(deployer); // Treasury = deployer for now
        console2.log("SoothFeeController:", address(feeController));

        console2.log("\n[7/7] Deploying SoothMarketFactory...");
        SoothMarketFactory factory = new SoothMarketFactory(governorVault, traderVault, amm, ISoothFeeController(address(feeController)));
        console2.log("SoothMarketFactory:", address(factory));

        // ============================================
        // STEP 2: Configure Authorizations
        // ============================================
        console2.log("\n=== CONFIGURING AUTHORIZATIONS ===");
        
        // Governor Vault Authorizations
        governorVault.setAuthorized(address(settlement), true);
        governorVault.setAuthorized(address(factory), true); // Factory allocates exposure
        console2.log("Authorized Settlement & Factory on GovernorVault");

        // Trader Vault Authorizations
        // TraderVault authorizes Markets (done in loop) and Settlement
        traderVault.setGovernorVault(address(governorVault));
        // Settlement needs to move funds for PnL
        // Is Settlement "Market"? No, but it calls payToGovernor/receiveFromGovernor?
        // Wait, Settlement calls `traderVault.payToGovernor` / `receiveFromGovernor`.
        // These are `onlyMarket`.
        // So Settlement MUST be whitelisted as a "Market" on TraderVault.
        traderVault.setMarket(address(settlement), true);
        console2.log("Authorized Settlement on TraderVault");

        // ============================================
        // STEP 3: Initialize Governor Liquidity
        // ============================================
        console2.log("\n=== INITIALIZING GOVERNOR LIQUIDITY ===");
        uint256 initialLiquidity = 500_000 ether; 
        collateral.approve(address(governorVault), initialLiquidity);
        governorVault.depositFor(deployer, initialLiquidity);
        console2.log("Deposited LP:", initialLiquidity / 1e18, "mUSDC");

        // ============================================
        // STEP 4: Register Adjudicators
        // ============================================
        console2.log("\n=== REGISTERING ADJUDICATORS ===");
        bytes32[] memory adjudicatorIds = new bytes32[](5);
        string[] memory adjudicatorNames = new string[](5);

        // 1. UMA Optimistic Oracle
        adjudicatorIds[0] = keccak256("UMA_OPTIMISTIC");
        adjudicatorNames[0] = "UMA Optimistic Oracle";
        adjRegistry.registerAdjudicator(adjudicatorIds[0], SoothAdjudicatorRegistry.AdjudicatorConfig({classId: 1, externalContract: address(0), params: "bond=1000", enabled: true}));

        // 2. Chainlink Functions
        adjudicatorIds[1] = keccak256("CHAINLINK_FUNCTIONS");
        adjudicatorNames[1] = "Chainlink Functions";
        adjRegistry.registerAdjudicator(adjudicatorIds[1], SoothAdjudicatorRegistry.AdjudicatorConfig({classId: 2, externalContract: address(0), params: "sub=123", enabled: true}));

        // 3. Tellor Oracle
        adjudicatorIds[2] = keccak256("TELLOR_ORACLE");
        adjudicatorNames[2] = "Tellor Oracle";
        adjRegistry.registerAdjudicator(adjudicatorIds[2], SoothAdjudicatorRegistry.AdjudicatorConfig({classId: 3, externalContract: address(0), params: "disp=86400", enabled: true}));

        // 4. Multisig Committee
        adjudicatorIds[3] = keccak256("MULTISIG_COMMITTEE");
        adjudicatorNames[3] = "Multisig Committee";
        adjRegistry.registerAdjudicator(adjudicatorIds[3], SoothAdjudicatorRegistry.AdjudicatorConfig({classId: 4, externalContract: address(0), params: "th=3", enabled: true}));

        // 5. Governance Vote
        adjudicatorIds[4] = keccak256("GOVERNANCE_VOTE");
        adjudicatorNames[4] = "Governance Vote";
        adjRegistry.registerAdjudicator(adjudicatorIds[4], SoothAdjudicatorRegistry.AdjudicatorConfig({classId: 5, externalContract: address(0), params: "vote=259200", enabled: true}));

        // ============================================
        // STEP 5: Create Markets
        // ============================================
        console2.log("\n=== CREATING MARKETS ===");

        MarketConfig[] memory configs = new MarketConfig[](5);
        
        configs[0] = MarketConfig("BTC Price Market", adjudicatorIds[0], 25000 ether, 30, "Will BTC > $100k?");
        configs[1] = MarketConfig("ETH Gas Market", adjudicatorIds[1], 25000 ether, 30, "Will ETH gas > 100 gwei?");
        configs[2] = MarketConfig("Monad Launch Market", adjudicatorIds[2], 10000 ether, 50, "Will Monad launch Q1 2026?");
        configs[3] = MarketConfig("Sooth TVL Market", adjudicatorIds[3], 5000 ether, 100, "Will Sooth TVL > $10M?");
        configs[4] = MarketConfig("Monad Top 10 Market", adjudicatorIds[4], 5000 ether, 100, "Will Monad be Top 10?");

        address[] memory marketAddresses = new address[](5);
        uint256[] memory marketIds = new uint256[](5);

        for (uint256 i = 0; i < 5; i++) {
            SoothMarket market = factory.createMarket(
                configs[i].adjudicatorId, 
                deployer,  // Governor = deployer for now
                configs[i].b,
                configs[i].feeLMSR
            );
            
            marketAddresses[i] = address(market);
            marketIds[i] = market.marketId();

            // Authorize Market on GovernorVault (for AMM trades)
            governorVault.setAuthorized(address(market), true);
            
            // Authorize Market on TraderVault (for User trades)
            traderVault.setMarket(address(market), true);

            console2.log("Created Market:", configs[i].name);
            console2.log("  ID:", marketIds[i]);
        }

        // ============================================
        // STEP 6: Generate Artifacts
        // ============================================
        
        string memory deploymentsJson = "{";
        deploymentsJson = string.concat(deploymentsJson, "\"chainId\":84532,");
        deploymentsJson = string.concat(deploymentsJson, "\"MockERC20\":\"", vm.toString(address(collateral)), "\",");
        deploymentsJson = string.concat(deploymentsJson, "\"SoothGovernorVault\":\"", vm.toString(address(governorVault)), "\",");
        deploymentsJson = string.concat(deploymentsJson, "\"SoothTraderVault\":\"", vm.toString(address(traderVault)), "\",");
        deploymentsJson = string.concat(deploymentsJson, "\"SoothLMSRReal\":\"", vm.toString(address(amm)), "\",");
        deploymentsJson = string.concat(deploymentsJson, "\"SoothFeeController\":\"", vm.toString(address(feeController)), "\",");
        deploymentsJson = string.concat(deploymentsJson, "\"SoothAdjudicatorRegistry\":\"", vm.toString(address(adjRegistry)), "\",");
        deploymentsJson = string.concat(deploymentsJson, "\"SoothSettlement\":\"", vm.toString(address(settlement)), "\",");
        deploymentsJson = string.concat(deploymentsJson, "\"SoothMarketFactory\":\"", vm.toString(address(factory)), "\"");
        deploymentsJson = string.concat(deploymentsJson, "}");

        vm.writeFile("deployments-base.json", deploymentsJson);

        string memory marketsJson = "[";
        for (uint256 i = 0; i < 5; i++) {
            if (i > 0) marketsJson = string.concat(marketsJson, ",");
            marketsJson = string.concat(marketsJson, "{");
            marketsJson = string.concat(marketsJson, "\"id\":", vm.toString(marketIds[i]), ",");
            marketsJson = string.concat(marketsJson, "\"address\":\"", vm.toString(marketAddresses[i]), "\",");
            marketsJson = string.concat(marketsJson, "\"name\":\"", configs[i].name, "\",");
            marketsJson = string.concat(marketsJson, "\"description\":\"", configs[i].description, "\",");
            marketsJson = string.concat(marketsJson, "\"adjudicator\":\"", adjudicatorNames[i], "\",");
            marketsJson = string.concat(marketsJson, "\"bMarket\":", vm.toString(configs[i].b));
            marketsJson = string.concat(marketsJson, "}");
        }
        marketsJson = string.concat(marketsJson, "]");

        vm.writeFile("markets-base.json", marketsJson);

        vm.stopBroadcast();
        console2.log("\nDeployment Complete!");
    }
}
