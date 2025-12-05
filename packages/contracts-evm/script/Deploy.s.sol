// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/core/SoothTraderVault.sol";
import "../contracts/core/SoothMarket.sol";
import "../contracts/core/SoothLMSRReal.sol";
import "../contracts/core/SoothGovernorVault.sol";
import "../contracts/core/SoothFeeController.sol";
import "../contracts/core/SoothInterfaces.sol";

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

contract Deploy is Script {
    // Addresses
    address constant BASE_SEPOLIA_USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // Always deploy MockUSDC for consistency across all networks
        vm.startBroadcast(deployerPrivateKey);
        MockUSDC mock = new MockUSDC();
        mock.mint(deployer, 1_000_000 * 1e18); // Mint 1M to deployer
        address usdc = address(mock);
        vm.stopBroadcast();
        
        console.log("Network:", block.chainid == 84532 ? "Base Sepolia" : block.chainid == 10143 ? "Monad Testnet" : "Unknown");
        console.log("Deployed MockUSDC at:", usdc);

        vm.startBroadcast(deployerPrivateKey);

        console.log("Deploying Sooth v3...");
        console.log("Deployer:", deployer);
        console.log("USDC:", usdc);

        // 1. Deploy Core Infrastructure (if not reusing)
        // For v3, we'll deploy fresh instances to ensure clean state
        
        SoothLMSRReal amm = new SoothLMSRReal();
        console.log("SoothLMSRReal deployed at:", address(amm));

        SoothFeeController feeController = new SoothFeeController(deployer); // Deployer as treasury
        feeController.setOrderbookFee(10); // 0.1%
        console.log("SoothFeeController deployed at:", address(feeController));

        SoothGovernorVault governorVault = new SoothGovernorVault(IERC20(usdc));
        console.log("SoothGovernorVault deployed at:", address(governorVault));

        // 2. Deploy TraderVault v3
        SoothTraderVault traderVault = new SoothTraderVault(IERC20(usdc), ISoothGovernorVault(address(governorVault)));
        console.log("SoothTraderVault deployed at:", address(traderVault));

        // 3. Deploy Market v3 (Example Market: "Will ETH hit $4000 in 2025?")
        SoothMarket market = new SoothMarket();
        console.log("SoothMarket deployed at:", address(market));

        // 4. Initialize Market
        uint256 bParam = 10000 * 1e18; // 10,000 liquidity
        int256 initialQ = 1000 * 1e18; // Initial quantity
        
        market.initialize(
            1, // marketId
            ISoothGovernorVault(address(governorVault)),
            address(traderVault),
            ISoothAMM(address(amm)),
            ISoothFeeController(address(feeController)),
            bytes32(0), // adjudicatorId
            bParam,
            50, // 0.5% LMSR fee
            deployer, // governor
            initialQ
        );
        console.log("Market initialized");

        // 5. Configure TraderVault
        traderVault.setMarket(address(market), true);
        traderVault.setGovernorVault(ISoothGovernorVault(address(governorVault)));
        
        // Authorize TraderVault (and deployer) in GovernorVault
        governorVault.setAuthorized(address(traderVault), true);
        governorVault.setAuthorized(deployer, true);
        console.log("TraderVault authorized in GovernorVault");

        vm.stopBroadcast();

        // Output deployment info to console
        console.log("--- Deployment Summary ---");
        console.log("MockUSDC:", usdc);
        console.log("TraderVault:", address(traderVault));
        console.log("Market:", address(market));
        console.log("AMM:", address(amm));
        console.log("GovernorVault:", address(governorVault));
        console.log("FeeController:", address(feeController));
    }
}
