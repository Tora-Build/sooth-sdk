# V4 Frontend Integration - Complete Guide

## Core Architecture
Sooth V4 uses a **Dual-Venue Hybrid Architecture**:

1.  **Orderbook (CLOB):** Integer shares (1 = 1 share). Peer-to-peer.
2.  **AMM (Continuous LMSR):** Fractional shares (1e18 = 1 share). Always available liquidity.

---

## 1. Key Interactions

### Orderbook: Place Limit Order (Custodial)
**Granularity:** WAD (`decimals=18`).
**Cost:** `price (WAD) * amount (WAD)`.
**Output:** Updates internal `shareBalances` (No immediate ERC1155 mint).

```typescript
// Buy 100 YES shares at 0.60 USDC
await writeContract({
  address: TRADER_VAULT,
  abi: SoothTraderVaultABI,
  functionName: 'placeOrder',
  args: [
    MARKET_ADDRESS,
    0, // outcome (0=YES, 1=NO)
    parseUnits('0.60', 18), // Price (WAD)
    parseUnits('100', 18),  // Amount (WAD) - 100 shares
    true                    // isBuy
  ]
})

### Orderbook: Deposit/Withdraw Shares
To move assets between Wallet (ERC1155) and Vault (Internal Ledger):

```typescript
// Deposit 50 YES Shares to Vault
await writeContract({
  address: TRADER_VAULT,
  abi: SoothTraderVaultABI,
  functionName: 'depositShares',
  args: [MARKET_ADDRESS, 0, parseUnits('50', 18)]
})

// Withdraw 20 YES Shares to Wallet
await writeContract({
  address: TRADER_VAULT,
  abi: SoothTraderVaultABI,
  functionName: 'withdrawShares',
  args: [MARKET_ADDRESS, 0, parseUnits('20', 18)]
})
```
```

### AMM: Instant Trade
**Granularity:** WAD (`decimals=18`).
**Cost:** Calculated by LMSR curve.

```typescript
// Buy 10.5 YES shares from AMM
await writeContract({
  address: TRADER_VAULT,
  abi: SoothTraderVaultABI,
  functionName: 'tradeAMM', // Renamed from executeAMMTrade in interface ISoothTraderVaultV4
  args: [
    MARKET_ADDRESS,
    0, // outcome (0=YES)
    parseUnits('10.5', 18), // Delta Shares (WAD)
    parseUnits('7.0', 18)   // Max Cost (WAD)
  ]
})
```

---

## 2. Fetching Market Data

### Price & Probability
The AMM determines the "Market Price".

```typescript
// Get Price of YES (0)
const priceWad = await readContract({
  address: MARKET_ADDRESS,
  abi: SoothMarketABI,
  functionName: 'price',
  args: [0] // 0=YES
})

const prob = formatUnits(priceWad, 18) // e.g. "0.50"
```

### User Balances
Users can have two types of positions:

1.  **Internal Shares (Orderbook)**:
    *New in V4*: Orderbook trades settle to this internal ledger.
    ```typescript
    const shares = await readContract({
      address: TRADER_VAULT,
      abi: SoothTraderVaultABI,
      functionName: 'shareBalances',
      args: [user, MARKET_ADDRESS, 0] // 0=YES
    })
    // Returns WAD (e.g. 100.0 * 1e18)
    ```

2.  **Wallet Tokens (ERC1155)**:
    Tokens withdrawn from Vault or minted directly.
    ```typescript
    // Check YES tokens (ID=0)
    const balance = await readContract({
      address: OUTCOME_TOKEN,
      abi: OutcomeTokenABI,
      functionName: 'balanceOf',
      args: [user, 0]
    })
    // Returns WAD (e.g. 100.0 * 1e18) [Updated granularity]
    ```

### AMM Positions (Internal)
```typescript
const pos = await readContract({
  address: TRADER_VAULT,
  abi: SoothTraderVaultABI,
  functionName: 'ammPositions',
  args: [user, MARKET_ADDRESS]
})
// Returns { yesShares: WAD, noShares: WAD, ... }
```

---

## 3. ABIs & Addresses

Contracts are deployed to Base Sepolia.
New ABIs are located in `src/config/abis/`:
- `SoothTraderVault.json` (Points to V4)
- `SoothMarket.json` (Points to V4)
- `OutcomeToken.json`

**Infrastructure (Base Sepolia):**
- USDC: `0xd2C6903C7311C7EC6F2f09DA7A0d417A59CB04ab`
- GovernorVault: `0x0C96BcCa40f5D45D0a000C91276E3b5ac3A45e6f`
- TraderVaultV4: `0xee91e05f95cBaACD46f58432DF72CB5C451e98E0`  
- FeeController: `0xa367B312Ca1845B7c6076345cB5cd529F935B4FA`

**Active Markets:**
- Market 1: `0xf17f4863aeeecdd5db8d0eb2a81a5435987267db` (UN Confirms Alien Life)
- Market 2: `0xb6cfef7a8128eb236362c4f60a9b4f0aa7784ef7` (BTC 7-day TWAP >= $100k)

---

## Core Concepts

### Dual-Venue Trading

V4 supports **two trading venues** with different mechanics:

| Feature | AMM | Orderbook |
|---------|-----|-----------|
| **Trading** | Instant execution | Limit orders |
| **Asset** | Internal Position | Internal Share (Claimable as ERC1155) |
| **Lock on Buy** | ✅ 24h lock | ❌ No Time-Lock |
| **Sell** | Instant USDC (after unlock) | Instant USDC (Spot Sell) |
| **Gas** | Lower | Low (Custodial Ledger) |

### AMM (Lock-on-Buy)

**Buy Flow:**
1. User deposits USDC to TraderVault
2. Executes AMM buy → internal position locked for 24h
3. Cannot sell until unlock time

**Sell Flow (after unlock):**
1. Execute AMM sell → instant USDC to account

### Orderbook (Custodial)

**Buy Flow:**
1. Deposit USDC
2. Place limit order → Internal `shareBalances` credited
3. (Optional) Withdraw to Wallet (ERC1155)

**Sell Flow:**
1. (If needed) Deposit ERC1155 to Vault
2. Place Spot Sell order (uses internal shares) → instant USDC

---

## Key Functions

### 1. Deposit USDC

```typescript
import { parseUnits } from 'viem'

// Approve USDC
await writeContract({
  address: USDC_ADDRESS,
  abi: ERC20_ABI,
  functionName: 'approve',
  args: [TRADER_VAULT, parseUnits('100', 18)]
})

// Deposit
await writeContract({
  address: TRADER_VAULT,
  abi: TraderVaultABI,
  functionName: 'deposit',
  args: [parseUnits('100', 18)]
})
```

### 2. AMM Trade

```typescript
// Buy YES shares via AMM (will be locked)
await writeContract({
  address: TRADER_VAULT,
  abi: TraderVaultABI,
  functionName: 'executeAMMTrade',
  args: [
    MARKET_ADDRESS,
    1, // outcome (0=NO, 1=YES)
    parseUnits('10', 18), // shares
    parseUnits('15', 18), // maxCost (with slippage)
    true // isBuy
  ]
})

// Sell YES shares (after unlock)
await writeContract({
  address: TRADER_VAULT,
  abi: TraderVaultABI,
  functionName: 'executeAMMTrade',
  args: [
    MARKET_ADDRESS,
    1, // outcome
    parseUnits('10', 18), // shares
    parseUnits('5', 18), // minProceeds (with slippage)
    false // isBuy
  ]
})
```

### 3. Orderbook Trade

```typescript
// Place buy limit order (gets ERC1155 immediately)
await writeContract({
  address: TRADER_VAULT,
  abi: TraderVaultABI,
  functionName: 'placeOrder',
  args: [
    MARKET_ADDRESS,
    1, // outcome
    parseUnits('0.6', 18), // price (60%)
    parseUnits('100', 18) // amount
  ]
})

/\/ Cancel order (get USDC back)
await writeContract({
  address: TRADER_VAULT,
  abi: TraderVaultABI,
  functionName: 'cancelOrder',
  args: [MARKET_ADDRESS, ORDER_ID]
})
```

### 4. Check Balances

```typescript
// USDC balance in TraderVault
const balance = await readContract({
  address: TRADER_VAULT,
  abi: TraderVaultABI,
  functionName: 'accounts',
  args: [userAddress]
})
// Returns: { available, pending }

// AMM position (locked shares)
const position = await readContract({
  address: TRADER_VAULT,
  abi: TraderVaultABI,
  functionName: 'ammPositions',
  args: [userAddress, MARKET_ADDRESS]
})
// Returns: { yesShares, noShares, unlockTime }

// ERC1155 orderbook tokens
const tokenBalance = await readContract({
  address: OUTCOME_TOKEN_ADDRESS,
  abi: OutcomeTokenABI,
  functionName: 'balanceOf',
  args: [userAddress, tokenId] // tokenId = outcomeId (0 or 1)
})
```

### 5. Market Data

```typescript
// Current tick and probability
const tick = await readContract({
  address: MARKET_ADDRESS,
  abi: MarketABI,
  functionName: 'currentTick'
})

// Probability = tick / 1000
const probability = tick / 1000 // e.g., 500 → 0.5 (50%)

// Effective liquidity
const b = await readContract({
  address: MARKET_ADDRESS,
  abi: MarketABI,
  functionName: 'b'
})

// Trade cost estimation
const cost = await readContract({
  address: MARKET_ADDRESS,
  abi: MarketABI,
  functionName: 'calculateAMMTradeCost',
  args: [1, parseUnits('10', 18), true] // outcome, shares, isBuy
})
```

---

## UI Recommendations

### Display AMM Lock Status

```tsx
function AMMPosition({ position }) {
  const isLocked = Date.now() / 1000 < position.unlockTime
  const timeRemaining = position.unlockTime - Date.now() / 1000
  
  return (
    <div>
      <p>YES Shares: {formatUnits(position.yesShares, 18)}</p>
      <p>NO Shares: {formatUnits(position.noShares, 18)}</p>
      {isLocked ? (
        <Badge>Locked ({formatTime(timeRemaining)} remaining)</Badge>
      ) : (
        <Button>Sell Now</Button>
      )}
    </div>
  )
}
```

### Short Selling & Hybrid Sell UI

The Protocol treats all Limit Sell orders as "Virtual Shorts" requesting to buy the opposite outcome.
- **Collateral:** Always requires `(1 - Price) * Amount` in USDC.
- **Hybrid Sell (User Owns Shares):** Current UI implementation **does not lock local shares**. Users engaging in "Hybrid Sell" (selling owned shares via limit order) must also provide USDC collateral.
- **Recommendation:** Clearly label this "Collateral" requirement in the Sell UI to avoid user confusion.

### Show Venue Comparison

```tsx
<VenueSelector>
  <Option value="amm">
    <h3>AMM</h3>
    <ul>
      <li>✅ Instant execution</li>
      <li>⏳ 24h lock on buy</li>
      <li>💰 Lower gas</li>
    </ul>
  </Option>
  <Option value="orderbook">
    <h3>Orderbook</h3>
    <ul>
      <li>📊 Set your price</li>
      <li>🔓 No locks</li>
      <li>🎫 Get ERC1155 tokens</li>
    </ul>
  </Option>
</VenueSelector>
```

---

## Important Notes

1. **Slippage:** Always add 1-5% slippage buffer for AMM trades
2. **Gas:** Orderbook trades cost more gas (ERC1155 mints)
3. **Locks:** AMM positions locked 24h, show clear UI warnings
4. **Probability:** Display as `tick / 1000 × 100%`
5. **Liquidity:** Larger `b` = cheaper trades (less slippage)

---

## ABIs Location

All ABIs in `out/<ContractName>.sol/<ContractName>.json`:
- `SoothTraderVaultV4.json`
- `SoothMarketV4.json`
- `OutcomeToken.json`
- `SoothGovernorVault.json`

---

## Testing on Sepolia

1. **Get testnet ETH** from Base Sepolia faucet
2. **Mint USDC:**
   ```bash
   cast send $USDC "mint(address,uint256)" $YOUR_ADDRESS 1000000000000000000000 \
     --rpc-url https://sepolia.base.org --private-key $PK
   ```
3. **Trade on markets** listed above

---

## Migration from V3

V3 used single venue with time-locks on sells. V4 changes:
- ✅ AMM sells are now instant (after initial 24h buy lock)
- ✅ Orderbook added as second venue (no locks)
- ✅ Separate OutcomeToken per market
- ✅ Dynamic liquidity based on market performance

See `Archive/v2-v3/` for old docs.
