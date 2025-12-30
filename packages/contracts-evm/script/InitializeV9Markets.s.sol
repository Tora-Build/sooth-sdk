// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {LaunchpadEngine} from "../contracts/LaunchpadEngine.sol";
import {AMMEngine} from "../contracts/AMMEngine.sol";
import {ITruthMarket} from "../contracts/interfaces/ITruthMarket.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title InitializeV9Markets
 * @notice Deploys new LaunchpadEngine (with try-catch fix) and initializes target markets.
 */
contract InitializeV9Markets is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        // Chain-specific configuration
        address usdc;
        address ammEngine;
        address collateralizer;
        address poolManager;
        address alienTruth;
        address btcTruth;

        if (block.chainid == 84532) { // Base Sepolia
            usdc = 0x856FbEebD91Db28e3b4550e7602142Cfab683796;
            ammEngine = 0x8B621BDc1c52981845BF6cfffdCe99fE4DDD4513;
            collateralizer = 0xaB31D6CC191Ccd41b9f834a4Eb2cE84a82922106;
            poolManager = 0x550CE2264FEc124b8341b8793e9AA31C386E5A7C;
            alienTruth = 0xa4838e6E410570438d8B074e9459082b228A460C;
            btcTruth = 0x8027387f1FD1963513661A0051AdD224244e186E;
        } else if (block.chainid == 10143) { // Monad Testnet
            usdc = 0xf067C23BEE9D3d5c830ca0450A751836c181f566;
            ammEngine = 0x65b72e4d5138AeEdF55459B8f7527505217dcEBc;
            collateralizer = 0xF495702a9111513b7A2F77896021193312ddA851;
            poolManager = 0xc1A50BE14964F7bef7D58CcBeF53B0081fc8F3b7;
            alienTruth = 0x4104Fd842d00ad5Db634ec1183313e02D6A18Fd2;
            btcTruth = 0x1cB930d768AD866C3211A14894B1E924726bac0b;
        } else {
            revert("Unsupported chain");
        }

        // 1. Deploy new LaunchpadEngine
        LaunchpadEngine launchpad = new LaunchpadEngine(
            usdc,
            ammEngine,
            collateralizer,
            poolManager,
            deployer,
            deployer
        );
        console.log("New LaunchpadEngine deployed at:", address(launchpad));

        // 2. Set AMMEngine router
        AMMEngine(ammEngine).setRouter(address(launchpad));
        console.log("AMM Engine router updated to new LaunchpadEngine");

        // 3. Approve USDC for LaunchpadEngine
        IERC20(usdc).approve(address(launchpad), type(uint256).max);
        console.log("USDC approved for LaunchpadEngine");

        // 4. Initialize Markets (Must be called by TruthMarket creator)
        // If the deployer is not the creator, this will revert.
        // On our testnets, the deployer is usually the creator.
        
        uint256 standardLiquidity = 1000 * 1e18; // b=1000 (Standard Tier)
        
        if (alienTruth != address(0)) {
            console.log("Initializing ALIEN market...");
            try launchpad.createMarket(alienTruth, standardLiquidity, "UN Confirms Alien Life", "ALIEN") {
                console.log("ALIEN market initialized on LaunchpadEngine");
            } catch Error(string memory reason) {
                console.log("ALIEN init failed (Error):", reason);
            } catch (bytes memory lowLevelData) {
                console.log("ALIEN init failed (LowLevel)");
                console.logBytes(lowLevelData);
            }
        }
        
        if (btcTruth != address(0)) {
            console.log("Initializing BTC100K market...");
            try launchpad.createMarket(btcTruth, standardLiquidity, "BTC TWAP >= $100k", "BTC100K") {
                console.log("BTC100K market initialized on LaunchpadEngine");
            } catch Error(string memory reason) {
                console.log("BTC100K init failed (Error):", reason);
            } catch (bytes memory lowLevelData) {
                console.log("BTC100K init failed (LowLevel)");
                console.logBytes(lowLevelData);
            }
        }

        vm.stopBroadcast();
    }
}
