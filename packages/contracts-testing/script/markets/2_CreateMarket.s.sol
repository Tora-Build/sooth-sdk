// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {LaunchpadEngine} from "@core/LaunchpadEngine.sol";
import {Collateralizer} from "@core/Collateralizer.sol";
import {TruthMarket} from "@core/TruthMarket.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title 2_CreateMarket
 * @notice STEP 2: Create a new prediction market with full initialization
 * @dev This script does EVERYTHING needed to create a working market:
 *      1. Deploy TruthMarket contract
 *      2. Activate the market
 *      3. Register with Collateralizer (creates tokens)
 *      4. Initialize in LaunchpadEngine (creates AMM pool with liquidity)
 *
 * REQUIREMENTS:
 *      - USDC balance >= initialLiquidity * ln(2) ≈ initialLiquidity * 0.693
 *      - LAUNCHPAD_ENGINE environment variable set
 *      - COLLATERALIZER environment variable set
 *
 * EXAMPLE:
 *      export LAUNCHPAD_ENGINE=0x...
 *      export COLLATERALIZER=0x...
 *      forge script script/2_CreateMarket.s.sol --rpc-url $RPC --broadcast
 */
contract CreateMarket is Script {
    address constant USDC = 0x0C31bbB6dA82ba97fBAfBe3425ee8757a4d724e3;

    // Market configuration - EDIT THESE
    string constant QUESTION = "Will UN confirm alien life by 2026?";
    string constant NAME = "UN Confirms Alien Life";
    string constant SYMBOL = "ALIEN";
    uint64 constant DEADLINE_DAYS = 30; // Days from now
    uint256 constant INITIAL_LIQUIDITY = 500 * 1e18; // 500 WAD

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        address launchpadAddr = vm.envAddress("LAUNCHPAD_ENGINE");
        address collateralizerAddr = vm.envAddress("COLLATERALIZER");

        console.log("========================================");
        console.log("  STEP 2: CREATE MARKET");
        console.log("========================================");
        console.log("Question:", QUESTION);
        console.log("Symbol:", SYMBOL);
        console.log("Deployer (creator):", deployer);
        console.log("");

        // Calculate required deposit
        uint256 ln2 = 693147180559945309; // ln(2) in WAD
        uint256 depositWad = (INITIAL_LIQUIDITY * ln2) / 1e18;
        uint256 depositUsdc = (depositWad * 1e6) / 1e18; // Convert to 6 decimals

        uint256 balance = IERC20(USDC).balanceOf(deployer);
        console.log("Required USDC:", depositUsdc);
        console.log("Your balance:", balance);
        require(balance >= depositUsdc, "Insufficient USDC");

        vm.startBroadcast(deployerPrivateKey);

        // STEP 1: Deploy TruthMarket
        uint64 deadline = uint64(block.timestamp + (DEADLINE_DAYS * 1 days));
        TruthMarket market = new TruthMarket(
            QUESTION,
            deadline,
            deployer,  // adjudicator
            deployer   // guardian
        );
        console.log("[1/4] TruthMarket deployed:", address(market));

        // STEP 2: Activate market
        market.activate();
        console.log("[2/4] Market activated");

        // STEP 3: Register with Collateralizer (creates tokens)
        Collateralizer collat = Collateralizer(collateralizerAddr);
        (address yesToken, address noToken) = collat.registerMarket(address(market), NAME, SYMBOL);
        console.log("[3/4] Market registered with Collateralizer");
        console.log("      YES token:", yesToken);
        console.log("      NO token:", noToken);

        // STEP 4: Initialize in LaunchpadEngine (creates AMM pool)
        LaunchpadEngine launchpad = LaunchpadEngine(launchpadAddr);
        IERC20(USDC).approve(address(launchpad), type(uint256).max);

        uint256 lpTokens = launchpad.createMarket(address(market), INITIAL_LIQUIDITY, NAME, SYMBOL);
        console.log("[4/4] Market initialized in LaunchpadEngine");
        console.log("      LP tokens received:", lpTokens);
        console.log("      USDC deposited:", depositUsdc);

        vm.stopBroadcast();

        console.log("");
        console.log("========================================");
        console.log("  MARKET CREATED SUCCESSFULLY");
        console.log("========================================");
        console.log("");
        console.log("Market Details:");
        console.log("  Address:    ", address(market));
        console.log("  YES Token:  ", yesToken);
        console.log("  NO Token:   ", noToken);
        console.log("  Deadline:   ", deadline);
        console.log("  LP Tokens:  ", lpTokens);
        console.log("");
        console.log("========================================");
        console.log("  ADD TO markets.json");
        console.log("========================================");
        console.log("{");
        console.log('  "id": "', SYMBOL, '-base",');
        console.log('  "chainId": 84532,');
        console.log('  "address": "', vm.toString(address(market)), '",');
        console.log('  "yesToken": "', vm.toString(yesToken), '",');
        console.log('  "noToken": "', vm.toString(noToken), '",');
        console.log('  "name": "', NAME, '",');
        console.log('  "symbol": "', SYMBOL, '"');
        console.log("}");
    }
}
