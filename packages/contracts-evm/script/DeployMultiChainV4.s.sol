// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/core/SoothTraderVaultV4.sol";
import "../contracts/core/SoothMarketV4.sol";
import "../contracts/core/OutcomeToken.sol";
import "../contracts/core/SoothGovernorVault.sol";
import "../contracts/core/SoothFeeController.sol";
import "../contracts/core/SoothInterfaces.sol";

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

        // 3. GovernorVault
        SoothGovernorVault governorVault = new SoothGovernorVault(IERC20(address(usdc)));
        console.log("[3/4] GovernorVault:", address(governorVault));

        // 4. TraderVaultV4
        SoothTraderVaultV4 traderVault = new SoothTraderVaultV4(
            IERC20(address(usdc)), 
            ISoothGovernorVault(address(governorVault))
        );
        console.log("[4/4] TraderVaultV4:", address(traderVault));

        // 5. Setup permissions
        governorVault.setAuthorized(address(traderVault), true);
        governorVault.setAuthorized(deployer, true);

        // 6. Fund vault with initial liquidity
        usdc.approve(address(governorVault), 500_000 * 1e18);
        usdc.transfer(address(governorVault), 500_000 * 1e18);
        governorVault.receiveFunds(0, 500_000 * 1e18);

        // ==================== PHASE 2: MARKETS ====================

        console.log("\n=== Deploying Markets ===");

        // Market 1: UN Confirms Alien Life
        OutcomeToken outcomeToken1 = new OutcomeToken();
        SoothMarketV4 market1 = new SoothMarketV4();
        
        outcomeToken1.initialize(address(market1), address(traderVault));
        
        market1.initialize(
            1,                          // marketId
            address(governorVault),
            address(traderVault),
            address(feeController),
            address(outcomeToken1),
            bytes32(0),                 // adjudicatorId
            10_000 * 1e18,              // bBase = 10k
            deployer,                   // governor
            0,                          // initialQYes (50% probability)
            0                           // initialQNo (50% probability)
        );
        
        traderVault.setMarket(address(market1), true);
        traderVault.setOutcomeToken(address(outcomeToken1), true);
        governorVault.setAuthorized(address(market1), true);
        
        console.log("\nMarket 1: UN Confirms Alien Life");
        console.log("  Address:", address(market1));
        console.log("  OutcomeToken:", address(outcomeToken1));

        // Market 2: BTC 7-day TWAP >= $100k
        OutcomeToken outcomeToken2 = new OutcomeToken();
        SoothMarketV4 market2 = new SoothMarketV4();
        
        outcomeToken2.initialize(address(market2), address(traderVault));
        
        market2.initialize(
            2,                          // marketId
            address(governorVault),
            address(traderVault),
            address(feeController),
            address(outcomeToken2),
            bytes32(0),                 // adjudicatorId
            15_000 * 1e18,              // bBase = 15k (higher liquidity)
            deployer,                   // governor
            0,                          // initialQYes (50% probability)
            0                           // initialQNo (50% probability)
        );
        
        traderVault.setMarket(address(market2), true);
        traderVault.setOutcomeToken(address(outcomeToken2), true);
        governorVault.setAuthorized(address(market2), true);
        
        console.log("\nMarket 2: BTC 7-day TWAP >= $100k");
        console.log("  Address:", address(market2));
        console.log("  OutcomeToken:", address(outcomeToken2));

        vm.stopBroadcast();

        // ==================== SUMMARY ====================
        console.log("\n========================================");
        console.log("=== DEPLOYMENT COMPLETE ===");
        console.log("========================================");
        console.log("Chain ID:", block.chainid);
        console.log("\nInfrastructure:");
        console.log("  MockUSDC:", address(usdc));
        console.log("  GovernorVault:", address(governorVault));
        console.log("  TraderVaultV4:", address(traderVault));
        console.log("  FeeController:", address(feeController));
        console.log("\nMarkets:");
        console.log("  Market1 (Alien):", address(market1));
        console.log("  Token1:", address(outcomeToken1));
        console.log("  Market2 (BTC):", address(market2));
        console.log("  Token2:", address(outcomeToken2));
        console.log("========================================");
    }
}
