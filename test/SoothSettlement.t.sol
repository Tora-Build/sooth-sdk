// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/settlement/SoothSettlementMerkle.sol";
import "../contracts/settlement/SoothZKVerifierStub.sol";
import "../contracts/core/SoothVault.sol";

// Minimal mock ERC20 used as collateral for the vault
contract MockERC20B {
    string public name = "MockUSD";
    string public symbol = "mUSD";
    uint8 public decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(allowance[from][msg.sender] >= amount, "allow");
        allowance[from][msg.sender] -= amount;
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "bal");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }
}

contract SoothSettlementTest is Test {
    SoothVault vault;
    SoothSettlementMerkle settlement;
    SoothZKVerifierStub verifier;
    MockERC20B collateral;

    address lp = address(0xAAA1);
    address user = address(0xBEEF);

    function setUp() public {
        // Set up collateral and vault
        collateral = new MockERC20B();
        vault = new SoothVault();
        vault.initialize(address(collateral));

        // Set up verifier + settlement
        verifier = new SoothZKVerifierStub();
        settlement = new SoothSettlementMerkle();
        settlement.initialize(address(vault), address(verifier));
        vault.setAuthorized(address(settlement), true);

        // Mint collateral for LP and user
        collateral.mint(lp, 1_000_000 ether);
        collateral.mint(user, 1_000_000 ether);
    }

    function _storeSettlement(address market, address account, int256 pnl) internal {
        bytes32 pnlRoot = keccak256(abi.encode(account, pnl));
        bytes memory proofData = hex"01"; // any non-empty data passes stub verifier
        settlement.storeSettlement(market, 0x0, pnlRoot, proofData);
    }

    function testZeroPnlClaimDoesNotTouchVaultBalances() public {
        address market = address(0xABCD);
        int256 pnl = int256(0);

        // Pre-conditions: user has no vault balance, pool is empty
        assertEq(vault.userBalances(user), 0);
        (uint256 totalLPBefore, uint256 lockedBefore) = vault.pools(bytes32(0));
        assertEq(totalLPBefore, 0);
        assertEq(lockedBefore, 0);

        // Store settlement root with pnl = 0 for user
        _storeSettlement(market, user, pnl);

        // Empty proof is valid for single-leaf tree: root == leaf
        bytes32[] memory proof = new bytes32[](0);

        vm.startPrank(user);
        settlement.claim(market, 0x0, pnl, proof);
        vm.stopPrank();

        // Vault balances should remain unchanged for zero PnL
        assertEq(vault.userBalances(user), 0);
        (uint256 totalLPAfter, uint256 lockedAfter) = vault.pools(bytes32(0));
        assertEq(totalLPAfter, totalLPBefore);
        assertEq(lockedAfter, lockedBefore);
    }

    function testPositivePnlMovesFundsFromLPToUser() public {
        address market = address(0xABCD);
        int256 pnl = int256(100 ether);

        // Seed LP pool for adjudicatorId = 0x0
        vm.startPrank(lp);
        collateral.approve(address(vault), type(uint256).max);
        vault.depositLP(bytes32(0), 500_000 ether);
        vm.stopPrank();

        (uint256 totalLPBefore, ) = vault.pools(bytes32(0));
        assertEq(totalLPBefore, 500_000 ether);
        assertEq(vault.userBalances(user), 0);

        _storeSettlement(market, user, pnl);

        bytes32[] memory proof = new bytes32[](0);

        vm.startPrank(user);
        settlement.claim(market, 0x0, pnl, proof);
        vm.stopPrank();

        (uint256 totalLPAfter, ) = vault.pools(bytes32(0));
        uint256 userBalAfter = vault.userBalances(user);

        // PnL is paid from LP pool to user
        assertEq(userBalAfter, uint256(pnl));
        assertEq(totalLPAfter, totalLPBefore - uint256(pnl));
    }

    function testNegativePnlMovesFundsFromUserToLP() public {
        address market = address(0xABCD);
        int256 pnl = -int256(100 ether);

        // User deposits into vault
        vm.startPrank(user);
        collateral.approve(address(vault), type(uint256).max);
        vault.depositUser(500_000 ether);
        vm.stopPrank();

        uint256 userBalBefore = vault.userBalances(user);
        (uint256 totalLPBefore, ) = vault.pools(bytes32(0));
        assertEq(userBalBefore, 500_000 ether);
        assertEq(totalLPBefore, 0);

        _storeSettlement(market, user, pnl);

        bytes32[] memory proof = new bytes32[](0);

        vm.startPrank(user);
        settlement.claim(market, 0x0, pnl, proof);
        vm.stopPrank();

        uint256 userBalAfter = vault.userBalances(user);
        (uint256 totalLPAfter, ) = vault.pools(bytes32(0));

        // Negative PnL is taken from user and added to LP pool
        uint256 loss = uint256(-pnl);
        assertEq(userBalAfter, userBalBefore - loss);
        assertEq(totalLPAfter, totalLPBefore + loss);
    }

    function testDoubleClaimReverts() public {
        address market = address(0xABCD);
        int256 pnl = int256(50 ether);

        // Seed LP pool
        vm.startPrank(lp);
        collateral.approve(address(vault), type(uint256).max);
        vault.depositLP(bytes32(0), 100_000 ether);
        vm.stopPrank();

        _storeSettlement(market, user, pnl);

        bytes32[] memory proof = new bytes32[](0);

        vm.startPrank(user);
        settlement.claim(market, 0x0, pnl, proof);

        // Second claim should revert
        vm.expectRevert(bytes("SoothSettle: claimed"));
        settlement.claim(market, 0x0, pnl, proof);
        vm.stopPrank();
    }

    function testBadProofReverts() public {
        address market = address(0xABCD);
        int256 correctPnl = int256(10 ether);
        int256 wrongPnl = int256(20 ether);

        _storeSettlement(market, user, correctPnl);

        // Build leaf with wrong PnL but same user, so proof will fail
        bytes32[] memory proof = new bytes32[](0);

        vm.startPrank(user);
        vm.expectRevert(bytes("SoothSettle: bad proof"));
        settlement.claim(market, 0x0, wrongPnl, proof);
        vm.stopPrank();
    }
}