# Contract Interface Quick Reference

## For Dapp Developers

I've created comprehensive documentation in [`CONTRACT_INTERFACES.md`](file:///Users/danieltang/Desktop/Coding/GitHub/sooth-alpha/CONTRACT_INTERFACES.md) with everything you need to integrate with the Sooth Protocol contracts.

## What's Included

### 1. **Contract ABIs**
- Full ABIs for `SoothMarket`, `SoothVault`, and `SoothSettlement`
- Simplified JSON arrays for easy integration with ethers.js/wagmi

### 2. **View Functions** (Read-only)
- **Market Status**: `isLive()`, `isSettled()`, `ammState()`
- **User Balances**: `yesBalance()`, `noBalance()`, `balanceOfLP()`
- **Settlement Info**: `results()`, `settlementRoots()`, `claimed()`
- **Vault Stats**: `totalAssets()`, `getLiquidBufferBalance()`

### 3. **Write Functions** (Transactions)
- **Trading**: `trade(outcomeIndex, deltaShares)`
- **LP Operations**: `depositFor()`, `withdrawFor()`
- **Settlement**: `storeResult()`, `storeSettlementRoot()`, `claimSettlement()`

### 4. **Button Gating Logic**
```typescript
// Trading
const canTrade = market.isLive && !market.isSettled;

// LP Withdraw
const canWithdraw = lpBalance >= amount && 
                    vault.getLiquidBufferBalance() >= amount;

// Claims
const canClaim = settlementRoots[batchId] !== 0 && 
                 !claimed[batchId][user];
```

### 5. **Role Requirements**
- **Owner-only**: `markSettled()`, `storeResult()`, `createMarket()`
- **Prover-only**: `storeSettlementRoot()` (requires `provers[msg.sender] == true`)
- **Public**: `trade()`, `depositFor()`, `claimSettlement()`

### 6. **Integration Patterns**
Complete code examples for:
- Executing trades with price calculation
- Providing/withdrawing liquidity
- Claiming settlement with Merkle proofs

### 7. **Event Monitoring**
Key events to listen for:
- `Trade` - price updates
- `Deposit`/`Withdraw` - LP activity
- `ResultStored` - market settled
- `Claimed` - settlement claimed

### 8. **Error Handling**
Common revert reasons and how to handle them

## Key Parameters

### Settlement Functions

**`storeResult()`** - Owner uploads market outcome
- `marketId`: uint256
- `adjudicatorId`: bytes32
- `winningOutcome`: uint8 (0 = NO, 1 = YES)
- `truthTime`: uint64 (timestamp)

**`storeSettlementRoot()`** - Prover uploads PnL Merkle root
- `marketId`: uint256
- `batchId`: bytes32 (unique batch ID)
- `root`: bytes32 (Merkle root)
- `proofMeta`: bytes (optional, currently unused)

**`claimSettlement()`** - Users claim PnL
- `marketId`: uint256
- `batchId`: bytes32
- `pnlDelta`: int256 (positive = profit, negative = loss)
- `merkleProof`: bytes32[] (Merkle proof array)

### Merkle Proof Format
```solidity
bytes32 leaf = keccak256(abi.encodePacked(marketId, userAddress, pnlDelta));
```

## Quick Start

1. Load contract addresses from `deployments.json`
2. Use the ABIs in section 7 of `CONTRACT_INTERFACES.md`
3. Follow the integration patterns in section 8
4. Monitor events in section 9

See the full documentation for detailed examples and complete function signatures.
