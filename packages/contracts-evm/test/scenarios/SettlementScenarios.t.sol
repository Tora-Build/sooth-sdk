// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../contracts/core/SoothTraderVaultV4.sol";
import "../../contracts/launchpad/LaunchpadFactory.sol";
import "../../contracts/launchpad/LaunchpadMarket.sol";
import "../../contracts/core/OutcomeToken.sol";
import "../../contracts/core/SoothLiquidityVault.sol";
import "../../contracts/core/SoothFeeController.sol";
import "../../contracts/core/ProtocolConfig.sol";
import "../../contracts/core/SoothInterfaces.sol";
import "../../contracts/interfaces/IOutcomeToken.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Settlement Scenarios
/// @notice Exercises market settlement + post-settlement constraints + merge + locked proceeds.
contract SettlementScenariosTest is Test {
    // Contracts
    MockUSDC usdc;
    SoothLiquidityVault liquidityVault;
    SoothTraderVaultV4 traderVault;
    LaunchpadFactory factory;
    LaunchpadMarket market;
    LaunchpadMarket marketImpl;
    OutcomeToken outcomeTokenImpl;
    SoothFeeController feeController;
    ProtocolConfig protocolConfig;

    // Actors
    address owner = makeAddr("owner");
    address creator = makeAddr("creator");
    address alice = makeAddr("alice");

    // Constants
    uint256 constant INITIAL_GOVERNOR = 100_000e18;
    uint256 constant INITIAL_TRADER = 10_000e18;
    uint256 constant LOCK_DURATION = 24 hours;

    function setUp() public {
        vm.startPrank(owner);

        usdc = new MockUSDC();
        feeController = new SoothFeeController(owner);
        feeController.setOrderbookFee(10);

        liquidityVault = new SoothLiquidityVault(IERC20(address(usdc)));
        traderVault = new SoothTraderVaultV4(IERC20(address(usdc)), ISoothLiquidityVault(address(liquidityVault)));
        outcomeTokenImpl = new OutcomeToken();
        marketImpl = new LaunchpadMarket();
        protocolConfig = new ProtocolConfig(owner, 0);
        
        factory = new LaunchpadFactory(
            address(marketImpl),
            address(usdc),
            address(traderVault),
            address(feeController),
            address(outcomeTokenImpl),
            creator,
            creator,
            address(protocolConfig)
        );
        
        // Create Launchpad market
        usdc.mint(creator, 1000 * 1e18);
        vm.startPrank(creator);
        usdc.approve(address(factory), type(uint256).max);
        (address marketAddr, ) = factory.createMarket(
            "Settlement Test",
            "SETTLE",
            "Test market for settlement scenarios",
            0,
            false,
            30 days
        );
        market = LaunchpadMarket(marketAddr);
        vm.stopPrank();

        // Auth wiring
        traderVault.setMarket(address(market), true);
        traderVault.setOutcomeToken(address(market.outcomeToken()), true);

        liquidityVault.setAuthorized(address(traderVault), true);
        liquidityVault.setAuthorized(owner, true);

        // Seed liquidity vault (for global operations)
        usdc.mint(address(liquidityVault), INITIAL_GOVERNOR);
        liquidityVault.receiveFunds(1, INITIAL_GOVERNOR);

        vm.stopPrank();

        // Fund trader
        usdc.mint(alice, INITIAL_TRADER);
        vm.prank(alice);
        usdc.approve(address(traderVault), type(uint256).max);
    }

    function test_onlyGovernorCanSettle() public {
        // Non-governor cannot settle
        vm.expectRevert(bytes("Market: not governor"));
        vm.prank(owner);
        market.settle(0);

        // Governor can settle
        vm.prank(creator);
        market.settle(0);
        assertTrue(market.isSettled(), "Market should be settled");
        assertFalse(market.isLive(), "Market should not be live after settlement");
    }

    function test_postSettlement_AMMTradeBlocked() public {
        vm.startPrank(alice);
        traderVault.deposit(1000e18);
        traderVault.tradeAMM(address(market), 0, 100e18, 2000e18);
        vm.stopPrank();

        vm.prank(creator);
        market.settle(0);

        // Any further AMM trade must revert (onlyLive)
        vm.prank(alice);
        vm.expectRevert(bytes("Market: not live"));
        traderVault.tradeAMM(address(market), 0, 10e18, 2000e18);
    }

    function test_postSettlement_OrderCreationBlocked() public {
        vm.prank(creator);
        market.settle(1);

        vm.startPrank(alice);
        traderVault.deposit(1000e18);

        // placeOrder routes to market.createOrder which is onlyLive
        vm.expectRevert(bytes("Market: not live"));
        traderVault.placeOrder(address(market), 0, 0.5e18, 100, true);

        vm.stopPrank();
    }

    function test_mergeStillWorksAfterSettlement_withOrderbookTokens() public {
        // Give alice YES+NO tokens by minting via market
        IOutcomeToken outcomeToken = market.outcomeToken();
        vm.startPrank(address(market));
        outcomeToken.mint(alice, 0, 100);
        outcomeToken.mint(alice, 1, 100);
        vm.stopPrank();

        // Settle market
        vm.prank(creator);
        market.settle(0);

        // Merge should still work (merge is on OutcomeToken, not gated by market liveness)
        uint256 beforeAvail = traderVault.availableBalance(alice);

        vm.prank(alice);
        outcomeToken.merge(50);

        uint256 afterAvail = traderVault.availableBalance(alice);
        assertEq(afterAvail, beforeAvail + 50, "Merge credits amount (raw units) to available");
    }

    function test_claimUnlockedStillWorksAfterSettlement() public {
        vm.startPrank(alice);
        traderVault.deposit(2000e18);

        // Buy then sell to create locked proceeds
        traderVault.tradeAMM(address(market), 0, 100e18, 2000e18);
        traderVault.tradeAMM(address(market), 0, -40e18, 0);

        uint256 lockedBefore = traderVault.lockedBalance(alice);
        assertGt(lockedBefore, 0, "Should have locked proceeds after sell");
        vm.stopPrank();

        // Settle market
        vm.prank(creator);
        market.settle(0);

        // After lock duration, claimUnlocked should still succeed
        vm.warp(block.timestamp + LOCK_DURATION + 1);

        uint256 availBefore = traderVault.availableBalance(alice);
        vm.prank(alice);
        uint256 claimed = traderVault.claimUnlocked();

        assertGt(claimed, 0, "Should claim something");
        assertGt(traderVault.availableBalance(alice), availBefore, "Available should increase after claim");
    }
}

/// @notice Mock USDC for testing
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

    function totalSupply() external view override returns (uint256) { return _totalSupply; }
    function balanceOf(address account) external view override returns (uint256) { return _balances[account]; }

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
