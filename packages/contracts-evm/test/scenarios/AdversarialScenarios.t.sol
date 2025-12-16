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

/// @title Adversarial Scenarios
/// @notice Access-control + edge-case probes.
contract AdversarialScenariosTest is Test {
    MockUSDC usdc;
    SoothLiquidityVault liquidityVault;
    SoothTraderVaultV4 traderVault;
    LaunchpadFactory factory;
    LaunchpadMarket market;
    LaunchpadMarket marketImpl;
    OutcomeToken outcomeTokenImpl;
    SoothFeeController feeController;
    ProtocolConfig protocolConfig;

    address owner = makeAddr("owner");
    address creator = makeAddr("creator");
    address alice = makeAddr("alice");
    address attacker = makeAddr("attacker");

    uint256 constant INITIAL_GOVERNOR = 100_000e18;
    uint256 constant INITIAL_TRADER = 10_000e18;

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
            "Adversarial Test",
            "ADV",
            "Test market for adversarial scenarios",
            0,
            false,
            30 days
        );
        market = LaunchpadMarket(marketAddr);
        vm.stopPrank();

        traderVault.setMarket(address(market), true);
        traderVault.setOutcomeToken(address(market.outcomeToken()), true);

        liquidityVault.setAuthorized(address(traderVault), true);
        liquidityVault.setAuthorized(owner, true);

        usdc.mint(address(liquidityVault), INITIAL_GOVERNOR);
        liquidityVault.receiveFunds(1, INITIAL_GOVERNOR);

        vm.stopPrank();

        usdc.mint(alice, INITIAL_TRADER);
        vm.prank(alice);
        usdc.approve(address(traderVault), type(uint256).max);

        usdc.mint(attacker, INITIAL_TRADER);
        vm.prank(attacker);
        usdc.approve(address(traderVault), type(uint256).max);
    }

    // ============ Access Control: Market ============

    function test_market_settle_onlyCreator() public {
        vm.expectRevert(bytes("Market: not operator"));
        vm.prank(attacker);
        market.settle(0);

        vm.prank(creator);
        market.settle(0);
        assertTrue(market.isSettled());
    }

    function test_market_settle_invalidOutcome() public {
        vm.expectRevert(bytes("Market: invalid outcome"));
        vm.prank(creator);
        market.settle(2);
    }

    function test_market_executeAMMTrade_onlyTraderVault() public {
        vm.expectRevert(bytes("Market: not TraderVault"));
        vm.prank(attacker);
        market.executeAMMTrade(attacker, 0, int256(1e18));
    }

    function test_market_createOrder_onlyTraderVault() public {
        vm.expectRevert(bytes("Market: not TraderVault"));
        vm.prank(attacker);
        market.createOrder(attacker, 0, 0.5e18, 10);
    }

    // ============ Access Control: TraderVault callbacks ============

    function test_traderVault_onOrderMatched_onlyMarket() public {
        vm.expectRevert(bytes("TraderVault: not market"));
        vm.prank(attacker);
        traderVault.onOrderMatched(1, 1, 1);
    }

    function test_traderVault_creditMergeProceeds_onlyOutcomeToken() public {
        // creditMergeProceeds is called by OutcomeToken during merge
        vm.expectRevert(bytes("TraderVault: not outcomeToken"));
        vm.prank(attacker);
        traderVault.creditMergeProceeds(attacker, 1);
    }

    // ============ Access Control: LiquidityVault ============

    function test_liquidityVault_withdrawFor_requiresSelfCall() public {
        // withdrawFor requires msg.sender == lp
        vm.expectRevert(bytes("LiquidityVault: not authorized"));
        vm.prank(attacker);
        liquidityVault.withdrawFor(alice, 1e18, attacker);
    }

    function test_liquidityVault_sendFunds_onlyAuthorized() public {
        vm.expectRevert(bytes("LiquidityVault: not authorized"));
        vm.prank(attacker);
        liquidityVault.sendFunds(1, attacker, 1e18);
    }

    function test_liquidityVault_allocateExposure_onlyAuthorized() public {
        vm.expectRevert(bytes("LiquidityVault: not authorized"));
        vm.prank(attacker);
        liquidityVault.allocateExposure(1, 1e18);
    }

    // ============ Slippage / Input Edge Cases ============

    function test_tradeAMM_buy_revertsOnMaxCostTooLow() public {
        vm.startPrank(alice);
        traderVault.deposit(1000e18);

        // Buying 100e18 shares should cost > 1 wei; set maxCost absurdly low.
        vm.expectRevert(bytes("TraderVault: slippage exceeded"));
        traderVault.tradeAMM(address(market), 0, 100e18, int256(1));

        vm.stopPrank();
    }

    function test_tradeAMM_sell_revertsOnMinProceedsTooHigh() public {
        vm.startPrank(alice);
        traderVault.deposit(2000e18);
        traderVault.tradeAMM(address(market), 0, 100e18, 2000e18);

        // Sell some shares but demand huge proceeds via maxCost negative bound.
        vm.expectRevert(bytes("TraderVault: slippage exceeded"));
        traderVault.tradeAMM(address(market), 0, -10e18, -int256(1_000_000e18));

        vm.stopPrank();
    }

    function test_placeOrder_invalidPrice_reverts() public {
        vm.startPrank(alice);
        traderVault.deposit(1000e18);

        vm.expectRevert(bytes("TraderVault: invalid price"));
        traderVault.placeOrder(address(market), 0, 0, 10, true);

        vm.expectRevert(bytes("TraderVault: invalid price"));
        traderVault.placeOrder(address(market), 0, 1e18, 10, true);

        vm.stopPrank();
    }

    function test_outcomeToken_mint_onlyMarket() public {
        IOutcomeToken outcomeToken = market.outcomeToken();
        vm.expectRevert(bytes("OutcomeToken: not market"));
        vm.prank(attacker);
        outcomeToken.mint(attacker, 0, 1);
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

    function allowance(address owner_, address spender) external view returns (uint256) {
        return _allowances[owner_][spender];
    }
}
