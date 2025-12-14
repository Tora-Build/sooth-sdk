// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../contracts/core/SoothTraderVaultV4.sol";
import "../../contracts/core/SoothMarketV4.sol";
import "../../contracts/core/OutcomeToken.sol";
import "../../contracts/core/SoothGovernorVault.sol";
import "../../contracts/core/SoothFeeController.sol";
import "../../contracts/core/SoothInterfaces.sol";

/// @title Adversarial Scenarios
/// @notice Access-control + edge-case probes.
contract AdversarialScenariosTest is Test {
    MockUSDC usdc;
    SoothGovernorVault governorVault;
    SoothTraderVaultV4 traderVault;
    SoothMarketV4 market;
    OutcomeToken outcomeToken;
    SoothFeeController feeController;

    address owner = makeAddr("owner");
    address governor = makeAddr("governor");
    address alice = makeAddr("alice");
    address attacker = makeAddr("attacker");

    uint256 constant INITIAL_GOVERNOR = 100_000e18;
    uint256 constant INITIAL_TRADER = 10_000e18;
    uint256 constant B_PARAM = 10_000e18;

    function setUp() public {
        vm.startPrank(owner);

        usdc = new MockUSDC();
        feeController = new SoothFeeController(owner);
        feeController.setOrderbookFee(10);

        governorVault = new SoothGovernorVault(IERC20(address(usdc)));
        traderVault = new SoothTraderVaultV4(IERC20(address(usdc)), ISoothGovernorVault(address(governorVault)));
        outcomeToken = new OutcomeToken();
        market = new SoothMarketV4();

        outcomeToken.initialize(address(market), address(traderVault));
        market.initialize(
            1,
            address(governorVault),
            address(traderVault),
            address(feeController),
            address(outcomeToken),
            bytes32(0),
            B_PARAM,
            governor,
            0,
            0
        );

        traderVault.setMarket(address(market), true);
        traderVault.setOutcomeToken(address(outcomeToken), true);

        governorVault.setAuthorized(address(traderVault), true);
        governorVault.setAuthorized(address(market), true);
        governorVault.setAuthorized(address(outcomeToken), true);
        governorVault.setAuthorized(owner, true);

        usdc.mint(address(governorVault), INITIAL_GOVERNOR);
        governorVault.receiveFunds(1, INITIAL_GOVERNOR);

        vm.stopPrank();

        usdc.mint(alice, INITIAL_TRADER);
        vm.prank(alice);
        usdc.approve(address(traderVault), type(uint256).max);

        usdc.mint(attacker, INITIAL_TRADER);
        vm.prank(attacker);
        usdc.approve(address(traderVault), type(uint256).max);
    }

    // ============ Access Control: Market ============

    function test_market_settle_onlyGovernor() public {
        vm.expectRevert(bytes("Market: not governor"));
        vm.prank(attacker);
        market.settle(0);

        vm.prank(governor);
        market.settle(0);
        assertTrue(market.isSettled());
    }

    function test_market_settle_invalidOutcome() public {
        vm.expectRevert(bytes("Market: invalid outcome"));
        vm.prank(governor);
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

    // ============ Access Control: GovernorVault ============

    function test_governorVault_withdrawFor_requiresSelfCall() public {
        // withdrawFor requires msg.sender == lp
        vm.expectRevert(bytes("GovernorVault: not authorized"));
        vm.prank(attacker);
        governorVault.withdrawFor(alice, 1e18, attacker);
    }

    function test_governorVault_sendFunds_onlyAuthorized() public {
        vm.expectRevert(bytes("GovernorVault: not authorized"));
        vm.prank(attacker);
        governorVault.sendFunds(1, attacker, 1e18);
    }

    function test_governorVault_allocateExposure_onlyAuthorized() public {
        vm.expectRevert(bytes("GovernorVault: not authorized"));
        vm.prank(attacker);
        governorVault.allocateExposure(1, 1e18);
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
