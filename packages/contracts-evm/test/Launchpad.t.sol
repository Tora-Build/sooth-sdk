// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "forge-std/Test.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

import {LaunchpadFactory} from "../contracts/launchpad/LaunchpadFactory.sol";
import {LaunchpadMarket} from "../contracts/launchpad/LaunchpadMarket.sol";
import {MarketLPVault} from "../contracts/launchpad/MarketLPVault.sol";
import {SoothTraderVaultV4} from "../contracts/core/SoothTraderVaultV4.sol";
import {SoothFeeController} from "../contracts/core/SoothFeeController.sol";
import {SoothGovernorVault} from "../contracts/core/SoothGovernorVault.sol";
import {ISoothGovernorVault} from "../contracts/core/SoothInterfaces.sol";

// Mock ERC20 for Testing
contract MockERC20 is ERC20 {
    uint8 private _decimals;
    constructor(string memory name, string memory symbol, uint8 decimals_) ERC20(name, symbol) {
        _decimals = decimals_;
    }
    
    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}

// We need a dummy OutcomeToken implementation for cloning
contract MockOutcomeToken is ERC20 {
    constructor() ERC20("Mock", "MCK") {}
    function initialize(string memory name, string memory symbol, address market) external {}
    function mint(address to, uint256 id, uint256 amount) external {}
    function burn(address from, uint256 id, uint256 amount) external {}
}

contract LaunchpadTest is Test {
    LaunchpadFactory factory;
    LaunchpadMarket marketImpl;
    MockERC20 usdc;
    SoothTraderVaultV4 traderVault;
    SoothGovernorVault globalGovernor; // Unused for launchpad but needed for factory init
    SoothFeeController feeController;
    MockOutcomeToken outcomeTokenImpl;

    address creator = address(0x100);
    address trader = address(0x200);

    function setUp() public {
        vm.startPrank(creator);
        
        // 1. Deploy Mocks & Dependencies
        usdc = new MockERC20("USDC", "USDC", 6); // 6 decimals to match mainnet USDC logic
        // Let's use 6 decimals to match mainnet USDC
        // MockERC20 default might be 18. Let's make sure.
        // If MockERC20 takes (name, symbol, decimals), use that.
        // Assuming standard OpenZeppelin ERC20 doesn't take decimals in constructor. 
        // We'll mock it if needed or assume 18.
        // Factory code: tierDeposits[0] = 100 * 1e6. So it expects 6 decimals if USDCs are 1e6.
        // But if USDC contract has 18, LaunchpadFactory doesn't check decimals, it just transfers amounts.
        // Logic checks: `IERC20(usdc).safeTransferFrom` use fixed amounts?
        // Yes, 1e6 hardcoded.
        // So we MUST use 6 decimals for USDC if we want values to make sense for a true test, 
        // OR just assume 1e6 is "1 unit" if 18 decimals.
        // Better to use 1e6 tokens if possible? Or just roll with 1e6 units being small.
        
        // 2. Deploy Protocols
        globalGovernor = new SoothGovernorVault(IERC20(address(usdc))); // Dummy
        feeController = new SoothFeeController(creator);
        outcomeTokenImpl = new MockOutcomeToken();
        
        // TraderVault needs governorVault initially? (V4.7 expects global gov or none?)
        traderVault = new SoothTraderVaultV4(IERC20(address(usdc)), ISoothGovernorVault(address(globalGovernor)));
        
        marketImpl = new LaunchpadMarket();
        
        // 3. Deploy Factory
        factory = new LaunchpadFactory(
            address(marketImpl),
            address(usdc),
            address(traderVault),
            address(globalGovernor),
            address(feeController),
            address(outcomeTokenImpl),
            creator, // treasury
            creator  // adjudicator
        );

        // 4. Fund Accounts
        // Tier 0 deposit = 100 * 1e6
        uint256 deposit = 100 * 1e6;
        usdc.mint(creator, deposit * 10);
        usdc.approve(address(factory), type(uint256).max);
        
        usdc.mint(trader, 1000 * 1e6);
        
        vm.stopPrank();
        
        // Approve for trader
        vm.startPrank(trader);
        usdc.approve(address(traderVault), type(uint256).max);
        vm.stopPrank();
    }

    function testCreateMarket() public {
        vm.startPrank(creator);
        
        (address marketAddr, address lpVaultAddr) = factory.createMarket(
            "Test Market",
            "TEST",
            "Desc",
            0, // Tier 0
            false,
            3600
        );
        
        LaunchpadMarket market = LaunchpadMarket(marketAddr);
        MarketLPVault lpVault = MarketLPVault(lpVaultAddr);
        
        // Checks
        assertEq(market.creator(), creator);
        assertEq(market.liquidityTierIndex(), 0);
        assertEq(address(market.governorVault()), address(lpVault));
        assertEq(lpVault.market(), address(market));
        assertEq(address(lpVault.asset()), address(usdc));
        
        // Check deposit moved
        assertEq(usdc.balanceOf(address(lpVault)), 100 * 1e6);
        assertEq(lpVault.totalAssets(), 100 * 1e6);
        
        vm.stopPrank();
    }

    function testTradingAndFees() public {
        vm.startPrank(creator);
        (address marketAddr, address lpVaultAddr) = factory.createMarket("M", "S", "D", 0, false, 3600);
        LaunchpadMarket market = LaunchpadMarket(marketAddr);
        vm.stopPrank();

        // Whitelist market in TraderVault (Creator is owner of TraderVault)
        vm.startPrank(creator);
        traderVault.setMarket(marketAddr, true);
        vm.stopPrank();
        
        vm.startPrank(trader);
        // Deposit to TraderVault
        traderVault.deposit(100 * 1e6);
        
        // Buy YES
        // b = 144.27 * 1e18? No, Factory sets bValue in WAD or 6 dec?
        // Factory: tierBValues[0] = 144269504; // 144 * 1e6?
        // V4/PRBMath expects WAD (18 decimals) for b?
        // If SoothMarketV4 uses CommonMath which might expect WAD.
        // Let's check Factory bValue passed.
        // initialize(...) takes bBase.
        // SoothMarketV4 stores bBase.
        // If bBase is small (1e8), cost calc might be weird if V4 logic expects 1e18.
        // V4: `cost = b * ln(...)`. ln returns WAD. b should be WAD to get WAD cost?
        // If USDC is 6 decimals, we might want cost in 6 decimals?
        // V4 usually handles WAD math internally and converts at edges?
        // Or if b is 144e6, then cost is 144e6 * ln(e) = 144e6.
        
        // Market.calculateAMMTradeCost returns cost (int256).
        // We need to see if it transfers standard amount.
        
        uint256 buyAmount = 10 * 1e18; // 10 shares (WAD)
        // We verify via TraderVault execution below

        
        // Use TraderVault
        // tradeAMM(market, outcome, shares, limit)
        uint256 shares = 10 * 1e18;
        uint256 limitCost = 100 * 1e6; // generous limit
        
        // We need to whitelist LaunchpadMarket in TraderVault?
        // TraderVault doesn't have whitelist for markets, just `isMarket` check?
        // V4 traderVault usually checks if market is valid?
        // `tradeAMM` calls `mkt.marketId()`.
        
        traderVault.tradeAMM(marketAddr, 0, int256(shares), int256(limitCost));
        
        // Check fee accrual
        // Pre-grad fee is 5%.
        // Cost approx: 10 shares / liquidity?
        // b ~ 144. cost ~ 10 * (price ~ 0.5) = 5?
        // Fee = 5 * 0.05 = 0.25?
        
        // Check bBase increase
        uint256 bBaseAfter = market.bBase();
        // tierBValues[0] is initial.
        uint256 bInitial = factory.getLiquidityB(0);
        
        assertTrue(bBaseAfter > bInitial, "Liquidity should grow from fees");
        
        vm.stopPrank();
    }
}
