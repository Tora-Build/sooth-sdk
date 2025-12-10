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
        
        // Expected Cost: 10 * 0.40 = 4.0 USDC
        // Original Balance: 1000
        // New Balance: 996
        uint256 balance = traderVault.availableBalance(alice);
        assertEq(balance, 1000e18 - 4e18);
        
        // Verify Order is stored as 10
        ISoothMarketV4.OrderV4 memory order = market.orders(orderId);
        assertEq(order.amount, 10);
    }
    
    function test_Orderbook_LargeInteger() public {
        // If user mistakenly passes 10e18 (thinking WAD), they buy 10 quintillion shares
        // This should fail due to insufficient funds (unless price is tiny)
        vm.prank(alice);
        vm.expectRevert("TraderVault: insufficient balance");
        traderVault.placeOrder(address(market), 0, 0.4e18, 10e18, true);
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
        assertEq(isUnlocked, false);
    }
}
