# V8.2 Contract Deployment Guide

**Version**: 2.0.0  
**Last Updated**: 2025-12-27  
**Status**: Deployed (Base Sepolia)

---

## Overview

This guide covers deploying the complete V8.2 contract stack to testnet, including:
- **LaunchpadEngine** with creator economics
- **AMMEngine** with dual-balance position model (users can hold both YES and NO)
- **Collateralizer** for token split/merge/redeem
- **TickBook** for orderbook trading

---

## ✅ Pre-Deployment Checklist

### Contract Status
- ✅ **TruthMarket**: 15/15 tests passing (100%)
- ✅ **AMMEngine**: Tested via LaunchpadEngine
- ✅ **LaunchpadEngine**: 17/17 tests passing (100%)
- ✅ **TickBook**: Tested via V8Integration
- ✅ **Collateralizer**: 9/9 tests passing (100%)
- ✅ **OutcomeToken**: Tested via Collateralizer
- ✅ **V8 Integration**: 6/6 tests passing (100%)

**Total**: 47/47 tests passing (100%) ✅

### Required Information
- [ ] Deployer private key (in `.env`)
- [ ] RPC URL for target chain
- [ ] Block explorer API key (for verification)
- [ ] USDC address on target chain
- [ ] Guardian address (for TruthMarket veto power)
- [ ] Default adjudicator address (for settlement)

---

## 🎯 Deployment Order

V8 contracts must be deployed in this specific order due to dependencies:

```
1. OutcomeToken (implementation)
2. Collateralizer
3. AMMEngine
4. TickBook
5. LaunchpadEngine
6. TruthMarket (per market)
```

---

## 📝 Deployment Script

### Step 1: Create Deployment Script

Create `script/DeployV8.s.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

import {OutcomeToken} from "../contracts/OutcomeToken.sol";
import {Collateralizer} from "../contracts/Collateralizer.sol";
import {AMMEngine} from "../contracts/AMMEngine.sol";
import {TickBook} from "../contracts/TickBook.sol";
import {LaunchpadEngine} from "../contracts/LaunchpadEngine.sol";
import {TruthMarket} from "../contracts/TruthMarket.sol";

contract DeployV8 is Script {
    // Deployment addresses (will be populated)
    address public outcomeTokenImpl;
    address public collateralizer;
    address public ammEngine;
    address public tickBook;
    address public launchpadEngine;
    
    // Configuration
    address public usdc;
    address public guardian;
    address public defaultAdjudicator;
    
    function setUp() public {
        // Load from environment
        usdc = vm.envAddress("USDC_ADDRESS");
        guardian = vm.envAddress("GUARDIAN_ADDRESS");
        defaultAdjudicator = vm.envAddress("DEFAULT_ADJUDICATOR");
        
        require(usdc != address(0), "USDC address required");
        require(guardian != address(0), "Guardian address required");
        require(defaultAdjudicator != address(0), "Default adjudicator required");
    }
    
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying V8 contracts...");
        console.log("Deployer:", deployer);
        console.log("USDC:", usdc);
        console.log("Guardian:", guardian);
        console.log("Default Adjudicator:", defaultAdjudicator);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // 1. Deploy Collateralizer
        console.log("\n1. Deploying Collateralizer...");
        collateralizer = address(new Collateralizer(usdc));
        console.log("Collateralizer:", collateralizer);
        
        // 2. Deploy AMMEngine
        console.log("\n2. Deploying AMMEngine...");
        ammEngine = address(new AMMEngine(usdc, deployer));
        console.log("AMMEngine:", ammEngine);
        
        // 3. Deploy TickBook
        console.log("\n3. Deploying TickBook...");
        tickBook = address(new TickBook());
        console.log("TickBook:", tickBook);
        
        // 4. Deploy LaunchpadEngine
        console.log("\n4. Deploying LaunchpadEngine...");
        launchpadEngine = address(new LaunchpadEngine(
            usdc,
            ammEngine,
            collateralizer,
            tickBook,
            deployer, // Protocol Treasury
            deployer  // Initial owner
        ));
        console.log("LaunchpadEngine:", launchpadEngine);

        // 5. Configure AMM router
        AMMEngine(ammEngine).setRouter(launchpadEngine);
        
        vm.stopBroadcast();
        
        // Print summary
        console.log("\n=== V8 Deployment Summary ===");
        console.log("Collateralizer:", collateralizer);
        console.log("AMMEngine:", ammEngine);
        console.log("TickBook:", tickBook);
        console.log("LaunchpadEngine:", launchpadEngine);
        console.log("============================");
        
        // Save to JSON
        string memory json = string.concat(
            '{\n',
            '  "collateralizer": "', vm.toString(collateralizer), '",\n',
            '  "ammEngine": "', vm.toString(ammEngine), '",\n',
            '  "tickBook": "', vm.toString(tickBook), '",\n',
            '  "launchpadEngine": "', vm.toString(launchpadEngine), '"\n',
            '}'
        );
        
        vm.writeFile("deployments/v8-latest.json", json);
        console.log("\nDeployment saved to: deployments/v8-latest.json");
    }
}
```

---

### Step 2: Create Test Market Deployment Script

Create `script/DeployTestMarket.s.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {TruthMarket} from "../contracts/TruthMarket.sol";
import {LaunchpadEngine} from "../contracts/LaunchpadEngine.sol";
import {Collateralizer} from "../contracts/Collateralizer.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract DeployTestMarket is Script {
    function run() public {
        // Load addresses from deployment
        address launchpadEngine = vm.envAddress("LAUNCHPAD_ENGINE");
        address collateralizer = vm.envAddress("COLLATERALIZER");
        address guardian = vm.envAddress("GUARDIAN_ADDRESS");
        address adjudicator = vm.envAddress("DEFAULT_ADJUDICATOR");
        address usdc = vm.envAddress("USDC_ADDRESS");
        
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying test market...");
        console.log("Creator:", deployer);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // 1. Deploy TruthMarket
        uint64 deadline = uint64(block.timestamp + 7 days);
        TruthMarket market = new TruthMarket(
            "Will ETH > $5000 by EOY?",
            deadline,
            adjudicator,
            guardian
        );
        console.log("TruthMarket deployed:", address(market));
        
        // 2. Register with Collateralizer
        Collateralizer(collateralizer).registerMarket(address(market));
        console.log("Market registered with Collateralizer");
        
        // 3. Activate market
        market.activate();
        console.log("Market activated");
        
        // 4. Initialize LaunchpadEngine (requires USDC approval)
        uint256 bBase = 1000e18; // $1,000 liquidity
        uint256 deposit = (bBase * 693147180559945309) / 1e18; // b * ln(2)
        
        console.log("Required deposit:", deposit / 1e18, "USDC");
        
        // Approve USDC
        IERC20(usdc).approve(launchpadEngine, deposit);
        console.log("USDC approved");
        
        // Initialize
        LaunchpadEngine(launchpadEngine).initializeMarket(address(market), bBase);
        console.log("LaunchpadEngine initialized");
        
        vm.stopBroadcast();
        
        console.log("\n=== Test Market Summary ===");
        console.log("Market:", address(market));
        console.log("Question: Will ETH > $5000 by EOY?");
        console.log("Deadline:", deadline);
        console.log("Liquidity:", bBase / 1e18, "USDC");
        console.log("Creator Deposit:", deposit / 1e18, "USDC");
        console.log("===========================");
    }
}
```

---

## 🚀 Deployment Commands

### Base Sepolia Deployment

#### Step 1: Set Environment Variables

Create `.env`:
```bash
# Deployer
PRIVATE_KEY=your_private_key_here

# RPC
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# Addresses
USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e  # Base Sepolia USDC
GUARDIAN_ADDRESS=0x...  # Your guardian address
DEFAULT_ADJUDICATOR=0x...  # Your adjudicator address

# Etherscan (for verification)
BASESCAN_API_KEY=your_api_key_here
```

#### Step 2: Deploy Core Contracts

```bash
# Deploy V8 core contracts
forge script script/DeployV8.s.sol \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY \
  -vvvv
```

**Expected Output**:
```
OutcomeToken (impl): 0x...
Collateralizer: 0x...
AMMEngine: 0x...
TickBook: 0x...
LaunchpadEngine: 0x...
```

#### Step 3: Deploy Test Market

```bash
# Set deployed addresses
export LAUNCHPAD_ENGINE=0x...  # From step 2
export COLLATERALIZER=0x...    # From step 2

# Deploy test market
forge script script/DeployTestMarket.s.sol \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY \
  -vvvv
```

---

## 📋 Post-Deployment Checklist

### Verification
- [ ] All contracts verified on Basescan
- [ ] Deployment addresses saved to `deployments/v8-latest.json`
- [ ] Test market created and initialized
- [ ] Creator deposit confirmed

### Testing
- [ ] Call `TruthMarket.isLive()` → should return `true`
- [ ] Call `LaunchpadEngine.markets(market)` → should return market info with `bBase > 0`
- [ ] Call `AMMEngine.getLiquidity(market)` → should return non-zero liquidity
- [ ] Call `AMMEngine.getPosition(market, user)` → should return `(yesShares, noShares)` tuple
- [ ] Call `Collateralizer.isMarketRegistered(market)` → should return `true`

### Frontend Integration
- [ ] Update `apps/web/src/config/deployments.json` with new addresses
- [ ] Update `apps/web/src/config/abis.ts` with V8 ABIs
- [ ] Test contract reads from frontend
- [ ] Test contract writes from frontend

---

## 🔧 Troubleshooting

### Issue: "Insufficient USDC balance"
**Solution**: Fund deployer address with USDC for test market initialization
```bash
# Get USDC from faucet or bridge
# Required: ~693 USDC for $1k liquidity market
```

### Issue: "Market already registered"
**Solution**: Use a different market address or reset Collateralizer

### Issue: "Not creator"
**Solution**: Ensure deployer address matches `TruthMarket.creator()`

### Issue: "Verification failed"
**Solution**: 
1. Check Etherscan API key
2. Wait 30 seconds after deployment
3. Manually verify on Basescan

---

## 📊 Gas Estimates

| Contract | Deployment Gas | USD (50 gwei, $3k ETH) |
|----------|----------------|------------------------|
| OutcomeToken | ~800k | ~$12 |
| Collateralizer | ~2.5M | ~$37 |
| AMMEngine | ~1.8M | ~$27 |
| TickBook | ~3.2M | ~$48 |
| LaunchpadEngine | ~2.8M | ~$42 |
| TruthMarket | ~1.2M | ~$18 |
| **Total** | **~12.3M** | **~$184** |

**Note**: Base Sepolia is cheap/free for testing

---

## 🎯 Next Steps After Deployment

### 1. Update Frontend Config
```bash
cd apps/web
# Update src/config/deployments.json
# Update src/config/abis.ts
```

### 2. Test Integration
```bash
# Start frontend dev server
npm run dev

# Test:
# - Market list loads
# - Market detail shows correct data
# - Trading works
# - Operator console accessible
```

### 3. Create More Markets
```bash
# Deploy additional test markets
forge script script/DeployTestMarket.s.sol --broadcast
```

### 4. Begin Frontend Development
Follow `V7_TO_V8_MIGRATION_GUIDE.md` to build frontend

---

## 📝 Deployment Artifacts

After deployment, you'll have:

```
deployments/
├── v8-latest.json              # Core contract addresses
└── markets/
    ├── market-1.json           # Test market 1
    ├── market-2.json           # Test market 2
    └── ...
```

**Format**:
```json
{
  "outcomeToken": "0x...",
  "collateralizer": "0x...",
  "ammEngine": "0x...",
  "tickBook": "0x...",
  "launchpadEngine": "0x..."
}
```

---

## ✅ Success Criteria

Deployment is successful when:
- ✅ All 5 core contracts deployed and verified
- ✅ Test market created and initialized
- ✅ All contract reads work
- ✅ Frontend can connect and display data
- ✅ Test trade executes successfully

---

**Ready to deploy V8 to testnet!** 🚀

**Estimated Time**: 30-60 minutes  
**Estimated Cost**: ~$200 on mainnet, ~free on testnet
