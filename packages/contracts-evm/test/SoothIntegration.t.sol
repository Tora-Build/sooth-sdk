// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/core/SoothTraderVault.sol";
import "../contracts/core/SoothMarket.sol";
import "../contracts/core/SoothTimeLock.sol";
import "../contracts/core/SoothGovernorVault.sol";
import "../contracts/core/SoothFeeController.sol";
import "../contracts/core/SoothInterfaces.sol";

/// @notice Mock ERC20 for testing (using 18 decimals to match WAD math)
contract MockUSDC is IERC20 {
    string public constant name = "Mock USDC";
    string public constant symbol = "mUSDC";
    uint8 public constant decimals = 18; 

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    uint256 private _totalSupply;

    function mint(address to, uint256 amount) external {
        _balances[to] += amount;
        _totalSupply += amount;
    }

    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }

    function transfer(address to, uint256 amount) external override returns (bool) {
        _balances[msg.sender] -= amount;
        _balances[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        _allowances[from][msg.sender] -= amount;
        _balances[from] -= amount;
        _balances[to] += amount;
        return true;
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        _allowances[msg.sender][spender] = amount;
        return true;
    }

    function allowance(address owner, address spender) external view returns (uint256) {
        return _allowances[owner][spender];
    }
}

/// @title SoothIntegrationTest
/// @notice Integration tests for Sooth Market (Tick-based AMM + ERC1155 + Merge)
contract SoothIntegrationTest is Test {
    // Contracts
    MockUSDC usdc;
    SoothGovernorVault governorVault;
    SoothTraderVault traderVault;
    SoothMarket market;
    SoothFeeController feeController;
    SoothTimeLock timeLock;

    // Test accounts
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address owner = makeAddr("owner");
    address governor = makeAddr("governor");

    // Constants
    uint256 constant INITIAL_BALANCE = 10_000e18;
    uint256 constant B_PARAM = 10_000e18; 
    uint16 constant INITIAL_TICK = 500; // 50% probability

    function setUp() public {
        vm.startPrank(owner);

        // Deploy core infrastructure
        usdc = new MockUSDC();
        feeController = new SoothFeeController(owner); 
        feeController.setOrderbookFee(10); // 0.1%

        // Deploy GovernorVault
        governorVault = new SoothGovernorVault(IERC20(address(usdc)));

        // Deploy TraderVault
        traderVault = new SoothTraderVault(IERC20(address(usdc)), ISoothGovernorVault(address(governorVault)));

        // Deploy TimeLock
        timeLock = new SoothTimeLock(1 days);
        timeLock.transferOwnership(address(traderVault));
        traderVault.setTimeLock(ITimeLock(address(timeLock)));

        // Deploy Market
        market = new SoothMarket();

        // Initialize market
        market.initialize(
            1, // marketId
            address(governorVault),
            address(traderVault),
            address(feeController),
            bytes32("adjudicator"),
            B_PARAM,
            governor,
            INITIAL_TICK
        );

        // Register market in Vaults
        // Register market in Vaults
        traderVault.setMarket(address(market), true);
        governorVault.setAuthorized(address(market), true);
        governorVault.setAuthorized(address(traderVault), true); // Authorize TraderVault
        governorVault.setAuthorized(owner, true); // Allow owner to allocate exposure manually for test

        // Fund Governor Vault (LP liquidity)
        uint256 lpAmount = 50_000e18;
        usdc.mint(owner, lpAmount);
        usdc.approve(address(governorVault), lpAmount);
        governorVault.depositFor(owner, lpAmount);
        governorVault.allocateExposure(1, lpAmount); // Allocate to market 1

        vm.stopPrank();

        // Fund Alice & Bob
        usdc.mint(alice, INITIAL_BALANCE);
        usdc.mint(bob, INITIAL_BALANCE);

        vm.prank(alice);
        usdc.approve(address(traderVault), type(uint256).max);
        
        vm.prank(bob);
        usdc.approve(address(traderVault), type(uint256).max);
    }

    // ============ Initialization Tests ============

    function testInitialization() public view {
        assertEq(market.currentTick(), INITIAL_TICK);
        assertEq(market.bBase(), B_PARAM);
        assertEq(market.isLive(), true);
        assertEq(market.isSettled(), false);
        
        // Check price at tick 500 should be 50%
        uint256 yesPrice = market.getPrice(0);
        assertApproxEqAbs(yesPrice, 0.5e18, 1e15); // tolerance for discrete tick
    }

    // ============ AMM Trading Tests ============

    function testTradeAMM_BuyYes() public {
        vm.startPrank(alice);
        traderVault.deposit(1000e18);

        uint256 tickBefore = market.currentTick();
        
        // Buy 100 YES shares
        // Expect cost > 0, tick moves up
        // Relax maxCost to avoid slippage error during test (uncalibrated cost)
        traderVault.tradeAMM(address(market), 0, 100e18, 2000e18);
        
        uint256 tickAfter = market.currentTick();
        assertTrue(tickAfter > tickBefore, "Tick should increase when buying YES");
        
        // Alice should have ERC1155 YES tokens
        assertEq(market.balanceOf(alice, 0), 100e18);
        
        // Alice paid USDC
        assertTrue(traderVault.availableBalance(alice) < 1000e18);
        vm.stopPrank();
    }

    function testTradeAMM_SellYes() public {
        // Setup: Alice buys YES first
        vm.startPrank(alice);
        traderVault.deposit(1000e18);
        traderVault.tradeAMM(address(market), 0, 100e18, 2000e18);
        
        uint256 tickHigh = market.currentTick();
        uint256 balAfterBuy = traderVault.availableBalance(alice);
        
        // Alice sells 50 YES shares
        // Note: Using 0 for maxCost to accept any positive proceeds (simple test)
        traderVault.tradeAMM(address(market), 0, -50e18, 0);
        
        uint256 tickAfterSell = market.currentTick();
        assertTrue(tickAfterSell < tickHigh, "Tick should decrease when selling YES");
        
        // Check balances
        assertEq(market.balanceOf(alice, 0), 50e18);
        // Check balances
        assertEq(market.balanceOf(alice, 0), 50e18);
        assertTrue(traderVault.pendingBalance(alice) > 0, "Should receive locked proceeds");
        
        // Sell remaining 50 YES
        traderVault.tradeAMM(address(market), 0, -50e18, 0);
        assertEq(market.balanceOf(alice, 0), 0);
        assertApproxEqAbs(market.currentTick(), INITIAL_TICK, 3, "Should return close to initial tick");
        vm.stopPrank();
    }

    // ============ Orderbook Tests ============

    function testOrderbook_LimitOrder() public {
        vm.startPrank(alice);
        traderVault.deposit(1000e18);
        
        // Place limit buy order for YES at 0.40
        uint256 orderId = traderVault.placeOrder(address(market), 0, 0.4e18, 10e18);
        
        // Check order created
        ISoothMarket.OrderV3 memory o = market.orders(orderId);
        assertEq(o.id, orderId);
        assertEq(o.maker, alice);
        assertEq(o.yesPrice, 0.4e18);
        assertEq(o.amount, 10e18);
        assertTrue(o.isBuySide);
        
        // Cancel order
        traderVault.cancelOrder(address(market), orderId);
        ISoothMarket.OrderV3 memory oDeleted = market.orders(orderId);
        assertEq(oDeleted.amount, 0, "Order should be deleted/cleared");
        vm.stopPrank();
    }

    // ============ Merge Tests ============

    function testMerge_FreeProceeds() public {
        vm.startPrank(alice);
        traderVault.deposit(2000e18);

        // Strategy to get YES and NO tokens:
        // 1. Buy YES shares from AMM
        // 2. Buy NO shares from AMM (moves price back down)
        // Note: In a real market this incurs spread/fees, but gives us both tokens
        
        traderVault.tradeAMM(address(market), 0, 100e18, 2000e18); // Buy 100 YES
        traderVault.tradeAMM(address(market), 1, 100e18, 2000e18); // Buy 100 NO
        
        assertEq(market.balanceOf(alice, 0), 100e18); // YES
        assertEq(market.balanceOf(alice, 1), 100e18); // NO
        
        uint256 balBeforeMerge = traderVault.availableBalance(alice);
        uint256 pendingBefore = traderVault.pendingBalance(alice);
        
        // Merge 100 sets (unlock $100 collateral)
        market.merge(100e18);
        
        // Tokens burned
        assertEq(market.balanceOf(alice, 0), 0);
        assertEq(market.balanceOf(alice, 1), 0);
        
        // V3 Policy: Merge is FREE (no lock)
        // Available should increase by 100e18 (100 sets * $1)
        uint256 balAfterMerge = traderVault.availableBalance(alice);
        assertEq(balAfterMerge, balBeforeMerge + 100e18, "Available should increase by merge amount");
        
        // Pending unchanged (no lock)
        assertEq(traderVault.pendingBalance(alice), pendingBefore, "Pending should be unchanged");
        
        vm.stopPrank();
    }

    // ============ ERC1155 Transfer Tests ============

    function testERC1155_Transfer() public {
        vm.startPrank(alice);
        traderVault.deposit(1000e18);
        traderVault.tradeAMM(address(market), 0, 100e18, 2000e18);
        
        // Transfer 50 YES to Bob via Vault wrapper
        traderVault.transferShares(address(market), bob, 0, 50e18);
        
        assertEq(market.balanceOf(alice, 0), 50e18);
        assertEq(market.balanceOf(bob, 0), 50e18);
        vm.stopPrank();
        
        // Bob can sell his transferred shares
        vm.startPrank(bob);
        traderVault.tradeAMM(address(market), 0, -50e18, 0);
        assertEq(market.balanceOf(bob, 0), 0);
        assertTrue(traderVault.pendingBalance(bob) > 0, "Bob should receive locked proceeds");
        // Actually bob needs to pay fee if any? No, sell = receive funds.
        // Wait, did Bob deposit first? No. 
        // But sell works if he has shares. Proceeds go to his vault account.
        vm.stopPrank();
    }
}
