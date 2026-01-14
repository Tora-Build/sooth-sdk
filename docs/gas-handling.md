# Gas Handling Across Chains

This document summarizes gas model differences across supported testnets and the CLI/frontend gas handling strategies.

## Chain Gas Models

| Chain | Gas Model | `eth_estimateGas` | Key Differences |
|-------|-----------|-------------------|-----------------|
| **Base Sepolia** | Standard EVM | ✅ Accurate | None - standard Ethereum gas model |
| **Arc Testnet** | Standard EVM | ✅ Accurate | Uses USDC as native gas token (6 decimals) |
| **Monad Testnet** | Modified EVM | ✅ Accurate | Charges `gas_limit`, not `gas_used`; higher cold storage costs |
| **MegaETH Testnet** | Multidimensional | ❌ Underestimates | Separate compute gas + storage gas; tools miss storage gas |

---

## Monad Testnet

### Key Differences from Ethereum

1. **Charges `gas_limit`, not `gas_used`**
   - User pays for the full gas limit set in the transaction
   - Overly high gas limits = overpaying
   - Tight estimation is important to minimize costs

2. **Higher Cold Storage Costs**
   - Account access: 10,100 gas (vs Ethereum 2,600)
   - Storage access: 8,100 gas (vs Ethereum 2,100)

3. **Higher Precompile Costs**
   - `ecRecover`: 2x Ethereum
   - `ecMul`: 5x Ethereum
   - `ecPairing`: 5x Ethereum

### Best Practices for Monad

- Use `eth_estimateGas` with minimal buffer (1.2x)
- Avoid hardcoded high gas limits (wastes money)
- Set gas limit explicitly for known-cost operations

### References
- [Monad Gas Pricing](https://docs.monad.xyz/developer-essentials/gas-pricing)
- [Monad Opcode Pricing](https://docs.monad.xyz/developer-essentials/opcode-pricing)

---

## MegaETH Testnet

### Key Differences from Ethereum

1. **Multidimensional Gas Model**
   - **Compute gas**: Same as Ethereum EVM
   - **Storage gas**: Additional costs for persistent data operations
   - Total gas = compute gas + storage gas

2. **Storage Gas Costs**
   | Operation | Storage Gas Cost |
   |-----------|-----------------|
   | Intrinsic (per tx) | 39,000 |
   | Contract creation | 32,000 × (bucket_multiplier - 1) |
   | Code deposit | **10,000 per byte** |
   | Zero-to-nonzero SSTORE | 20,000 × (bucket_multiplier - 1) |
   | LOG topic | 3,750 per topic |

3. **Resource Limits**
   | Resource | Per-TX Limit | Per-Block Limit |
   |----------|--------------|-----------------|
   | Compute Gas | 200M | N/A |
   | State Growth | 1,000 | 1,000 |
   | KV Updates | 500,000 | 500,000 |
   | Data Size | 12.5 MB | 12.5 MB |

### Why Standard Tools Fail

Standard tools (viem, ethers, Foundry) only estimate **compute gas**. They miss **storage gas** entirely.

**Example: Graduation Transaction**
- Deploys 2 OutcomeToken contracts (~4.4KB bytecode)
- Code deposit: 4,400 bytes × 10,000 gas/byte = **44,000,000 storage gas**
- Compute gas: ~3-5M
- Total needed: **~47-50M gas**
- Standard estimate: ~5M (fails!)

### MegaETH Gas Limits in CLI

| Trade Type | Gas Limit | Reason |
|------------|-----------|--------|
| Normal trades | 30M | Safe buffer for storage gas |
| Graduation trades | 60M | Contract deployment = high storage gas |

### Best Practices for MegaETH

1. **Use hardcoded high gas limits** - estimation doesn't work
2. **Skip simulation** - viem's `simulateContract` fails with garbage errors
3. **Use raw `sendTransaction`** - bypass viem's contract abstraction
4. **Add delays between transactions** - 10ms mini-blocks can cause state race conditions
5. **Expect garbage revert data** - RPC often returns corrupted error selectors

### References
- [MegaETH Gas Model](https://docs.megaeth.com/megaevm)
- [MegaETH Testnet](https://docs.megaeth.com/testnet)

---

## CLI Gas Configuration

### Graduate Command (`commands/market.ts`)

```typescript
// Default gas limits
let gasLimit = 10_000_000n;  // Normal trades

if (isMegaETH) {
  gasLimit = 60_000_000n;    // MegaETH graduation
} else if (currentPercent > 9000n) {
  gasLimit = 30_000_000n;    // Near graduation threshold
}
```

### Simulate Command (`commands/market.ts`)

Uses dynamic gas estimation:

```typescript
const estimateGas = async (functionName, args) => {
  const MIN_GAS = 500_000n;
  const MAX_GAS = 30_000_000n;
  const GAS_BUFFER_PERCENT = 120n;  // 1.2x buffer

  const estimated = await publicClient.estimateContractGas({...});
  const withBuffer = (estimated * GAS_BUFFER_PERCENT) / 100n;
  
  return clamp(withBuffer, MIN_GAS, MAX_GAS);
};
```

---

## Frontend Gas Configuration

### SimpleTradingPanel.tsx

```typescript
const isMegaETH = chainId === 6343;
const gasLimit = quote.willGraduate 
  ? (isMegaETH ? 60000000n : 5000000n)   // Graduation
  : (isMegaETH ? 30000000n : 2000000n);  // Normal
```

---

## Troubleshooting

### "Transaction reverted" with garbage hex data on MegaETH

**Cause**: MegaETH RPC returns corrupted revert data instead of proper error selectors.

**Solution**: 
- Increase gas limit (likely hitting storage gas limits)
- Use `sendTransaction` instead of `writeContract`
- Add retry logic with delays

### Transactions succeeding but overpaying on Monad

**Cause**: Monad charges `gas_limit`, not `gas_used`.

**Solution**:
- Use `eth_estimateGas` with tight buffer (1.2x)
- Don't use hardcoded high limits

### Market orders using 10M+ gas

**Expected behavior**: Market orders sweep the entire orderbook (tick 1-999), crossing many orders. This is gas-intensive by design.

---

## Chain IDs Reference

| Chain | ID |
|-------|-----|
| Base Sepolia | 84532 |
| Monad Testnet | 10143 |
| Arc Testnet | 5042002 |
| MegaETH Testnet | 6343 |

---

*Last updated: 2026-01-14*
