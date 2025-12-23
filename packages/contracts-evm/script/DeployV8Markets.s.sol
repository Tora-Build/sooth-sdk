// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {TruthMarket} from "../contracts/TruthMarket.sol";
import {LaunchpadEngine} from "../contracts/LaunchpadEngine.sol";
import {Collateralizer} from "../contracts/Collateralizer.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract DeployV8Markets is Script {
    function run() public {
        // Load addresses from deployment
        address launchpadEngine = vm.envAddress("LAUNCHPAD_ENGINE");
        address collateralizer = vm.envAddress("COLLATERALIZER");
        address guardian = vm.envAddress("GUARDIAN_ADDRESS");
        address adjudicator = vm.envAddress("DEFAULT_ADJUDICATOR");
        address usdc = vm.envAddress("USDC_ADDRESS");
        
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("=== V8 Markets Deployment ===");
        console.log("Creator:", deployer);
        console.log("LaunchpadEngine:", launchpadEngine);
        console.log("Collateralizer:", collateralizer);
        console.log("");
        
        // Market parameters
        uint256 bBase = 1000e18; // $1,000 liquidity per market
        uint256 deposit = (bBase * 693147180559945309) / 1e18; // b * ln(2)
        
        console.log("Liquidity per market:", bBase / 1e18, "USDC");
        console.log("Deposit per market:", deposit / 1e18, "USDC");
        console.log("Total deposit needed:", (deposit * 2) / 1e18, "USDC");
        console.log("");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // ============================================
        // Market 1: UN Confirms Alien Life
        // ============================================
        console.log("--- Market 1: UN Confirms Alien Life ---");
        
        uint64 deadline1 = uint64(block.timestamp + 30 days);
        TruthMarket market1 = new TruthMarket(
            "Will the United Nations officially confirm the existence of extraterrestrial life?",
            deadline1,
            adjudicator,
            guardian
        );
        console.log("1. TruthMarket deployed:", address(market1));
        
        // Register with Collateralizer
        Collateralizer(collateralizer).registerMarket(
            address(market1),
            "UN Confirms Alien Life",
            "ALIEN"
        );
        console.log("2. Registered with Collateralizer");
        
        // Activate market
        market1.activate();
        console.log("3. Market activated");
        
        // Initialize LaunchpadEngine
        IERC20(usdc).approve(launchpadEngine, deposit);
        LaunchpadEngine(launchpadEngine).createMarket(address(market1), bBase);
        console.log("4. LaunchpadEngine initialized");
        console.log("");
        
        // ============================================
        // Market 2: BTC 7-day TWAP >= $100k
        // ============================================
        console.log("--- Market 2: BTC TWAP ---");
        
        uint64 deadline2 = uint64(block.timestamp + 30 days);
        TruthMarket market2 = new TruthMarket(
            "Will Bitcoin's 7-day time-weighted average price reach or exceed $100,000?",
            deadline2,
            adjudicator,
            guardian
        );
        console.log("1. TruthMarket deployed:", address(market2));
        
        // Register with Collateralizer
        Collateralizer(collateralizer).registerMarket(
            address(market2),
            "BTC 7-day TWAP >= $100k",
            "BTC100K"
        );
        console.log("2. Registered with Collateralizer");
        
        // Activate market
        market2.activate();
        console.log("3. Market activated");
        
        // Initialize LaunchpadEngine
        IERC20(usdc).approve(launchpadEngine, deposit);
        LaunchpadEngine(launchpadEngine).createMarket(address(market2), bBase);
        console.log("4. LaunchpadEngine initialized");
        console.log("");
        
        vm.stopBroadcast();
        
        // Print summary
        console.log("=== Deployment Summary ===");
        console.log("Market 1 (Alien Life):", address(market1));
        console.log("  Question: Will the United Nations officially confirm the existence of extraterrestrial life?");
        console.log("  Deadline:", deadline1);
        console.log("");
        console.log("Market 2 (BTC TWAP):", address(market2));
        console.log("  Question: Will Bitcoin's 7-day time-weighted average price reach or exceed $100,000?");
        console.log("  Deadline:", deadline2);
        console.log("==========================");
        
        // Save to JSON
        string memory json = string.concat(
            '{\n',
            '  "market1": {\n',
            '    "address": "', vm.toString(address(market1)), '",\n',
            '    "question": "Will the United Nations officially confirm the existence of extraterrestrial life?",\n',
            '    "deadline": ', vm.toString(deadline1), ',\n',
            '    "liquidity": ', vm.toString(bBase), '\n',
            '  },\n',
            '  "market2": {\n',
            '    "address": "', vm.toString(address(market2)), '",\n',
            '    "question": "Will Bitcoin\'s 7-day time-weighted average price reach or exceed $100,000?",\n',
            '    "deadline": ', vm.toString(deadline2), ',\n',
            '    "liquidity": ', vm.toString(bBase), '\n',
            '  }\n',
            '}'
        );
        
        vm.writeFile("deployments/v8-markets.json", json);
        console.log("");
        console.log("Markets saved to: deployments/v8-markets.json");
    }
}
