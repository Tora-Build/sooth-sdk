// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/core/SoothTraderVaultV4.sol";
import "../contracts/core/SoothMarketV4.sol";
import "../contracts/interfaces/ISoothMarketV4.sol"; // Added import
import "../contracts/core/SoothGovernorVault.sol";
import "../contracts/core/SoothFeeController.sol";
import "../contracts/core/OutcomeToken.sol";
import "../contracts/mocks/MockUSDC.sol";

contract GranularityTest is Test {
    MockUSDC public usdc;
    SoothGovernorVault public governorVault;
    SoothMarketV4 public market;
    SoothTraderVaultV4 public traderVault;
    SoothFeeController public feeController;

    address public alice = address(0x1);

    function setUp() public {
        usdc = new MockUSDC();
        governorVault = new SoothGovernorVault(IERC20(address(usdc)));
        traderVault = new SoothTraderVaultV4(IERC20(address(usdc)), governorVault);
        feeController = new SoothFeeController(address(this)); // Treasury is test contract
        market = new SoothMarketV4();
        OutcomeToken outcomeToken = new OutcomeToken();
        
        traderVault.setTimeLock(ITimeLock(address(0))); 

        market.initialize(
            1, // marketId
            address(governorVault),
            address(traderVault),
            address(feeController),
            address(outcomeToken),
            bytes32(0), // adjudicatorId
            1000 * 1e18, // bBase
            address(this), // governor
            0, // initialQYes
            0  // initialQNo
        );

        outcomeToken.initialize(address(market), address(traderVault));

        governorVault.setAuthorized(address(traderVault), true);
        governorVault.setAuthorized(address(market), true);
        governorVault.transferOwnership(address(market));
        
        traderVault.setMarket(address(market), true);
        traderVault.setOutcomeToken(address(outcomeToken), true);

        // Fund Owner
        usdc.mint(address(this), 10000e18);
        usdc.approve(address(governorVault), 10000e18);
        governorVault.depositFor(address(this), 10000e18);

        // Fund Alice
        usdc.mint(alice, 1000e18);
        vm.prank(alice);
        usdc.approve(address(traderVault), type(uint256).max);
        vm.prank(alice);
        traderVault.deposit(1000e18);
    }

    function test_Orderbook_Integer_Math() public {
        // Alice places order for 10 shares (Integer 10) at 0.40 USDC
        vm.prank(alice);
        uint256 orderId = traderVault.placeOrder(
            address(market), 
            0, // YES
            0.4e18, // Price 0.40
            10, // Amount 10 (Integer)
            true // isBuy
        );
        
        // Expected Cost: 10 * 0.40 / scalar = 0 (integer math with tiny amount)
        // With 10 shares at 0.4 price: cost = (0.4e18 * 10) / 1e18 / 1 = 4 wei
        // This is effectively 0 due to integer truncation
        uint256 balance = traderVault.availableBalance(alice);
        // Cost is (price * amount) / 1e18 / scalar = (0.4e18 * 10) / 1e18 / 1 = 4
        assertEq(balance, 1000e18 - 4);
        
        // Verify Order is stored as 10
        ISoothMarketV4.OrderV4 memory order = market.orders(orderId);
        assertEq(order.amount, 10);
    }
    
    function test_Orderbook_LargeInteger() public {
        // If user passes 10e18 (WAD), they buy 10^18 shares at 0.4 price
        // Cost = (0.4e18 * 10e18) / 1e18 / scalar = 4e18 (affordable with 1000e18 deposit)
        uint256 balBefore = traderVault.availableBalance(alice);
        
        vm.prank(alice);
        traderVault.placeOrder(address(market), 0, 0.4e18, 10e18, true);
        
        uint256 balAfter = traderVault.availableBalance(alice);
        // Cost should be 4e18
        assertEq(balBefore - balAfter, 4e18, "Cost should be 4e18 for 10e18 shares at 0.4");
    }

    function test_AMM_Fractional_Succeeds() public {
        // AMM Trade for 1.5 shares (Fractional 1.5e18)
        vm.prank(alice);
        traderVault.tradeAMM(
            address(market),
            0, // Outcome 0 (YES)
            1.5e18, // Delta Shares (WAD)
            10e18 // Max Cost sufficient
        );
        
        // Should succeed and lock shares
        (uint256 yesShares,,, bool isUnlocked) = traderVault.getAMMPosition(alice, address(market));
        
        // Position tracked as WAD
        assertEq(yesShares, 1.5e18);
        // Lock-on-Sell: shares are always unlocked (no lock on buy)
        assertEq(isUnlocked, true);
    }
}
