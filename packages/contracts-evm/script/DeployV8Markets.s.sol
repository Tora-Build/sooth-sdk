// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {TruthMarket} from "../contracts/TruthMarket.sol";
import {LaunchpadEngine} from "../contracts/LaunchpadEngine.sol";
import {Collateralizer} from "../contracts/Collateralizer.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract DeployV8Markets is Script {
    struct DeployedMarket {
        address market;
        address yesToken;
        address noToken;
        uint64 deadline;
    }

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
        
        DeployedMarket memory m1;
        m1.deadline = uint64(block.timestamp + 30 days);
        TruthMarket market1 = new TruthMarket(
            "Will the United Nations officially confirm the existence of extraterrestrial life?",
            m1.deadline,
            adjudicator,
            guardian
        );
        m1.market = address(market1);
        console.log("1. TruthMarket deployed:", m1.market);
        
        // Register with Collateralizer (capture token addresses for frontend config)
        (m1.yesToken, m1.noToken) = Collateralizer(collateralizer).registerMarket(
            m1.market,
            "UN Confirms Alien Life",
            "ALIEN"
        );
        console.log("2. Registered with Collateralizer");
        console.log("   YES token:", m1.yesToken);
        console.log("   NO token:", m1.noToken);
        
        // Activate market
        market1.activate();
        console.log("3. Market activated");
        
        // Initialize LaunchpadEngine
        IERC20(usdc).approve(launchpadEngine, deposit);
        LaunchpadEngine(launchpadEngine).createMarket(
            m1.market,
            bBase,
            "UN Confirms Alien Life",
            "ALIEN"
        );
        console.log("4. LaunchpadEngine initialized");
        console.log("");
        
        // ============================================
        // Market 2: BTC 7-day TWAP >= $100k
        // ============================================
        console.log("--- Market 2: BTC TWAP ---");
        
        DeployedMarket memory m2;
        m2.deadline = uint64(block.timestamp + 30 days);
        TruthMarket market2 = new TruthMarket(
            "Will Bitcoin's 7-day time-weighted average price reach or exceed $100,000?",
            m2.deadline,
            adjudicator,
            guardian
        );
        m2.market = address(market2);
        console.log("1. TruthMarket deployed:", m2.market);
        
        // Register with Collateralizer (capture token addresses for frontend config)
        (m2.yesToken, m2.noToken) = Collateralizer(collateralizer).registerMarket(
            m2.market,
            "BTC 7-day TWAP >= $100k",
            "BTC100K"
        );
        console.log("2. Registered with Collateralizer");
        console.log("   YES token:", m2.yesToken);
        console.log("   NO token:", m2.noToken);
        
        // Activate market
        market2.activate();
        console.log("3. Market activated");
        
        // Initialize LaunchpadEngine
        IERC20(usdc).approve(launchpadEngine, deposit);
        LaunchpadEngine(launchpadEngine).createMarket(
            m2.market,
            bBase,
            "BTC 7-day TWAP >= $100k",
            "BTC100K"
        );
        console.log("4. LaunchpadEngine initialized");
        console.log("");
        
        vm.stopBroadcast();
        
        // Print summary
        console.log("=== Deployment Summary ===");
        console.log("Market 1 (Alien Life):", m1.market);
        console.log("  Question: Will the United Nations officially confirm the existence of extraterrestrial life?");
        console.log("  Deadline:", m1.deadline);
        console.log("");
        console.log("Market 2 (BTC TWAP):", m2.market);
        console.log("  Question: Will Bitcoin's 7-day time-weighted average price reach or exceed $100,000?");
        console.log("  Deadline:", m2.deadline);
        console.log("==========================");
        
        // Save to JSON (include token addresses for UI config)
        // Build incrementally to avoid "stack too deep" during compilation.
        string memory json = "{\n";
        json = string.concat(json, '  "market1": {\n');
        json = string.concat(json, '    "address": "', vm.toString(m1.market), '",\n');
        json = string.concat(json, '    "question": "Will the United Nations officially confirm the existence of extraterrestrial life?",\n');
        json = string.concat(json, '    "deadline": ', vm.toString(m1.deadline), ',\n');
        json = string.concat(json, '    "liquidity": ', vm.toString(bBase), ',\n');
        json = string.concat(json, '    "yesToken": "', vm.toString(m1.yesToken), '",\n');
        json = string.concat(json, '    "noToken": "', vm.toString(m1.noToken), '"\n');
        json = string.concat(json, "  },\n");
        json = string.concat(json, '  "market2": {\n');
        json = string.concat(json, '    "address": "', vm.toString(m2.market), '",\n');
        json = string.concat(json, '    "question": "Will Bitcoin\'s 7-day time-weighted average price reach or exceed $100,000?",\n');
        json = string.concat(json, '    "deadline": ', vm.toString(m2.deadline), ',\n');
        json = string.concat(json, '    "liquidity": ', vm.toString(bBase), ',\n');
        json = string.concat(json, '    "yesToken": "', vm.toString(m2.yesToken), '",\n');
        json = string.concat(json, '    "noToken": "', vm.toString(m2.noToken), '"\n');
        json = string.concat(json, "  }\n");
        json = string.concat(json, "}");
        
        vm.writeFile("deployments/v8-markets.json", json);
        console.log("");
        console.log("Markets saved to: deployments/v8-markets.json");
    }
}
