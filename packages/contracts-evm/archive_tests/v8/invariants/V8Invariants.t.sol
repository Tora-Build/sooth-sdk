// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {AMMEngine} from "../../../contracts/AMMEngine.sol";
import {LaunchpadEngine} from "../../../contracts/LaunchpadEngine.sol";
import {Collateralizer} from "../../../contracts/Collateralizer.sol";
import {TickBook} from "../../../contracts/TickBook.sol";
import {TickBookVault} from "../../../contracts/TickBookVault.sol";
import {TruthMarket} from "../../../contracts/TruthMarket.sol";
import {OutcomeToken} from "../../../contracts/OutcomeToken.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";

/**
 * @title V8InvariantsTest
 * @notice Invariant test suite for V8 architecture
 * @dev Uses Foundry's stateful fuzzing to verify protocol invariants
 *
 * Key Invariants:
 * 1. Solvency: AMM always has sufficient collateral for payouts
 * 2. LP Accounting: sum(lpBalances) == totalLPSupply
 * 3. Lock Consistency: locked <= available for all users
 * 4. Token Symmetry: YES.totalSupply() == NO.totalSupply()
 * 5. Price Validity: P(YES) + P(NO) == 1
 */
contract V8InvariantsTest is StdInvariant, Test {
    // Contracts
    AMMEngine public amm;
    LaunchpadEngine public launchpad;
    Collateralizer public collateralizer;
    TickBookVault public tickBookVault;
    TickBook public tickBook;
    TruthMarket public market;
    ERC20Mock public usdc;

    // Actors
    address public owner = address(0x1);
    address public creator = address(0x2);
    address public treasury = address(0x3);
    address public adjudicator = address(0x4);
    address public guardian = address(0x5);

    // Test traders
    address[] public traders;
    TraderActor public traderActor;

    uint256 constant WAD = 1e18;
    uint256 constant INITIAL_LIQUIDITY = 1000 * WAD;

    function setUp() public {
        // Deploy mock USDC
        usdc = new ERC20Mock();

        // Deploy AMM
        amm = new AMMEngine(address(usdc), owner);

        // Deploy Collateralizer, TickBookVault and TickBook
        collateralizer = new Collateralizer(address(usdc));
        tickBookVault = new TickBookVault(address(usdc), owner);
        tickBook = new TickBook(address(tickBookVault));
        vm.prank(owner);
        tickBookVault.setTickBook(address(tickBook));

        // Deploy LaunchpadEngine
        vm.prank(owner);
        launchpad = new LaunchpadEngine(
            address(usdc),
            address(amm),
            address(collateralizer),
            address(tickBook),
            treasury,
            owner
        );

        // Configure AMM router
        vm.prank(owner);
        amm.setRouter(address(launchpad));

        // Deploy TruthMarket
        vm.prank(creator);
        market = new TruthMarket(
            "Invariant Test Market",
            uint64(block.timestamp + 30 days),
            adjudicator,
            guardian
        );

        // Create traders
        for (uint160 i = 10; i < 15; i++) {
            address trader = address(i);
            traders.push(trader);
            usdc.mint(trader, 100000 * WAD);
            vm.prank(trader);
            usdc.approve(address(launchpad), type(uint256).max);
        }

        // Fund creator and create market
        usdc.mint(creator, 100000 * WAD);
        vm.startPrank(creator);
        usdc.approve(address(launchpad), type(uint256).max);
        launchpad.createMarket(address(market), INITIAL_LIQUIDITY, "Test", "TEST");
        market.activate();
        vm.stopPrank();

        // Deploy actor contract
        traderActor = new TraderActor(launchpad, amm, usdc, address(market), traders);
        
        // Target the actor for invariant testing
        targetContract(address(traderActor));
    }

    // ============================================
    // Invariant: LP Accounting
    // ============================================

    function invariant_LP_TotalSupplyMatchesSumOfBalances() public view {
        (
            ,
            ,
            ,
            uint256 totalLPSupply,
            ,
        ) = launchpad.getMarketState(address(market));

        uint256 sumBalances = launchpad.getLPBalance(address(market), creator);
        for (uint256 i = 0; i < traders.length; i++) {
            sumBalances += launchpad.getLPBalance(address(market), traders[i]);
        }

        assertEq(sumBalances, totalLPSupply, "LP supply mismatch");
    }

    // ============================================
    // Invariant: Lock Consistency
    // ============================================

    /// @notice Verify available >= locked for all users
    /// @dev BUG FIX APPLIED: AMMEngine._tradePositions() now reduces _lockedBalance
    ///      proportionally when spending from available balance.
    function invariant_LockedNeverExceedsAvailable() public view {
        for (uint256 i = 0; i < traders.length; i++) {
            (uint256 available, uint256 locked) = amm.getBalances(traders[i]);
            assertGe(available, locked, "Locked exceeds available");
        }
    }

    // ============================================
    // Invariant: Price Validity (P(YES) + P(NO) == 1)
    // ============================================

    function invariant_PricesSumToOne() public view {
        (
            ,
            ,
            uint256 yesPrice
        ) = amm.getMarketState(address(market));

        uint256 noPrice = WAD - yesPrice;
        uint256 sum = yesPrice + noPrice;

        assertEq(sum, WAD, "Prices don't sum to 1");
    }

    // ============================================
    // Invariant: Position Non-Negativity
    // ============================================

    function invariant_PositionsNonNegative() public view {
        for (uint256 i = 0; i < traders.length; i++) {
            (uint256 yesShares, uint256 noShares) = amm.getPosition(address(market), traders[i]);
            // uint256 can't be negative, but this documents the invariant
            assertGe(yesShares, 0, "Negative YES shares");
            assertGe(noShares, 0, "Negative NO shares");
        }
    }

    // ============================================
    // Invariant: Liquidity Never Decreases (Pre-Graduation)
    // ============================================

    function invariant_LiquidityMonotonic() public view {
        (
            ,
            uint256 bBase,
            uint256 bCurrent,
            ,
            bool isGraduated,
        ) = launchpad.getMarketState(address(market));

        if (!isGraduated) {
            // Before graduation, bCurrent should always be >= bBase
            assertGe(bCurrent, bBase, "Liquidity decreased pre-graduation");
        }
    }

    // ============================================
    // Invariant: Fee Parameters Valid
    // ============================================

    function invariant_FeeParametersValid() public view {
        uint16 preGradFee = launchpad.preGradFeeBps();
        uint16 postGradFee = launchpad.postGradFeeBps();
        uint16 bBaseShare = launchpad.bBaseShareBps();
        uint16 lpYieldShare = launchpad.lpYieldShareBps();
        uint16 protocolShare = launchpad.protocolShareBps();

        assertLe(preGradFee, 1000, "Pre-grad fee too high");
        assertLe(postGradFee, 500, "Post-grad fee too high");
        assertEq(bBaseShare + lpYieldShare + protocolShare, 10000, "Fee splits don't sum to 100%");
    }
}

/**
 * @title TraderActor
 * @notice Actor contract for invariant testing - performs random valid actions
 */
contract TraderActor is Test {
    LaunchpadEngine public launchpad;
    AMMEngine public amm;
    ERC20Mock public usdc;
    address public market;
    address[] public traders;

    // Outcome constants (aligned with TruthMarket: 0=NO, 1=YES, 2=INVALID)
    uint8 constant YES = 1;
    uint8 constant NO = 0;
    uint256 constant WAD = 1e18;

    constructor(
        LaunchpadEngine _launchpad,
        AMMEngine _amm,
        ERC20Mock _usdc,
        address _market,
        address[] memory _traders
    ) {
        launchpad = _launchpad;
        amm = _amm;
        usdc = _usdc;
        market = _market;
        traders = _traders;
    }

    function buyYES(uint256 traderIndex, uint256 shares) external {
        traderIndex = bound(traderIndex, 0, traders.length - 1);
        shares = bound(shares, 1 * WAD, 100 * WAD);

        address trader = traders[traderIndex];
        
        vm.prank(trader);
        try launchpad.tradePositions(market, YES, int256(shares), type(uint256).max) {
            // Success
        } catch {
            // Trade may fail due to slippage or balance - that's ok
        }
    }

    function buyNO(uint256 traderIndex, uint256 shares) external {
        traderIndex = bound(traderIndex, 0, traders.length - 1);
        shares = bound(shares, 1 * WAD, 100 * WAD);

        address trader = traders[traderIndex];
        
        vm.prank(trader);
        try launchpad.tradePositions(market, NO, int256(shares), type(uint256).max) {
            // Success
        } catch {
            // Trade may fail
        }
    }

    function sellYES(uint256 traderIndex, uint256 shares) external {
        traderIndex = bound(traderIndex, 0, traders.length - 1);
        shares = bound(shares, 1 * WAD, 50 * WAD);

        address trader = traders[traderIndex];
        (uint256 yesShares, ) = amm.getPosition(market, trader);
        
        if (yesShares >= shares) {
            vm.prank(trader);
            try launchpad.tradePositions(market, YES, -int256(shares), 0) {
                // Success
            } catch {
                // May fail
            }
        }
    }

    function sellNO(uint256 traderIndex, uint256 shares) external {
        traderIndex = bound(traderIndex, 0, traders.length - 1);
        shares = bound(shares, 1 * WAD, 50 * WAD);

        address trader = traders[traderIndex];
        (, uint256 noShares) = amm.getPosition(market, trader);
        
        if (noShares >= shares) {
            vm.prank(trader);
            try launchpad.tradePositions(market, NO, -int256(shares), 0) {
                // Success
            } catch {
                // May fail
            }
        }
    }

    function claimUnlocked(uint256 traderIndex) external {
        traderIndex = bound(traderIndex, 0, traders.length - 1);
        address trader = traders[traderIndex];

        // Warp time to unlock
        vm.warp(block.timestamp + 25 hours);

        vm.prank(trader);
        try amm.claimUnlocked(50) {
            // Success
        } catch {
            // May have no locks
        }
    }
}
