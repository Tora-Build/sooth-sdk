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
import "../actors/TraderActor.sol";
import "../actors/LPActor.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Multi-Role Scenario Tests
/// @notice Tests concurrent interactions between Traders, LPs, and Markets
contract MultiRoleScenariosTest is Test {
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
    TraderActor[] traders;
    LPActor[] lpActors;
    
    // Constants
    address owner = makeAddr("owner");
    address creator = makeAddr("creator");
    uint256 constant NUM_TRADERS = 5;
    uint256 constant NUM_LPS = 3;
    uint256 constant INITIAL_LP_CAPITAL = 50_000e18;
    uint256 constant INITIAL_TRADER_BALANCE = 10_000e18;
    
    function setUp() public {
        vm.startPrank(owner);
        
        // Deploy infrastructure
        usdc = new MockUSDC();
        feeController = new SoothFeeController(owner);
        feeController.setOrderbookFee(10);
        
        liquidityVault = new SoothLiquidityVault(IERC20(address(usdc)), 6);
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
            address(protocolConfig), 6
        );
        
        // Create Launchpad market
        usdc.mint(creator, 1000 * 1e18);
        vm.startPrank(creator);
        usdc.approve(address(factory), type(uint256).max);
        (address marketAddr, ) = factory.createMarket(
            "Multi Role Test",
            "MULTI",
            "Test market for multi-role scenarios",
            0,
            false,
            30 days
        );
        market = LaunchpadMarket(marketAddr);
        vm.stopPrank();
        
        // Configure permissions
        traderVault.setMarket(address(market), true);
        traderVault.setOutcomeToken(address(market.outcomeToken()), true);
        liquidityVault.setAuthorized(address(traderVault), true);
        liquidityVault.setAuthorized(owner, true);
        
        // Initial LP capital via receiveFunds (for global vault operations)
        usdc.mint(address(liquidityVault), INITIAL_LP_CAPITAL);
        liquidityVault.receiveFunds(1, INITIAL_LP_CAPITAL);
        
        vm.stopPrank();
        
        // Create trader actors
        for (uint256 i = 0; i < NUM_TRADERS; i++) {
            TraderActor trader = new TraderActor(traderVault, market, usdc);
            traders.push(trader);
            usdc.mint(address(trader), INITIAL_TRADER_BALANCE);
        }
        
        // Create LP actors
        for (uint256 i = 0; i < NUM_LPS; i++) {
            LPActor lp = new LPActor(liquidityVault, usdc);
            lpActors.push(lp);
            usdc.mint(address(lp), INITIAL_LP_CAPITAL);
            // Authorize LP to deposit
            vm.prank(owner);
            liquidityVault.setAuthorized(address(lp), true);
        }
    }
    
    /// @notice Multiple traders trading simultaneously
    function test_ConcurrentTrading() public {
        // Setup: All traders deposit
        for (uint256 i = 0; i < traders.length; i++) {
            traders[i].deposit(5000e18);
        }
        
        // Concurrent trades
        for (uint256 i = 0; i < traders.length; i++) {
            traders[i].buyYes(50e18);
        }
        
        // Verify all positions created
        for (uint256 i = 0; i < traders.length; i++) {
            (uint256 yesShares, , , ) = traderVault.getAMMPosition(address(traders[i]), address(market));
            assertGt(yesShares, 0, "Trader should have YES shares");
        }
        
        // Verify governor solvency maintained
        assertGe(
            liquidityVault.totalAssets(),
            liquidityVault.totalLockedExposure(),
            "Governor must remain solvent"
        );
    }
    
    /// @notice LP deposits and withdraws while traders trade
    function test_LPDepositWithdrawDuringTrading() public {
        // LP deposits
        uint256 shares = lpActors[0].deposit(20_000e18);
        assertGt(shares, 0, "LP should receive shares");
        
        uint256 governorAssetsBefore = liquidityVault.totalAssets();
        
        // Traders start trading
        for (uint256 i = 0; i < 3; i++) {
            traders[i].deposit(3000e18);
            traders[i].buyYes(100e18);
        }
        
        // Verify trading increased governor assets (fees)
        assertGt(liquidityVault.totalAssets(), governorAssetsBefore, "Governor assets should increase from trading");
        
        // LP attempts partial withdrawal
        uint256 lpBalanceBefore = usdc.balanceOf(address(lpActors[0]));
        lpActors[0].withdraw(5000e18);
        uint256 lpBalanceAfter = usdc.balanceOf(address(lpActors[0]));
        
        // Withdrawal should work if exposure allows
        // (may or may not succeed depending on locked exposure)
        
        // Verify solvency maintained regardless
        assertGe(
            liquidityVault.totalAssets(),
            liquidityVault.totalLockedExposure(),
            "Must remain solvent after LP withdrawal attempt"
        );
    }
    
    /// @notice Many traders, many operations, verify invariants hold
    function test_HighConcurrency() public {
        // All traders deposit
        for (uint256 i = 0; i < traders.length; i++) {
            traders[i].deposit(8000e18);
        }
        
        // Rapid fire trades over multiple rounds
        for (uint256 round = 0; round < 3; round++) {
            // Buy YES
            for (uint256 i = 0; i < traders.length; i++) {
                traders[i].buyYes(30e18);
            }
            
            // Some sell, some buy NO
            for (uint256 i = 0; i < traders.length; i++) {
                if (i % 2 == 0) {
                    traders[i].sellYes(10e18);
                } else {
                    traders[i].buyNo(30e18);
                }
            }
            
            // More buys
            for (uint256 i = 0; i < traders.length; i++) {
                traders[i].buyYes(20e18);
            }
        }
        
        // Verify invariants
        assertGe(
            liquidityVault.totalAssets(),
            liquidityVault.totalLockedExposure(),
            "Solvency invariant"
        );
        
        // Verify prices still sum to 1
        uint256 yesPrice = market.price(0);
        uint256 noPrice = market.price(1);
        assertApproxEqAbs(yesPrice + noPrice, 1e18, 1, "Price invariant");
    }
    
    /// @notice LP + Traders interact - LP provides liquidity, traders use it
    function test_LPTraderInteraction() public {
        // LP deposits
        uint256 lpShares = lpActors[0].deposit(30_000e18);
        assertGt(lpShares, 0, "LP should have shares");
        
        uint256 governorAssetsBefore = liquidityVault.totalAssets();
        
        // Traders trade (consume liquidity)
        for (uint256 i = 0; i < 3; i++) {
            traders[i].deposit(5000e18);
            traders[i].buyYes(200e18);
        }
        
        // Verify liquidity was used (governor received funds)
        assertGt(liquidityVault.totalAssets(), governorAssetsBefore, "Governor should receive trade funds");
        
        // Verify LP shares still valid
        assertGt(lpActors[0].getShares(), 0, "LP should still have shares");
    }
    
    /// @notice Traders use both AMM and orderbook
    function test_MixedAMMAndOrderbook() public {
        // Setup
        for (uint256 i = 0; i < traders.length; i++) {
            traders[i].deposit(5000e18);
        }
        
        // Some traders use AMM
        for (uint256 i = 0; i < 3; i++) {
            traders[i].buyYes(100e18);
        }
        
        // Others place limit orders
        for (uint256 i = 3; i < traders.length; i++) {
            traders[i].placeBuyOrder(0.5e18, 50);
        }
        
        // Verify AMM traders have positions
        uint256 ammTraders = 0;
        for (uint256 i = 0; i < 3; i++) {
            (uint256 yes, , , ) = traderVault.getAMMPosition(address(traders[i]), address(market));
            if (yes > 0) ammTraders++;
        }
        assertGt(ammTraders, 0, "AMM should have traders");
        
        // Verify solvency
        assertGe(
            liquidityVault.totalAssets(),
            liquidityVault.totalLockedExposure(),
            "Solvency after mixed trading"
        );
    }
    
    /// @notice Stress test - many operations, verify no accounting drift
    function test_StressTest_ManyOperations() public {
        // Setup all actors
        for (uint256 i = 0; i < traders.length; i++) {
            traders[i].deposit(INITIAL_TRADER_BALANCE);
        }
        
        // Execute many operations
        for (uint256 round = 0; round < 10; round++) {
            for (uint256 i = 0; i < traders.length; i++) {
                uint256 action = i % 4;
                
                if (action == 0) {
                    traders[i].buyYes(10e18);
                } else if (action == 1) {
                    traders[i].buyNo(10e18);
                } else if (action == 2) {
                    traders[i].sellYes(5e18);
                } else {
                    traders[i].placeBuyOrder(0.6e18, 20);
                }
            }
        }
        
        // Verify invariants still hold
        assertGe(
            liquidityVault.totalAssets(),
            liquidityVault.totalLockedExposure(),
            "Solvency after stress test"
        );
        
        // Verify prices valid
        uint256 yesPrice = market.price(0);
        uint256 noPrice = market.price(1);
        assertApproxEqAbs(yesPrice + noPrice, 1e18, 1, "Prices sum to 1");
        
        // Verify no massive accounting drift (allow 1000 wei)
        uint256 finalVaultBalance = usdc.balanceOf(address(traderVault));
        uint256 sumAvailable = 0;
        for (uint256 i = 0; i < traders.length; i++) {
            sumAvailable += traderVault.availableBalance(address(traders[i]));
        }
        assertApproxEqAbs(finalVaultBalance, sumAvailable, 1000, "Vault balance consistency");
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
