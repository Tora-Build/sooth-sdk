// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {LaunchpadEngine} from "../contracts/LaunchpadEngine.sol";
import {TickBookPoolManager} from "../contracts/TickBookPoolManager.sol";
import {ITickBook} from "../contracts/interfaces/ITickBook.sol";

/**
 * @title DeployV9LaunchpadAndRegister
 * @notice Deploys new LaunchpadEngine with V9 TickBookPoolManager and registers existing markets
 *
 * Usage:
 *   forge script script/DeployV9Full.s.sol:DeployV9LaunchpadAndRegister --rpc-url $RPC_URL --broadcast
 *
 * Environment variables:
 *   - PRIVATE_KEY: Deployer private key
 */
contract DeployV9LaunchpadAndRegister is Script {
    // Base Sepolia V9 Contracts (already deployed)
    address constant POOL_MANAGER = 0x550CE2264FEc124b8341b8793e9AA31C386E5A7C;
    address constant USDC = 0x856FbEebD91Db28e3b4550e7602142Cfab683796;
    address constant COLLATERALIZER = 0xaB31D6CC191Ccd41b9f834a4Eb2cE84a82922106;
    address constant AMM_ENGINE = 0x8B621BDc1c52981845BF6cfffdCe99fE4DDD4513;
    
    // Existing markets on Base Sepolia
    address constant ALIEN_MARKET = 0xa4838e6E410570438d8B074e9459082b228A460C;
    address constant ALIEN_YES = 0x94Cc020f92351D9853ce1bdD52924979F70eE54c;
    address constant ALIEN_NO = 0x07527CD81fB606d897dbfa9E923Dc9c8bf136976;
    
    address constant BTC100K_MARKET = 0x8027387f1FD1963513661A0051AdD224244e186E;
    address constant BTC100K_YES = 0x92831dc962c41A13b202B344B8301Fa8c4237074;
    address constant BTC100K_NO = 0x074F213e08c88d373d91f312fC4d056be7A531e9;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy new LaunchpadEngine with TickBookPoolManager
        LaunchpadEngine launchpad = new LaunchpadEngine(
            USDC,
            AMM_ENGINE,
            COLLATERALIZER,
            POOL_MANAGER,  // TickBookPoolManager as tickBook
            deployer,      // protocol treasury
            deployer       // owner
        );
        console.log("LaunchpadEngine deployed at:", address(launchpad));



        vm.stopBroadcast();

        // Output deployment summary
        console.log("\n=== V9 Full Deployment Summary ===");
        console.log("Chain ID:", block.chainid);
        console.log("LaunchpadEngine:", address(launchpad));
        console.log("TickBookPoolManager:", POOL_MANAGER);
        console.log("\nRegistered Markets:");
        console.log("  - ALIEN:", ALIEN_MARKET);
        console.log("  - BTC100K:", BTC100K_MARKET);
        console.log("\nNext step: Update frontend deployments.json");
    }
}
