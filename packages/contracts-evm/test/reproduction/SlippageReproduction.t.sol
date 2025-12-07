// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../contracts/core/SoothTraderVault.sol";
import "../../contracts/core/SoothMarket.sol";
import "../../contracts/core/SoothLMSRReal.sol";
import "../../contracts/core/SoothGovernorVault.sol";
import "../../contracts/core/SoothFeeController.sol";
import "../../contracts/core/SoothInterfaces.sol";

contract MockUSDCTest is IERC20 {
    string public name = "Mock USDC";
    string public symbol = "mUSDC";
    uint8 public decimals;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(uint8 _decimals) {
        decimals = _decimals;
    }

    function transfer(address recipient, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[recipient] += amount;
        return true;
    }
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool) {
        allowance[sender][msg.sender] -= amount;
        balanceOf[sender] -= amount;
        balanceOf[recipient] += amount;
        return true;
    }
    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }
}

contract SlippageReproduction is Test {
    MockUSDCTest public usdc;
    SoothTraderVault public traderVault;
    SoothMarket public market;
    SoothGovernorVault public governorVault;
    SoothLMSRReal public amm;
    SoothFeeController public feeController;

    address public user = address(1);
    
    function setUp() public {
        // Test with 18 decimals (Live Default) to check precision matching
        usdc = new MockUSDCTest(18);
        
        amm = new SoothLMSRReal();
        feeController = new SoothFeeController(address(this));
        feeController.setOrderbookFee(10); 
        
        governorVault = new SoothGovernorVault(IERC20(address(usdc)));
        
        traderVault = new SoothTraderVault(IERC20(address(usdc)), ISoothGovernorVault(address(governorVault)));
        
        market = new SoothMarket();
        
        uint256 bParam = 10000 * 1e18; // 10,000 liquidity
        int256 initialQ = 1000 * 1e18; 
        
        market.initialize(
            1,
            ISoothGovernorVault(address(governorVault)),
            address(traderVault),
            ISoothAMM(address(amm)),
            ISoothFeeController(address(feeController)),
            bytes32(0),
            bParam,
            address(this),
            initialQ
        );
        
        traderVault.setMarket(address(market), true);
        traderVault.setGovernorVault(ISoothGovernorVault(address(governorVault)));
        
        governorVault.setAuthorized(address(traderVault), true);
        governorVault.setAuthorized(address(this), true);
        
        // Fund Governor
        usdc.mint(address(governorVault), 1_000_000 * 1e18);
        // address(this) is authorized, so just call it
        governorVault.receiveFunds(1, 1000 * 1e18); // Fake profit to allow trading
    }

    function testSellSlippage() public {
        // 1. Setup User with Shares
        // Buy first to get shares
        usdc.mint(user, 1000 * 1e18);
        vm.startPrank(user);
        usdc.approve(address(traderVault), 1000 * 1e18);
        traderVault.deposit(1000 * 1e18);
        
        // Buy 10 Shares of YES
        // Cost approx 0.5 * 10 = 5 USDC
        // AMM uses 18 decimals
        int256 buyShares = 10 * 1e18;
        
        // Max Cost: We don't care about buy checks here, giving generous limit
        // 10 USDC = 10 * 1e18
        uint256 maxCostBuy = 10 * 1e18;
        
        traderVault.tradeAMM(address(market), 0, buyShares, int256(maxCostBuy));
        
        // Verify Balance
        assertEq(market.yesBalance(user), 10 * 1e18);
        
        // 2. Simulate Sell Calculation (Frontend Logic)
        int256 sellShares = -1 * 1e18; // Sell 1 Share
        
        // Simulate Frontend Query (Snapshot state)
        vm.stopPrank(); // Stop user prank
        
        uint256 snapshot = vm.snapshot();
        
        vm.prank(address(traderVault)); 
        (int256 rawCost, uint256 rawFee) = market.executeAMMTrade(user, 0, sellShares);
        
        vm.revertTo(snapshot);
        
        vm.startPrank(user); // Restart user prank
        
        // Scale Down Logic
        uint256 scale = 1; // 10**(18-18)
        int256 scaledCost = rawCost / int256(scale); 
        uint256 scaledFee = rawFee / scale;          
// e.g. 0.005 * 0.5 * 1e6 = 2,500
        
        console.log("Raw Cost:", vm.toString(rawCost));
        console.log("Scaled Cost:", vm.toString(scaledCost));
        console.log("Scaled Fee:", vm.toString(scaledFee));
        
        // Net Proceeds (Contract Logic)
        uint256 grossProceeds = uint256(-scaledCost);
        uint256 netProceeds = grossProceeds - scaledFee;
        console.log("Net Proceeds (Contract):", vm.toString(netProceeds));
        
        // Frontend Logic for Max Cost (Limit)
        // expectedCost = scaledCost + scaledFee (e.g. -500,000 + 2,500 = -497,500)
        // Note: Frontend "expectedCost" variable is usually unsigned magnitude in hook, but signed in logic
        // Use logic from useTradeQuote: totalCost = expectedCost + fee
        // expectedCost (here) is negative.
        int256 expectedTotalCost = scaledCost + int256(scaledFee);
        console.log("Total Cost (Frontend):", vm.toString(expectedTotalCost));

        // Slippage: 0.5% (50bps) + Buffer (50bps) = 100bps = 1%
        // maxCost = -(totalCost * 0.99)
        // Since expectedTotalCost is negative (e.g. -497,500)
        // maxCost = -(-497,500 * 9900 / 10000) = -492,525
        
        // maxCost = expectedTotalCost * 0.99 (Since expectedTotalCost is negative, result is negative)
        // e.g. -497,500 * 0.99 = -492,525 (Closer to zero)
        int256 maxCostLimit = (expectedTotalCost * 9900) / 10000; 
        console.log("Max Cost Limit (Frontend):", vm.toString(maxCostLimit));
        
        // Check if it passes checks
        // require(-netProceeds <= maxCostLimit)
        // require(-497,500 <= -492,525) -> TRUE
        
        bool willPass = -int256(netProceeds) <= maxCostLimit;
        console.log("Will Pass:", willPass);
        assertTrue(willPass, "Prediction should pass");

        // Execute Real Trade
        traderVault.tradeAMM(address(market), 0, sellShares, maxCostLimit);
        
        vm.stopPrank();
    }
}
