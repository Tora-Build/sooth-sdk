// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/core/SoothTraderVaultV4.sol";
import "../contracts/core/SoothMarketV4.sol";
import "../contracts/core/OutcomeToken.sol";
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
        require(balanceOf[msg.sender] >= amount, "ERC20: insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[recipient] += amount;
        return true;
    }
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool) {
        require(allowance[sender][msg.sender] >= amount, "ERC20: insufficient allowance");
        require(balanceOf[sender] >= amount, "ERC20: insufficient balance");
        
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

/// @title DeployV4
/// @notice Deployment script for Sooth V4 (Lock-on-Buy Architecture)
contract DeployV4 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        vm.startBroadcast(deployerPrivateKey);

        console.log("=== Deploying Sooth Protocol V4 ===");
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);

        // 1. Deploy MockUSDC
        MockUSDC usdc = new MockUSDC();
        usdc.mint(deployer, 1_000_000 * 1e18);
        console.log("MockUSDC:", address(usdc));

        // 2. Deploy FeeController
        SoothFeeController feeController = new SoothFeeController(deployer);
        feeController.setOrderbookFee(10); // 0.1%
        console.log("FeeController:", address(feeController));

        // 3. Deploy GovernorVault
        SoothGovernorVault governorVault = new SoothGovernorVault(IERC20(address(usdc)));
        console.log("GovernorVault:", address(governorVault));

        // 4. Deploy TraderVaultV4
        SoothTraderVaultV4 traderVault = new SoothTraderVaultV4(
            IERC20(address(usdc)), 
            ISoothGovernorVault(address(governorVault))
        );
        console.log("TraderVaultV4:", address(traderVault));

        // 5. Deploy OutcomeToken (ERC1155)
        OutcomeToken outcomeToken = new OutcomeToken();
        console.log("OutcomeToken:", address(outcomeToken));

        // 6. Deploy MarketV4
        SoothMarketV4 market = new SoothMarketV4();
        console.log("MarketV4:", address(market));

        // 7. Initialize OutcomeToken
        outcomeToken.initialize(address(market), address(traderVault));
        console.log("OutcomeToken initialized");

        // 8. Initialize Market
        uint256 bParam = 10_000 * 1e18; // Liquidity parameter
        uint16 initialTick = 500;       // 50% probability
        
        market.initialize(
            1,                          // marketId
            address(governorVault),
            address(traderVault),
            address(feeController),
            address(outcomeToken),
            bytes32(0),                 // adjudicatorId
            bParam,
            deployer,                   // governor
            initialTick
        );
        console.log("MarketV4 initialized");

        // 9. Configure permissions
        traderVault.setMarket(address(market), true);
        governorVault.setAuthorized(address(traderVault), true);
        governorVault.setAuthorized(address(market), true);
        console.log("Permissions configured");

        // 10. Fund GovernorVault with initial liquidity
        usdc.approve(address(governorVault), 100_000 * 1e18);
        usdc.transfer(address(governorVault), 100_000 * 1e18);
        governorVault.setAuthorized(deployer, true);
        governorVault.receiveFunds(1, 100_000 * 1e18);
        console.log("GovernorVault funded with 100k USDC");

        vm.stopBroadcast();

        // Summary
        console.log("");
        console.log("=== V4 Deployment Complete ===");
        console.log("");
        console.log("Contracts:");
        console.log("  MockUSDC:", address(usdc));
        console.log("  FeeController:", address(feeController));
        console.log("  GovernorVault:", address(governorVault));
        console.log("  TraderVaultV4:", address(traderVault));
        console.log("  OutcomeToken:", address(outcomeToken));
        console.log("  MarketV4:", address(market));
        console.log("");
        console.log("Key Parameters:");
        console.log("  Lock Duration: 24 hours");
        console.log("  Initial Tick: 500 (50%)");
        console.log("  Liquidity (b): 10,000");
    }
}
