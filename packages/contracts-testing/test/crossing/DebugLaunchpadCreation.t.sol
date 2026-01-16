// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {LaunchpadEngine} from "@core/LaunchpadEngine.sol";
import {AMMEngine} from "@core/AMMEngine.sol";
import {Collateralizer} from "@core/Collateralizer.sol";
import {TickBookPoolManager} from "@core/TickBookPoolManager.sol";
import {TickBookVault} from "@core/TickBookVault.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";

contract DebugLaunchpadCreation is Test {
    LaunchpadEngine launchpad;
    AMMEngine amm;
    Collateralizer collateralizer;
    TickBookPoolManager tickBook;
    TickBookVault vault;
    ERC20Mock usdc;

    address creator = address(0x123);
    address treasury = address(0x7EA5);
    address deployer;

    function setUp() public {
        deployer = address(this);

        usdc = new ERC20Mock();
        amm = new AMMEngine(address(usdc), deployer);
        collateralizer = new Collateralizer(address(usdc));
        vault = new TickBookVault(address(usdc), deployer);
        tickBook = new TickBookPoolManager(address(vault));
        vault.setTickBook(address(tickBook));

        launchpad = new LaunchpadEngine(
            address(usdc),
            address(amm),
            address(collateralizer),
            address(tickBook),
            treasury,
            deployer
        );

        amm.setRouter(address(launchpad));
    }

    function test_ReproduceCreateMarket() public {
        uint256 liquidity = 500 * 1e18;
        string memory symbol = "TEST";
        uint64 deadline = uint64(block.timestamp + 1 days);
        uint64 startTime = uint64(block.timestamp);

        usdc.mint(creator, 10000 * 1e18);

        vm.startPrank(creator);
        usdc.approve(address(launchpad), type(uint256).max);

        console.log("Calling createMarket...");
        try launchpad.createMarket("Question?", startTime, deadline, creator, creator, liquidity) returns (address market, uint256 lpTokens) {
            console.log("Success!");
            console.log("Market:", market);
            console.log("LP tokens:", lpTokens);
        } catch Error(string memory reason) {
            console.log("Reverted with reason:", reason);
            fail();
        } catch (bytes memory returnData) {
            console.logBytes(returnData);
            fail();
        }

        vm.stopPrank();
    }
}
