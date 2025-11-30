// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/core/SoothRiskManager.sol";
import "../contracts/core/SoothVault.sol";
import "../contracts/core/SoothInterfaces.sol";

contract MockERC20 is IERC20Metadata {
    string private _name = "Mock USDC";
    string private _symbol = "mUSDC";
    uint8 private _decimals = 18;
    uint256 public override totalSupply;
    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function name() external view override returns (string memory) { return _name; }
    function symbol() external view override returns (string memory) { return _symbol; }
    function decimals() external view override returns (uint8) { return _decimals; }
    function transfer(address to, uint256 amount) external override returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
    function approve(address spender, uint256 amount) external override returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }
}

contract LiquidityModelTest is Test {
    SoothVault vault;
    SoothRiskManager riskManager;
    MockERC20 collateral;

    function setUp() public {
        collateral = new MockERC20();
        vault = new SoothVault(collateral);
        riskManager = new SoothRiskManager(vault);
        
        // Authorize test contract to allocate exposure (simulating factory)
        vault.setAuthorized(address(this), true);
        
        // Deposit 100k
        collateral.mint(address(this), 100_000 ether);
        collateral.approve(address(vault), 100_000 ether);
        vault.depositFor(address(this), 100_000 ether);
    }

    function testSoftCapModel() public {
        // K = 10
        riskManager.setGlobalMaxConcurrentWorstCase(10);
        
        // Initial state: T=100k, B=100k
        // FairShare = 100k/10 = 10k
        // Lmax = min(10k, 100k) = 10k
        
        riskManager.updateGlobalB();
        (uint256 bGlobal,) = riskManager.globalRisk();
        
        // bGlobal ≈ 10k * 1.4427 = 14427
        assertApproxEqAbs(bGlobal, 14427 ether, 1 ether);
        
        // Simulate creating 9 markets (locking 9 * 10k = 90k)
        // Note: Real Lmax is b * ln(2) ≈ 10k
        // We'll just lock exactly 10k per market for simplicity
        vault.allocateExposure(1, 90_000 ether);
        
        // State: T=100k, B=10k
        // FairShare = 10k
        // Lmax = min(10k, 10k) = 10k
        
        riskManager.updateGlobalB();
        (bGlobal,) = riskManager.globalRisk();
        
        // Should still be full size!
        assertApproxEqAbs(bGlobal, 14427 ether, 1 ether);
        
        // Create 10th market (locking 10k)
        vault.allocateExposure(2, 10_000 ether);
        
        // State: T=100k, B=0
        // FairShare = 10k
        // Lmax = min(10k, 0) = 0
        
        riskManager.updateGlobalB();
        (bGlobal,) = riskManager.globalRisk();
        
        // Market 11 gets 0 (Soft Cap hit)
        assertEq(bGlobal, 0);
    }
    
    function testPartialBuffer() public {
        // K = 10
        // Lock 95k (so 5k remaining)
        vault.allocateExposure(1, 95_000 ether);
        
        // State: T=100k, B=5k
        // FairShare = 10k
        // Lmax = min(10k, 5k) = 5k
        
        riskManager.updateGlobalB();
        (uint256 bGlobal,) = riskManager.globalRisk();
        
        // Should be half size (5k * 1.4427 ≈ 7213)
        assertApproxEqAbs(bGlobal, 7213 ether, 1 ether);
    }
}
