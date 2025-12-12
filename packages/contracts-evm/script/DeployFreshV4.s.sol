// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/mocks/MockUSDC.sol";
import "../contracts/core/SoothFeeController.sol";
import "../contracts/core/SoothGovernorVault.sol";
import "../contracts/core/SoothTraderVaultV4.sol";
import "../contracts/core/SoothMarketV4.sol";
import "../contracts/core/OutcomeToken.sol";

contract DeployFreshV4 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        vm.startBroadcast(deployerPrivateKey);

        console.log("=== Deploying Fresh V4 System ===");
        
        // 1. Use Existing USDC
        MockUSDC usdc = MockUSDC(0x2D2Aed066C34523913ab7084B668bFf3529cB176);
        console.log("Using Existing USDC:", address(usdc));

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

        // 5. Deploy Markets
        
        // Market 1
        OutcomeToken outcomeToken1 = new OutcomeToken();
        SoothMarketV4 market1 = new SoothMarketV4();
        outcomeToken1.initialize(address(market1), address(traderVault));
        market1.initialize(
            1, address(governorVault), address(traderVault), address(feeController),
            address(outcomeToken1), bytes32(0), 10_000e18, deployer, 0, 0
        );
        traderVault.setMarket(address(market1), true);
        governorVault.setAuthorized(address(market1), true);
        governorVault.setAuthorized(address(traderVault), true); // Vault needs to move funds
        
        console.log("Market 1 (Alien):", address(market1));
        console.log("OutcomeToken 1:", address(outcomeToken1));

        // Market 2
        OutcomeToken outcomeToken2 = new OutcomeToken();
        SoothMarketV4 market2 = new SoothMarketV4();
        outcomeToken2.initialize(address(market2), address(traderVault));
        market2.initialize(
            2, address(governorVault), address(traderVault), address(feeController),
            address(outcomeToken2), bytes32(0), 15_000e18, deployer, 0, 0
        );
        traderVault.setMarket(address(market2), true);
        governorVault.setAuthorized(address(market2), true);

        console.log("Market 2 (BTC):", address(market2));
        console.log("OutcomeToken 2:", address(outcomeToken2));

        vm.stopBroadcast();
    }
}
