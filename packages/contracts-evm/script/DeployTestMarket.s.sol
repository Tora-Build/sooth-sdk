// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {TruthMarket} from "../contracts/TruthMarket.sol";
import {LaunchpadEngine} from "../contracts/LaunchpadEngine.sol";
import {Collateralizer} from "../contracts/Collateralizer.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract DeployTestMarket is Script {
    function run() public {
        // Load addresses from deployment
        address launchpadEngine = vm.envAddress("LAUNCHPAD_ENGINE");
        address collateralizer = vm.envAddress("COLLATERALIZER");
        address guardian = vm.envAddress("GUARDIAN_ADDRESS");
        address adjudicator = vm.envAddress("DEFAULT_ADJUDICATOR");
        address usdc = vm.envAddress("USDC_ADDRESS");
        
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("=== Test Market Deployment ===");
        console.log("Creator:", deployer);
        console.log("LaunchpadEngine:", launchpadEngine);
        console.log("Collateralizer:", collateralizer);
        console.log("");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // 1. Deploy TruthMarket
        uint64 deadline = uint64(block.timestamp + 7 days);
        TruthMarket market = new TruthMarket(
            "Will ETH > $5000 by EOY 2025?",
            deadline,
            adjudicator,
            guardian
        );
        console.log("1. TruthMarket deployed:", address(market));
        
        // 2. Register with Collateralizer
        Collateralizer(collateralizer).registerMarket(
            address(market),
            "ETH > $5000 by EOY 2025",
            "ETH5K"
        );
        console.log("2. Market registered with Collateralizer");
        
        // 3. Activate market
        market.activate();
        console.log("3. Market activated");
        
        // 4. Create market in LaunchpadEngine (requires USDC approval)
        uint256 bBase = 1000e18; // $1,000 liquidity
        uint256 deposit = (bBase * 693147180559945309) / 1e18; // b * ln(2)
        
        console.log("4. Creating market in LaunchpadEngine...");
        console.log("   Liquidity (b):", bBase / 1e18, "USDC");
        console.log("   Required deposit:", deposit / 1e18, "USDC");
        
        // Approve USDC
        IERC20(usdc).approve(launchpadEngine, deposit);
        console.log("   USDC approved");
        
        // Create market
        LaunchpadEngine(launchpadEngine).createMarket(address(market), bBase);
        console.log("   Market created in LaunchpadEngine");
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("=== Test Market Summary ===");
        console.log("Market:", address(market));
        console.log("Question: Will ETH > $5000 by EOY 2025?");
        console.log("Deadline:", deadline);
        console.log("Liquidity:", bBase / 1e18, "USDC");
        console.log("Creator Deposit:", deposit / 1e18, "USDC");
        console.log("===========================");
        
        // Save to JSON
        string memory json = string.concat(
            '{\n',
            '  "market": "', vm.toString(address(market)), '",\n',
            '  "question": "Will ETH > $5000 by EOY 2025?",\n',
            '  "deadline": ', vm.toString(deadline), ',\n',
            '  "liquidity": ', vm.toString(bBase), ',\n',
            '  "deposit": ', vm.toString(deposit), '\n',
            '}'
        );
        
        vm.writeFile("deployments/test-market-latest.json", json);
        console.log("");
        console.log("Market saved to: deployments/test-market-latest.json");
    }
}
