// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/settlement/SoothSettlementMerkle.sol";
import "../contracts/settlement/SoothZKVerifierStub.sol";
import "../contracts/core/SoothVault.sol";

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

    address user = address(0xBEEF);

    function setUp() public {
        collateral = new MockERC20B();
        vault = new SoothVault();
        vault.initialize(address(collateral));
        verifier = new SoothZKVerifierStub();
        settlement = new SoothSettlementMerkle();
        settlement.initialize(address(vault), address(verifier));

        collateral.mint(address(this), 1_000_000 ether);
        collateral.approve(address(vault), type(uint256).max);
        vault.depositUser(100_000 ether);
    }

    function testStoreSettlementAndClaim() public {
        bytes32 pnlRoot = keccak256(abi.encode(user, int256(100 ether)));
        // trivial Merkle proof: single leaf, root = leaf
        bytes memory proofData = hex"01";
        settlement.storeSettlement(address(0xABCD), 0x0, pnlRoot, proofData);

        bytes32[] memory proof = new bytes32[](0);

        settlement.claim(address(0xABCD), 0x0, int256(100 ether), proof);
        // verify vault balance movement
        // (this test is mostly checking that call does not revert)
    }
}
