// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/core/SoothInterfaces.sol";
import "../contracts/core/SoothVault.sol";
import "../contracts/core/SoothBalancedAMM.sol";
import "../contracts/core/SoothLMSRReal.sol";
import "../contracts/core/SoothRiskManager.sol";
import "../contracts/core/SoothAdjudicatorRegistry.sol";
import "../contracts/core/SoothMarketFactory.sol";
import "../contracts/settlement/SoothSettlement.sol";

contract MockERC20 is IERC20 {
    string public name = "Mock USDC";
    string public symbol = "mUSDC";
    uint8 public decimals = 18;

    uint256 public override totalSupply;
    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

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
        vm.startBroadcast(deployerKey);

        // 1. Collateral token (for dev: deploy mock token)
        MockERC20 collateral = new MockERC20();
        collateral._mint(msg.sender, 1_000_000 ether);

        // 2. Vault
        SoothVault vault = new SoothVault(collateral);

        // 3. Risk manager
        SoothRiskManager riskManager = new SoothRiskManager(vault);

        // 4. AMM implementation (Balanced by default; LMSRReal is also available)
        SoothBalancedAMM balancedAmm = new SoothBalancedAMM();
        SoothLMSRReal lmsrReal = new SoothLMSRReal();

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

        // 8. Market factory (using Balanced AMM by default)
        SoothMarketFactory factory = new SoothMarketFactory(vault, riskManager, balancedAmm);

        // Authorize factory on vault for exposure allocation
        vault.setAuthorized(address(factory), true);

        // 9. Create an example market
        SoothMarket exampleMarket =
            factory.createMarket(dummyAdjId, SoothRiskManager.RiskClass.MEDIUM);

        vm.stopBroadcast();

        console2.log("Mock collateral:", address(collateral));
        console2.log("SoothVault:", address(vault));
        console2.log("SoothRiskManager:", address(riskManager));
        console2.log("SoothBalancedAMM:", address(balancedAmm));
        console2.log("SoothLMSRReal:", address(lmsrReal));
        console2.log("SoothAdjudicatorRegistry:", address(adjRegistry));
        console2.log("SoothSettlement:", address(settlement));
        console2.log("SoothMarketFactory:", address(factory));
        console2.log("Example SoothMarket:", address(exampleMarket));
        console2.logBytes32(dummyAdjId);
    }
}
