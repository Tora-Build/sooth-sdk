// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/core/SoothTraderVault.sol";
import "../contracts/core/SoothMarket.sol";
import "../contracts/core/SoothLMSRReal.sol";
import "../contracts/core/SoothGovernorVault.sol";
import "../contracts/core/SoothFeeController.sol";
import "../contracts/core/SoothInterfaces.sol";
import "../contracts/router/SoothRouter.sol";

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

contract DeployMegaETH is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        console.log("Deployer:", deployer);
        
        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy MockUSDC
        MockUSDC usdc = new MockUSDC();
        usdc.mint(deployer, 100_000_000 * 1e18); // Mint 100M to deployer
        console.log("MockUSDC:", address(usdc));

        // 2. Deploy Core Infrastructure
        SoothLMSRReal amm = new SoothLMSRReal();
        console.log("AMM:", address(amm));

        SoothFeeController feeController = new SoothFeeController(deployer);
        feeController.setOrderbookFee(10); // 0.1%
        console.log("FeeController:", address(feeController));

        SoothGovernorVault governorVault = new SoothGovernorVault(IERC20(address(usdc)));
        console.log("GovernorVault:", address(governorVault));

        SoothTraderVault traderVault = new SoothTraderVault(IERC20(address(usdc)), ISoothGovernorVault(address(governorVault)));
        console.log("TraderVault:", address(traderVault));

        governorVault.setAuthorized(address(traderVault), true);
        governorVault.setAuthorized(deployer, true);

        // 3. Deploy 5 Markets
        deployMarket(1, "BTC Price > $100k?", address(governorVault), address(traderVault), address(amm), address(feeController), deployer, 43281 * 1e18); // Low Risk
        deployMarket(2, "ETH Gas > 100 gwei?", address(governorVault), address(traderVault), address(amm), address(feeController), deployer, 43281 * 1e18); // Low Risk
        deployMarket(3, "MegaETH Launch Q1 2026?", address(governorVault), address(traderVault), address(amm), address(feeController), deployer, 72135 * 1e18); // Medium Risk
        deployMarket(4, "Sooth TVL > $10M?", address(governorVault), address(traderVault), address(amm), address(feeController), deployer, 100989 * 1e18); // High Risk
        deployMarket(5, "MegaETH Top 10 L1?", address(governorVault), address(traderVault), address(amm), address(feeController), deployer, 129843 * 1e18); // High Risk

        // 4. Deploy Router
        SoothRouter router = new SoothRouter(address(traderVault));
        console.log("Router:", address(router));

        vm.stopBroadcast();
    }

    function deployMarket(
        uint256 id, 
        string memory desc, 
        address gov, 
        address trader, 
        address amm, 
        address fee, 
        address deployer,
        uint256 bParam
    ) internal {
        SoothMarket market = new SoothMarket();
        market.initialize(
            id,
            gov,
            trader,
            fee,
            bytes32(uint256(id)), // Simple adjudicator ID derived from market ID
            bParam,
            deployer,
            500 // Initial Tick (50%)
        );
        
        SoothTraderVault(trader).setMarket(address(market), true);
        console.log(string.concat("Market ", vm.toString(id), " (", desc, "):"), address(market));
    }
}
