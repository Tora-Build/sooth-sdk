// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/core/SoothTraderVaultV4.sol";
import "../contracts/core/SoothMarketV4.sol";
import "../contracts/core/OutcomeToken.sol";
import "../contracts/mocks/MockUSDC.sol";
import "../contracts/core/SoothGovernorVault.sol";
import "../contracts/core/SoothFeeController.sol";

contract CustodialVaultTest is Test {
    SoothTraderVaultV4 vault;
    SoothMarketV4 market;
    OutcomeToken token;
    MockUSDC usdc;
    SoothGovernorVault governor;
    SoothFeeController feeController;

    address user = address(0x1);
    address buyer = address(0x2);

    function setUp() public {
        usdc = new MockUSDC();
        governor = new SoothGovernorVault(IERC20(address(usdc)));
        token = new OutcomeToken();
        feeController = new SoothFeeController(address(this));

        market = new SoothMarketV4();
        vault = new SoothTraderVaultV4(IERC20(address(usdc)), governor);

        // Init Market
        market.initialize(
            1, // marketId
            address(governor),
            address(vault),
            address(feeController),
            address(token),
            bytes32(0),
            1000e18, // bBase
            address(this), // governor
            1000e18, // qYes
            1000e18  // qNo
        );
        
        token.initialize(address(market), address(vault));
        vault.setMarket(address(market), true);
        vault.setOutcomeToken(address(token), true); // OutcomeToken calls creditMergeProceeds

        // Authorize in Governor (Required for sendFunds)
        governor.setAuthorized(address(market), true);
        governor.setAuthorized(address(vault), true);

        // Fund Governor
        usdc.mint(address(governor), 10000e18);
        
        // Fund User
        usdc.mint(user, 1000e18);
        vm.startPrank(user);
        usdc.approve(address(vault), 1000e18);
        vault.deposit(1000e18);
        vm.stopPrank();

        // Fund Buyer
        usdc.mint(buyer, 1000e18);
        vm.startPrank(buyer);
        usdc.approve(address(vault), 1000e18);
        vault.deposit(1000e18);
        vm.stopPrank();
    }

    function testCustodialFlow() public {
        // 1. User Buys YES (Standard Order)
        vm.startPrank(user);
        // Place Buy Order: 10 YES at 0.60
        vault.placeOrder(address(market), 0, 0.6e18, 10e18, true);
        vm.stopPrank();

        // 2. Buyer Sells YES (Matches User) -> Buyer shorts NO
        vm.startPrank(buyer);
        // Place Short Sell (Buy NO): 10 NO at 0.40 (matches 0.60 YES)
        uint256 shortId = vault.placeOrder(address(market), 0, 0.6e18, 10e18, false);
        vm.stopPrank();

        // 3. Verify Custodial Balances
        // User should have 10 YES in Internal Ledger
        assertEq(vault.shareBalances(user, address(market), 0), 10e18, "User should have 10 YES");
        // Buyer should have 10 NO in Internal Ledger
        assertEq(vault.shareBalances(buyer, address(market), 1), 10e18, "Buyer should have 10 NO");
        
        // 4. Verify External Balances (Vault holds tokens)
        assertEq(token.balanceOf(address(vault), 0), 10e18, "Vault should hold YES");
        assertEq(token.balanceOf(address(vault), 1), 10e18, "Vault should hold NO");
        
        // 5. User Spot Sells 5 YES (Partial Close)
        vm.startPrank(user);
        // Matches Buyer's Short? No, Buyer has NO. User needs to sell YES to someone buying YES.
        // Let buyer place another Buy YES order.
        vm.stopPrank();
        
        vm.startPrank(buyer);
        vault.placeOrder(address(market), 0, 0.5e18, 5e18, true); // Bid at 0.50
        vm.stopPrank();
        
        vm.startPrank(user);
        // Spot Sell 5 YES at 0.50
        // Expected Payout: 5 * 0.50 = 2.50 USDC
        uint256 preBal = vault.availableBalance(user);
        vault.placeSpotOrder(address(market), 0, 0.5e18, 5e18);
        uint256 postBal = vault.availableBalance(user);
        
        // 6. Verify Payout Logic (Spot Sell Fix)
        // User sold 5 at 0.50. Payout should be 2.5 USDC.
        uint256 diff = postBal - preBal;
        assertEq(diff, 2.5e18, "Payout should be Price * Amount");
        
        // 7. Verify Share Balance reduced
        assertEq(vault.shareBalances(user, address(market), 0), 5e18, "User should have 5 YES left");
        
        // 8. Withdraw Remaining 5 YES
        vault.withdrawShares(address(market), 0, 5e18);
        assertEq(vault.shareBalances(user, address(market), 0), 0, "Internal balance 0");
        assertEq(token.balanceOf(user, 0), 5e18, "User wallet has 5 YES");
        vm.stopPrank();
    }
}
