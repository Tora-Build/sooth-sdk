// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {LaunchpadEngineV11} from "@core/LaunchpadEngineV11.sol";
import {ValidatedAdjudicator} from "@core/ValidatedAdjudicator.sol";
import {LaunchpadLPToken} from "@core/LaunchpadLPToken.sol";
import {TruthMarket} from "@core/TruthMarket.sol";
import {ProtocolConfig} from "@core/ProtocolConfig.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";

import {MockAMMEngine} from "./mocks/MockAMMEngine.sol";
import {MockCollateralizer} from "./mocks/MockCollateralizer.sol";
import {MockTickBook} from "./mocks/MockTickBook.sol";
import {MockValidationRegistry} from "./mocks/MockValidationRegistry.sol";

/**
 * @title V11TestBase
 * @notice Shared test infrastructure for V11 contract tests
 * @dev Sets up actors, mocks, and core contracts
 */
abstract contract V11TestBase is Test {
    // ============================================
    // Constants
    // ============================================

    uint256 internal constant WAD = 1e18;
    uint256 internal constant INITIAL_BALANCE = 1_000_000e18;

    // ============================================
    // Actors
    // ============================================

    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);
    address internal creator = address(0xC4EA70);
    address internal adjudicator = address(0xAD7);
    address internal agent = address(0xA6E7);
    address internal guardian = address(0x64A4D14);
    address internal attacker = address(0xBAD);
    address internal treasury = address(0x74EA5);
    address internal deployer;

    // ============================================
    // Core Contracts
    // ============================================

    ERC20Mock internal usdc;
    MockAMMEngine internal ammEngine;
    MockCollateralizer internal collateralizer;
    MockTickBook internal tickBook;
    LaunchpadEngineV11 internal launchpad;
    ValidatedAdjudicator internal validatedAdjudicator;
    ProtocolConfig internal protocolConfig;

    // ============================================
    // ERC-8004 Mocks
    // ============================================

    MockValidationRegistry internal validationRegistry;

    // ============================================
    // Test State
    // ============================================

    // ============================================
    // Setup
    // ============================================

    function setUp() public virtual {
        deployer = address(this);

        // Deploy mocks
        _deployMocks();

        // Deploy core contracts
        _deployCoreContracts();

        // Configure contracts
        _configureContracts();

        // Fund actors
        _fundActors();
    }

    function _deployMocks() internal {
        // Deploy USDC mock
        usdc = new ERC20Mock();

        // Deploy AMM mock
        ammEngine = new MockAMMEngine(address(usdc));

        // Deploy Collateralizer mock
        collateralizer = new MockCollateralizer();

        // Deploy TickBook mock
        tickBook = new MockTickBook();

        validationRegistry = new MockValidationRegistry();
    }

    function _deployCoreContracts() internal {
        protocolConfig = new ProtocolConfig(deployer);

        // Deploy LaunchpadEngineV11
        launchpad = new LaunchpadEngineV11(
            address(usdc),
            address(ammEngine),
            address(collateralizer),
            address(tickBook),
            address(protocolConfig),
            treasury,
            deployer
        );

        // Deploy ValidatedAdjudicator
        validatedAdjudicator = new ValidatedAdjudicator(
            address(validationRegistry),
            1 hours, // attestation window
            80,      // min validation score
            deployer
        );
    }

    function _configureContracts() internal {
        // Set launchpad as AMM router
        ammEngine.setRouter(address(launchpad));

        // Set guardian role
        address[] memory add = new address[](1);
        add[0] = guardian;
        address[] memory remove = new address[](0);
        protocolConfig.setGuardians(add, remove);

    }

    function _fundActors() internal {
        address[] memory actors = new address[](6);
        actors[0] = alice;
        actors[1] = bob;
        actors[2] = creator;
        actors[3] = agent;
        actors[4] = guardian;
        actors[5] = attacker;

        for (uint256 i = 0; i < actors.length; i++) {
            usdc.mint(actors[i], INITIAL_BALANCE);
            vm.prank(actors[i]);
            usdc.approve(address(launchpad), type(uint256).max);
        }
    }

    // ============================================
    // Helper Functions
    // ============================================

    /**
     * @notice Create a market with default parameters
     * @return market The created TruthMarket address
     */
    function _createMarket() internal returns (address market) {
        return _createMarketWithLiquidity(100e18);
    }

    /**
     * @notice Create a market with specified initial liquidity
     */
    function _createMarketWithLiquidity(uint256 liquidity) internal returns (address market) {
        vm.prank(creator);
        (market, ) = launchpad.createMarket(
            "Will ETH reach $10k?",
            0, // startTime = now
            uint64(block.timestamp + 30 days),
            adjudicator,
            address(protocolConfig),
            liquidity,
            0,
            0
        );
    }

    /**
     * @notice Create a market with custom trial period
     */
    function _createMarketWithTrialPeriod(uint64 trialDuration) internal returns (address market) {
        vm.prank(creator);
        (market, ) = launchpad.createMarketWithOptions(
            "Will ETH reach $10k?",
            0,
            uint64(block.timestamp + 30 days),
            adjudicator,
            address(protocolConfig),
            100e18,
            trialDuration,
            false,
            0,
            0,
            0
        );
    }

    /**
     * @notice Helper to buy shares
     */
    function _buyShares(address trader, address market, uint8 outcome, uint256 shares) internal {
        vm.prank(trader);
        launchpad.tradePositions(
            market,
            outcome,
            int256(shares),
            type(uint256).max
        );
    }

    /**
     * @notice Helper to sell shares
     */
    function _sellShares(address trader, address market, uint8 outcome, uint256 shares) internal {
        vm.prank(trader);
        launchpad.tradePositions(
            market,
            outcome,
            -int256(shares),
            0
        );
    }

    /**
     * @notice Setup valid attestation in validation registry
     */
    function _setupValidAttestation(
        bytes32 attestationHash,
        uint256 _agentId
    ) internal {
        validationRegistry.setAttestation(
            attestationHash,
            address(0xDA1DA70),
            _agentId,
            100, // perfect score
            block.timestamp
        );
    }

    /**
     * @notice Warp time forward
     */
    function _advanceTime(uint256 seconds_) internal {
        vm.warp(block.timestamp + seconds_);
    }

    /**
     * @notice Settle a market via adjudicator
     */
    function _settleMarket(address market, uint8 outcome) internal {
        vm.prank(adjudicator);
        TruthMarket(market).settle(outcome, 0);
    }

    /**
     * @notice Finalize a market via adjudicator
     */
    function _finalizeMarket(address market) internal {
        vm.prank(adjudicator);
        TruthMarket(market).finalize();
    }
}
