// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/core/SoothInterfaces.sol";
import "../contracts/core/SoothVault.sol";
import "../contracts/core/SoothLMSRReal.sol";
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

contract DeploySooth is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        vm.startBroadcast(deployerKey);

        // 1. Collateral token (for dev: deploy mock token)
        MockERC20 collateral = new MockERC20();
        collateral._mint(deployer, 1_000_000 ether);

        // 2. Vault
        SoothVault vault = new SoothVault(collateral);
        
        // Verify decimals normalization
        uint8 collateralDecimals = collateral.decimals();
        uint256 decimalsScale = vault.decimalsScale();
        console2.log("Collateral decimals:", collateralDecimals);
        console2.log("Decimals scale factor:", decimalsScale);
        console2.log("Expected scale: 10^(18-decimals) =", 10 ** (18 - collateralDecimals));

        // 3. Risk manager
        SoothRiskManager riskManager = new SoothRiskManager(vault);

        // 4. AMM implementation (single AMM for all markets due to shared liquidity)
        // Use SoothLMSRReal (fixed LMSR with PRBMath)
        SoothLMSRReal amm = new SoothLMSRReal();

        // 5. Adjudicator registry
        SoothAdjudicatorRegistry adjRegistry = new SoothAdjudicatorRegistry();

        // Register a dummy adjudicator for testing
        SoothAdjudicatorRegistry.AdjudicatorConfig memory cfg =
            SoothAdjudicatorRegistry.AdjudicatorConfig({
                classId: 1, // e.g. UMA / optimistic
                externalContract: address(0),
                params: "",
                enabled: true
            });
        bytes32 dummyAdjId = keccak256("DUMMY_ADJ");
        adjRegistry.registerAdjudicator(dummyAdjId, cfg);

        // 6. Settlement contract
        SoothSettlement settlement = new SoothSettlement(vault, adjRegistry);

        // 7. Authorize settlement as vault spender for PnL application
        vault.setAuthorized(address(settlement), true);

        // 8. Market factory (all markets use the same AMM)
        SoothMarketFactory factory = new SoothMarketFactory(vault, riskManager, amm);

        // Authorize factory on vault for exposure allocation
        vault.setAuthorized(address(factory), true);

        // Authorize factory on riskManager for setting market risk class
        riskManager.setAuthorized(address(factory), true);

        // 9. Deposit initial liquidity into vault
        // This ensures bGlobal will be non-zero when markets are created
        uint256 initialLiquidity = 100_000 ether; // 100k tokens
        collateral.approve(address(vault), initialLiquidity);
        vault.depositFor(msg.sender, initialLiquidity);
        console2.log("Initial liquidity deposited:", initialLiquidity);
        
        // Verify vault state after deposit
        console2.log("Vault totalAssets:", vault.totalAssets());
        console2.log("Vault LP balance:", vault.balanceOfLP(msg.sender));

        // 10. Create first example market
        // The factory will call updateGlobalB() internally, which now has liquidity to work with
        SoothMarket exampleMarket =
            factory.createMarket(dummyAdjId, SoothRiskManager.RiskClass.MEDIUM);
        
        // Authorize market on vault (needed for recordMarketFlow)
        vault.setAuthorized(address(exampleMarket), true);
        
        console2.log("\n=== First Market Created ===");
        console2.log("ExampleMarket Address:", address(exampleMarket));
        console2.log("Market ID:", exampleMarket.marketId());
        (int256 qYes1, int256 qNo1) = exampleMarket.ammState();
        console2.log("Initial qYes:", uint256(qYes1));
        console2.log("Initial qNo:", uint256(qNo1));
        uint256 bMarket1 = riskManager.getBForMarket(exampleMarket.marketId());
        console2.log("b parameter:", bMarket1);

        // 11. Create second market (same adjudicator, same risk class)
        SoothMarket secondMarket =
            factory.createMarket(dummyAdjId, SoothRiskManager.RiskClass.MEDIUM);
        
        // Authorize second market on vault
        vault.setAuthorized(address(secondMarket), true);
        
        console2.log("\n=== Second Market Created ===");
        console2.log("SecondMarket Address:", address(secondMarket));
        console2.log("Market ID:", secondMarket.marketId());
        (int256 qYes2, int256 qNo2) = secondMarket.ammState();
        console2.log("Initial qYes:", uint256(qYes2));
        console2.log("Initial qNo:", uint256(qNo2));
        uint256 bMarket2 = riskManager.getBForMarket(secondMarket.marketId());
        console2.log("b parameter:", bMarket2);

        vm.stopBroadcast();

        console2.log("\n=== Deployment Summary ===");
        console2.log("Mock collateral:", address(collateral));
        console2.log("SoothVault:", address(vault));
        console2.log("SoothRiskManager:", address(riskManager));
        console2.log("SoothLMSRReal:", address(amm));
        console2.log("SoothAdjudicatorRegistry:", address(adjRegistry));
        console2.log("SoothSettlement:", address(settlement));
        console2.log("SoothMarketFactory:", address(factory));
        console2.log("ExampleMarket:", address(exampleMarket));
        console2.log("SecondMarket:", address(secondMarket));
        console2.log("Adjudicator ID:");
        console2.logBytes32(dummyAdjId);

        string memory json = "{";
        json = string.concat(json, "\"MockERC20\": \"", vm.toString(address(collateral)), "\",");
        json = string.concat(json, "\"SoothVault\": \"", vm.toString(address(vault)), "\",");
        json = string.concat(json, "\"SoothRiskManager\": \"", vm.toString(address(riskManager)), "\",");
        json = string.concat(json, "\"SoothLMSRReal\": \"", vm.toString(address(amm)), "\",");
        json = string.concat(json, "\"SoothAdjudicatorRegistry\": \"", vm.toString(address(adjRegistry)), "\",");
        json = string.concat(json, "\"SoothSettlement\": \"", vm.toString(address(settlement)), "\",");
        json = string.concat(json, "\"SoothMarketFactory\": \"", vm.toString(address(factory)), "\",");
        json = string.concat(json, "\"ExampleMarket\": \"", vm.toString(address(exampleMarket)), "\",");
        json = string.concat(json, "\"SecondMarket\": \"", vm.toString(address(secondMarket)), "\"");
        json = string.concat(json, "}");

        vm.writeFile("deployments.json", json);
        console2.log("\nWrote deployments to deployments.json");
    }
}
