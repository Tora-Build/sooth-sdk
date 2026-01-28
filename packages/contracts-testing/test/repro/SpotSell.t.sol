// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {TickBookPoolManager} from "@core/TickBookPoolManager.sol";
import {TickBookVault} from "@core/TickBookVault.sol";
import {TruthMarket} from "@core/TruthMarket.sol";
import {OutcomeToken} from "@core/OutcomeToken.sol";
import {ProtocolConfig} from "@core/ProtocolConfig.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";

contract SpotSellReproTest is Test {
    TickBookPoolManager public poolManager;
    TickBookVault public vault;
    ProtocolConfig public protocolConfig;
    TruthMarket public market;
    OutcomeToken public yesToken;
    OutcomeToken public noToken;
    ERC20Mock public usdc;

    address public alice = address(0xA11CE); // Seller (owns YES shares)
    address public bob = address(0xB0B);     // Buyer (owns USDC)

    bytes32 public marketKey;

    function setUp() public {
        usdc = new ERC20Mock();
        protocolConfig = new ProtocolConfig(address(this));
        vault = new TickBookVault(address(usdc), address(protocolConfig), address(this));
        poolManager = new TickBookPoolManager(address(vault), address(protocolConfig));
        vault.setTickBook(address(poolManager));

        market = new TruthMarket(
            "Test Market",
            uint64(block.timestamp),
            uint64(block.timestamp + 30 days),
            address(this),
            address(protocolConfig),
            address(this)
        );
        yesToken = new OutcomeToken("Yes Token", "YES", address(this), address(market), 1);
        noToken = new OutcomeToken("No Token", "NO", address(this), address(market), 0);

        
        // Register market
        marketKey = poolManager.registerMarket(
            address(market),
            address(yesToken),
            address(noToken),
            0.5e18,
            address(0)
        );

        // Fund Alice with SHARES (simulating she already bought YES)
        // We simulate this by minting shares directly to vault and crediting Alice's internal balance
        // To do this properly via vault, we creditOutcome. 
        // But creditOutcome is protected. So we'll mint tokens to Alice then deposit? 
        // No, vault.depositOutcome is not a thing.
        // We need to use `vault.creditOutcome` which is only callable by TickBook.
        // Hack: We can use `vm.prank` to call creditOutcome as the TickBook.
        vm.prank(address(poolManager));
        vault.creditOutcome(address(market), alice, 1, 1000e18); // 1000 YES shares

        // Fund Bob with USDC
        usdc.mint(bob, 100_000e18);
        vm.prank(bob);
        usdc.approve(address(vault), type(uint256).max);
        vm.prank(bob);
        vault.depositUsdc(50_000e18);
    }

    function test_PlaceSpotSell_Works() public {
        vm.startPrank(alice);
        // Place Spot Sell: Sell 500 YES shares at tick 600-600 (limit)
        uint256 sellId = poolManager.placeSpotSell(
            marketKey,
            1,          // YES outcome
            500e18,     // shares
            600,        // tickLower
            600         // tickUpper
        );
        vm.stopPrank();

        assertGt(sellId, 0, "Sell ID should be created");

        // Verify shares are locked
        (uint256 aliceYes, ) = vault.getInternalOutcomes(address(market), alice);
        // Alice started with 1000, locked 500, should have 500 available + 500 locked
        // getBalances shows available.
        assertEq(aliceYes, 500e18, "Alive available YES should be 500");
    }

    function test_Unified_PlaceOrderCrossesSpotSell() public {
        // 1. Alice places Spot Sell for YES at tick 600 (price 0.60)
        vm.prank(alice);
        poolManager.placeSpotSell(marketKey, 1, 500e18, 600, 600);

        // 2. Bob places regular BUY Limit Order for YES at tick 600 (price 0.60)
        // Ideally this should cross.
        vm.prank(bob);
        (uint256 orderId, uint256 filledShares, , ) = poolManager.placeOrder(
            marketKey,
            1,          // YES
            500e18,     // shares
            600,        // tickLower
            600,        // tickUpper
            310e18      // maxCost (buffer for slippage/fees)
        );

        // 3. Verify CROSSING occurred (V10)
        assertGt(filledShares, 0, "Regular BUY SHOULD cross with Spot Sell in V10");
        
        // Bob's order just sits there as a resting order
        // Alice's spot sell just sits there
    }

    /**
     * @notice Test that placeOrder crosses with existing spot sells
     */
    function test_PlaceOrder_CrossesWithSpotSell() public {
        // 1. Alice places Spot Sell for YES at tick 600
        vm.prank(alice);
        uint256 sellId = poolManager.placeSpotSell(marketKey, 1, 500e18, 600, 600);

        // 2. Bob buys via placeOrder which crosses with spot
        vm.prank(bob);
        (uint256 orderId, uint256 filled, uint256 cost, ) = poolManager.placeOrder(
            marketKey,
            1,          // YES
            100e18,     // buy 100 shares
            600,        // tickLower
            600,        // tickUpper
            65e18       // max cost (generous buffer)
        );

        // 3. Verify success
        assertGt(cost, 0, "Cost should be > 0");
        
        // Alice should have received USDC proceeds
        // Bob should have received YES shares
        (uint256 bobYes, ) = vault.getInternalOutcomes(address(market), bob);
        assertEq(bobYes, 100e18, "Bob should have 100 YES shares");
    }
}
