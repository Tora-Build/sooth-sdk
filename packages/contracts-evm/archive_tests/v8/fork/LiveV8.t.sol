// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IAMMEngine} from "../../../contracts/interfaces/IAMMEngine.sol";
import {ILaunchpadEngine} from "../../../contracts/interfaces/ILaunchpadEngine.sol";
import {ITruthMarket} from "../../../contracts/interfaces/ITruthMarket.sol";

/**
 * @title LiveV8Test
 * @notice Fork tests against live Base Sepolia V8.4.0 deployment
 * @dev Run with: forge test --match-contract LiveV8Test --fork-url https://sepolia.base.org -vvv
 */
contract LiveV8Test is Test {
    // V8.4.0 Base Sepolia Deployment
    address constant LAUNCHPAD_ENGINE = 0xaf8e68Dfc5e129a33735EE7Df900500D9bb37c88;
    address constant AMM_ENGINE = 0x2646453758922d1500362AAbc385A8cf02D82ee9;
    address constant COLLATERALIZER = 0xc3b53dAcbEE7F240a2c9Da05cef8ac7AbE02A767;
    address constant TICK_BOOK = 0xDb710FA6B587ba2e6fB56a0D5166C029f6852D57;
    address constant MOCK_USDC = 0x856FbEebD91Db28e3b4550e7602142Cfab683796;

    // Test wallet (impersonated)
    address constant DEPLOYER = 0xEfdB15EE6e7C7C7906cb230AfF1EDb75CcBaA74F;

    ILaunchpadEngine public launchpad;
    IAMMEngine public amm;
    IERC20 public usdc;

    uint256 constant WAD = 1e18;

    function setUp() public {
        // These tests require --fork-url
        if (block.chainid != 84532) {
            revert("Must run with --fork-url https://sepolia.base.org");
        }

        launchpad = ILaunchpadEngine(LAUNCHPAD_ENGINE);
        amm = IAMMEngine(AMM_ENGINE);
        usdc = IERC20(MOCK_USDC);
    }

    // ============================================
    // Deployment Verification Tests
    // ============================================

    function test_ContractsHaveCode() public view {
        assertTrue(address(launchpad).code.length > 0, "LaunchpadEngine has code");
        assertTrue(address(amm).code.length > 0, "AMMEngine has code");
        assertTrue(COLLATERALIZER.code.length > 0, "Collateralizer has code");
        assertTrue(TICK_BOOK.code.length > 0, "TickBook has code");
        assertTrue(address(usdc).code.length > 0, "MockUSDC has code");
    }

    function test_RouterConfiguration() public view {
        assertEq(amm.router(), LAUNCHPAD_ENGINE, "AMM router should be LaunchpadEngine");
    }

    function test_LaunchpadEngineConfiguration() public view {
        // Use low-level calls since interface doesn't expose these
        (bool success, bytes memory data) = LAUNCHPAD_ENGINE.staticcall(abi.encodeWithSignature("ammEngine()"));
        assertTrue(success, "ammEngine() call should succeed");
        address ammAddress = abi.decode(data, (address));
        assertEq(ammAddress, AMM_ENGINE, "LaunchpadEngine.ammEngine should match");

        (success, data) = LAUNCHPAD_ENGINE.staticcall(abi.encodeWithSignature("usdc()"));
        assertTrue(success, "usdc() call should succeed");
        address usdcAddress = abi.decode(data, (address));
        assertEq(usdcAddress, MOCK_USDC, "LaunchpadEngine.usdc should match");
    }

    function test_FeeParameters() public view {
        (bool success, bytes memory data) = LAUNCHPAD_ENGINE.staticcall(abi.encodeWithSignature("preGradFeeBps()"));
        assertTrue(success, "preGradFeeBps() call should succeed");
        uint16 preGradFee = abi.decode(data, (uint16));

        (success, data) = LAUNCHPAD_ENGINE.staticcall(abi.encodeWithSignature("postGradFeeBps()"));
        assertTrue(success, "postGradFeeBps() call should succeed");
        uint16 postGradFee = abi.decode(data, (uint16));

        assertEq(preGradFee, 500, "Pre-grad fee should be 5%");
        assertEq(postGradFee, 100, "Post-grad fee should be 1%");
    }

    // ============================================
    // Market Creation Test
    // ============================================

    function test_CanCreateMarket() public {
        // Deploy a test TruthMarket
        address adjudicator = DEPLOYER;
        address guardian = DEPLOYER;

        vm.startPrank(DEPLOYER);

        // Ensure deployer has USDC
        uint256 balance = usdc.balanceOf(DEPLOYER);
        console2.log("Deployer USDC balance:", balance / 1e18);

        // If no balance, mint some (MockUSDC should have mint function)
        if (balance < 1000 * WAD) {
            // Try to mint - MockUSDC is an ERC20Mock
            (bool success,) = address(usdc).call(abi.encodeWithSignature("mint(address,uint256)", DEPLOYER, 10000 * WAD));
            if (!success) {
                console2.log("Could not mint USDC - skipping market creation");
                vm.stopPrank();
                return;
            }
            balance = usdc.balanceOf(DEPLOYER);
            console2.log("After mint, balance:", balance / 1e18);
        }

        // Create TruthMarket
        TruthMarketForTest market = new TruthMarketForTest(
            "Fork Test Market",
            uint64(block.timestamp + 30 days),
            adjudicator,
            guardian
        );
        market.activate();

        // Approve and create launchpad market
        uint256 initialLiquidity = 100 * WAD;
        usdc.approve(LAUNCHPAD_ENGINE, type(uint256).max);

        uint256 lpTokens = launchpad.createMarket(
            address(market),
            initialLiquidity,
            "Fork Test",
            "FTEST"
        );

        console2.log("LP tokens received:", lpTokens / 1e18);
        assertTrue(lpTokens > 0, "Should receive LP tokens");

        // Verify market state
        (
            address creator,
            uint256 bBase,
            uint256 bCurrent,
            uint256 totalLPSupply,
            bool isGraduated,
        ) = launchpad.getMarketState(address(market));

        assertEq(creator, DEPLOYER, "Creator should be deployer");
        assertEq(bBase, initialLiquidity, "bBase should be initial liquidity");
        assertFalse(isGraduated, "Market should not be graduated");

        vm.stopPrank();
    }

    // ============================================
    // Trade Test (requires existing market)
    // ============================================

    function test_CanGetBalances() public view {
        // Just verify the view function works
        (uint256 available, uint256 locked) = amm.getBalances(DEPLOYER);
        console2.log("Deployer available:", available / 1e18);
        console2.log("Deployer locked:", locked / 1e18);

        // Invariant check: locked <= available
        assertLe(locked, available, "Locked should not exceed available");
    }
}

/**
 * @title TruthMarketForTest
 * @notice Minimal TruthMarket for fork testing
 */
contract TruthMarketForTest {
    string public question;
    address public creator;
    address public adjudicator;
    address public guardian;
    uint64 public deadline;
    bool public activated;
    bool public settled;
    uint8 public winningOutcome;
    uint64 public tStar;

    constructor(
        string memory _question,
        uint64 _deadline,
        address _adjudicator,
        address _guardian
    ) {
        question = _question;
        deadline = _deadline;
        adjudicator = _adjudicator;
        guardian = _guardian;
        creator = msg.sender;
    }

    function activate() external {
        require(msg.sender == creator, "TruthMarket: not creator");
        activated = true;
    }

    function isLive() external view returns (bool) {
        return activated && !settled && block.timestamp < deadline;
    }

    function isSettled() external view returns (bool) {
        return settled;
    }

    function settle(uint8 _outcome, uint64 _tStar) external {
        require(msg.sender == adjudicator, "TruthMarket: not adjudicator");
        settled = true;
        winningOutcome = _outcome;
        tStar = _tStar;
    }

    function getRedemptionValue(uint8 outcome) external view returns (uint256) {
        if (!settled) return 0;
        if (winningOutcome == 2) return 5e17; // INVALID = 50%
        return outcome == winningOutcome ? 1e18 : 0;
    }
}

