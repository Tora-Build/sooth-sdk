// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/core/SoothVault.sol";
import "../contracts/core/SoothMarket.sol";

contract MockERC20 {
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

contract SoothMarketTest is Test {
    SoothVault vault;
    SoothMarket market;
    MockERC20 collateral;

    bytes32 adjId = keccak256("UMA_CLASS");
    bytes32 eventId = keccak256("EXAMPLE");
    address adjMgr = address(0xADJEC8);

    address lp = address(0xAAA1);
    address trader = address(0xBBB2);

    function setUp() public {
        collateral = new MockERC20();

        vault = new SoothVault();
        vault.initialize(address(collateral));

        market = new SoothMarket();
        market.initialize(address(vault), adjMgr, adjId, eventId, 1e18);

        vault.setAuthorized(address(market), true);

        collateral.mint(lp, 1_000_000 ether);
        collateral.mint(trader, 10_000 ether);

        vm.startPrank(lp);
        collateral.approve(address(vault), type(uint256).max);
        vault.depositLP(adjId, 500_000 ether);
        vm.stopPrank();

        vm.startPrank(trader);
        collateral.approve(address(vault), type(uint256).max);
        vault.depositUser(10_000 ether);
        vm.stopPrank();
    }

    function testBuySellLifecycle() public {
        vm.startPrank(trader);

        uint256 priceBefore = market.price(0);

        uint256 cost = market.buy(0, 100 ether);
        assertGt(cost, 0);

        uint256 priceAfter = market.price(0);
        assertGt(priceAfter, priceBefore);

        uint256 payout = market.sell(0, 50 ether);
        assertGt(payout, 0);

        vm.stopPrank();
    }
}
