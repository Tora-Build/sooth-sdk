# How to Add V4 Markets (Archived)

> This document is **archived** and reflects a pre-Launchpad deployment flow (direct `SoothMarketV4` deployment, `OutcomeToken`, `adjudicatorId`).
>
> **Current flow**: create markets via `LaunchpadFactory.createMarket(...)`, which deploys a `LaunchpadMarket` + `LaunchpadOutcomeToken` and uses an **Adjudicator address** (allowlisted by `SoothAdjudicatorRegistry`).

## Option 1: Individual Deployment Scripts (Recommended)

Deploy markets one at a time using Foundry with smaller transactions:

### Step 1: Deploy Market Contracts

```solidity
// DeployContracts.s.sol
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/core/SoothMarketV4.sol";
import "../contracts/core/OutcomeToken.sol";

contract DeployContracts is Script {
    function run() external {
        vm.startBroadcast();
        
        OutcomeToken outcomeToken = new OutcomeToken();
        SoothMarketV4 market = new SoothMarketV4();
        
        console.log("Market:", address(market));
        console.log("OutcomeToken:", address(outcomeToken));
        
        vm.stopBroadcast();
    }
}
```

Run: `forge script script/DeployContracts.s.sol --broadcast --legacy`

### Step 2: Initialize Market

```solidity
// InitializeMarket.s.sol
contract InitializeMarket is Script {
    address constant MARKET = 0x...; // from Step 1
    address constant OUTCOME_TOKEN = 0x...; // from Step 1
    address constant TRADER_VAULT = 0xee91e05f95cBaACD46f58432DF72CB5C451e98E0;
    address constant GOVERNOR_VAULT = 0x0C96BcCa40f5D45D0a000C91276E3b5ac3A45e6f;
    address constant FEE_CONTROLLER = 0xa367B312Ca1845B7c6076345cB5cd529F935B4FA;
    
    function run() external {
        vm.startBroadcast();
        
        OutcomeToken(OUTCOME_TOKEN).initialize(MARKET, TRADER_VAULT);
        
        SoothMarketV4(MARKET).initialize(
            1,                      // marketId
            GOVERNOR_VAULT,
            TRADER_VAULT,
            FEE_CONTROLLER,
            OUTCOME_TOKEN,
            bytes32(0),            // adjudicatorId
            10_000 * 1e18,         // bBase
            msg.sender,            // governor
            500                    // initial tick (50%)
        );
        
        vm.stopBroadcast();
    }
}
```

### Step 3: Configure Permissions

```solidity
// ConfigurePermissions.s.sol
contract ConfigurePermissions is Script {
    address constant MARKET = 0x...;
    address constant TRADER_VAULT = 0xee91e05f95cBaACD46f58432DF72CB5C451e98E0;
    address constant GOVERNOR_VAULT = 0x0C96BcCa40f5D45D0a000C91276E3b5ac3A45e6f;
    
    function run() external {
        vm.startBroadcast();
        
        SoothTraderVaultV4(TRADER_VAULT).setMarket(MARKET, true);
        SoothGovernorVault(GOVERNOR_VAULT).setAuthorized(MARKET, true);
        
        vm.stopBroadcast();
    }
}
```

---

## Option 2: Direct Contract Calls (via Etherscan/Cast)

### Using Cast (CLI)

```bash
# 1. Deploy OutcomeToken
cast send --rpc-url $RPC_URL --private-key $PK \
  --create $(cat out/OutcomeToken.sol/OutcomeToken.json | jq -r .bytecode.object)

# 2. Deploy SoothMarketV4
cast send --rpc-url $RPC_URL --private-key $PK \
  --create $(cat out/SoothMarketV4.sol/SoothMarketV4.json | jq -r .bytecode.object)

# 3. Initialize OutcomeToken
cast send $OUTCOME_TOKEN "initialize(address,address)" $MARKET $TRADER_VAULT \
  --rpc-url $RPC_URL --private-key $PK

# 4. Initialize Market
cast send $MARKET "initialize(uint256,address,address,address,address,bytes32,uint256,address,uint16)" \
  1 $GOVERNOR_VAULT $TRADER_VAULT $FEE_CONTROLLER $OUTCOME_TOKEN \
  0x0000000000000000000000000000000000000000000000000000000000000000 \
  10000000000000000000000 $DEPLOYER 500 \
  --rpc-url $RPC_URL --private-key $PK

# 5. Set permissions
cast send $TRADER_VAULT "setMarket(address,bool)" $MARKET true \
  --rpc-url $RPC_URL --private-key $PK
  
cast send $GOVERNOR_VAULT "setAuthorized(address,bool)" $MARKET true \
  --rpc-url $RPC_URL --private-key $PK
```

---

## Option 3: Frontend Admin Interface

Create an admin page in your dApp:

```typescript
// AdminMarketCreator.tsx
import { useWalletClient, usePublicClient } from 'wagmi'
import { parseEther } from 'viem'

const TRADER_VAULT = '0xee91e05f95cBaACD46f58432DF72CB5C451e98E0'
const GOVERNOR_VAULT = '0x0C96BcCa40f5D45D0a000C91276E3b5ac3A45e6f'
const FEE_CONTROLLER = '0xa367B312Ca1845B7c6076345cB5cd529F935B4FA'

export function AdminMarketCreator() {
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  
  async function deployMarket() {
    // 1. Deploy OutcomeToken
    const outcomeTokenHash = await walletClient.deployContract({
      abi: OutcomeTokenABI,
      bytecode: OutcomeTokenBytecode as `0x${string}`,
    })
    
    const outcomeTokenReceipt = await publicClient.waitForTransactionReceipt({ 
      hash: outcomeTokenHash 
    })
    const outcomeToken = outcomeTokenReceipt.contractAddress
    
    // 2. Deploy Market
    const marketHash = await walletClient.deployContract({
      abi: SoothMarketV4ABI,
      bytecode: SoothMarketV4Bytecode as `0x${string}`,
    })
    
    const marketReceipt = await publicClient.waitForTransactionReceipt({ 
      hash: marketHash 
    })
    const market = marketReceipt.contractAddress
    
    // 3. Initialize OutcomeToken
    await walletClient.writeContract({
      address: outcomeToken,
      abi: OutcomeTokenABI,
      functionName: 'initialize',
      args: [market, TRADER_VAULT]
    })
    
    // 4. Initialize Market
    await walletClient.writeContract({
      address: market,
      abi: SoothMarketV4ABI,
      functionName: 'initialize',
      args: [
        1n, // marketId
        GOVERNOR_VAULT,
        TRADER_VAULT,
        FEE_CONTROLLER,
        outcomeToken,
        '0x0000000000000000000000000000000000000000000000000000000000000000',
        parseEther('10000'), // bBase
        walletClient.account.address, // governor
        500 // initial tick
      ]
    })
    
    // 5. Set permissions
    await walletClient.writeContract({
      address: TRADER_VAULT,
      abi: TraderVaultABI,
      functionName: 'setMarket',
      args: [market, true]
    })
    
    await walletClient.writeContract({
      address: GOVERNOR_VAULT,
      abi: GovernorVaultABI,
      functionName: 'setAuthorized',
      args: [market, true]
    })
    
    console.log('Market deployed:', market)
    console.log('OutcomeToken:', outcomeToken)
  }
  
  return <button onClick={deployMarket}>Deploy New Market</button>
}
```

---

## Market Parameters Reference

| Parameter | Type | Example | Description |
|-----------|------|---------|-------------|
| `marketId` | uint256 | `1` | Unique market identifier |
| `governorVault` | address | `0x0C96...` | GovernorVault address |
| `traderVault` | address | `0xee91...` | TraderVaultV4 address |
| `feeController` | address | `0xa367...` | FeeController address |
| `outcomeToken` | address | (deployed) | OutcomeToken for this market |
| `adjudicatorId` | bytes32 | `0x00...` | Adjudicator identifier |
| `bBase` | uint256 | `10000e18` | Base liquidity parameter |
| `governor` | address | deployer | Market governor address |
| `initialTick` | uint16 | `500` | Initial probability (500 = 50%) |

**Initial Tick Values:**
- `0` = 0% YES probability
- `250` = 25% YES
- `500` = 50% YES (neutral)
- `750` = 75% YES  
- `1000` = 100% YES

---

## Recommended Workflow

1. **Script Deployment** (Steps 1-3 above)
   - Most reliable
   - Can be version controlled
   - Easy to audit

2. **Test on Testnet First**
   - Deploy with small `bBase` (e.g., 1000e18)
   - Verify all functions work
   - Then deploy production markets

3. **Track Deployments**
   - Save addresses to `docs/_archive/v4/markets-v4.json`
   - Update frontend config
   - Document market metadata
