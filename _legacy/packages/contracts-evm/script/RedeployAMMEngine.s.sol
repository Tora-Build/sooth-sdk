// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {AMMEngine} from "../contracts/AMMEngine.sol";
import {LaunchpadEngine} from "../contracts/LaunchpadEngine.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title RedeployAMMEngine
 * @notice Redeploys AMMEngine and LaunchpadEngine to reset state.
 */
contract RedeployAMMEngine is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        // Chain-specific constants for Base Sepolia
        address usdc = 0x856FbEebD91Db28e3b4550e7602142Cfab683796;
        address collateralizer = 0xaB31D6CC191Ccd41b9f834a4Eb2cE84a82922106;
        address poolManager = 0x550CE2264FEc124b8341b8793e9AA31C386E5A7C;
        address alienTruth = 0xa4838e6E410570438d8B074e9459082b228A460C;
        address btcTruth = 0x8027387f1FD1963513661A0051AdD224244e186E;

        // 1. Deploy New AMMEngine
        AMMEngine ammEngine = new AMMEngine(usdc, deployer);
        console.log("New AMMEngine deployed at:", address(ammEngine));

        // 2. Deploy New LaunchpadEngine
        LaunchpadEngine launchpad = new LaunchpadEngine(
            usdc,
            address(ammEngine),
            collateralizer,
            poolManager,
            deployer,
            deployer
        );
        console.log("New LaunchpadEngine deployed at:", address(launchpad));

        // 3. Set Router
        ammEngine.setRouter(address(launchpad));
        console.log("AMMEngine router set to LaunchpadEngine");

        // 4. Approve USDC for Liquidity Seeding
        IERC20(usdc).approve(address(launchpad), type(uint256).max);
        
        // 5. Initialize Markets
        uint256 standardLiquidity = 1000 * 1e18; // b=1000

        try launchpad.createMarket(alienTruth, standardLiquidity, "UN Confirms Alien Life", "ALIEN") {
            console.log("ALIEN market initialized");
        } catch Error(string memory reason) {
            console.log("ALIEN init failed:", reason);
        }

        try launchpad.createMarket(btcTruth, standardLiquidity, "BTC TWAP >= $100k", "BTC100K") {
            console.log("BTC100K market initialized");
        } catch Error(string memory reason) {
            console.log("BTC100K init failed:", reason);
        }

        vm.stopBroadcast();
    }
}
