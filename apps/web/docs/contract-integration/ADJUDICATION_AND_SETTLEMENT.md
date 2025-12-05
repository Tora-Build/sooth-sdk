# Adjudicator & Settlement Process Guide

## Overview

The Sooth Protocol uses a flexible adjudication system where different types of adjudicators (UMA, ZK proofs, oracles, attestations) can settle markets. This document explains the interfaces, roles, and complete settlement flow.

---

## 🏗️ Architecture Components

### 1. SoothAdjudicatorRegistry

**Purpose**: Registry of all available adjudicators

```solidity
struct AdjudicatorConfig {
    uint8 classId;              // Type of adjudicator (1=UMA, 2=ZK, 3=Oracle, etc.)
    address externalContract;   // External contract for verification (if any)
    bytes params;               // Configuration parameters
    bool enabled;               // Whether this adjudicator is active
}

mapping(bytes32 => AdjudicatorConfig) public adjudicatorById;
```

**Key Functions**:

- `registerAdjudicator(bytes32 id, AdjudicatorConfig cfg)` - Register new adjudicator (owner only)
- `getAdjudicator(bytes32 id)` - Get adjudicator configuration

### 2. SoothSettlement

**Purpose**: Records market results and processes PnL claims

```solidity
struct MarketResult {
    bool exists;
    bool settled;
    bytes32 adjudicatorId;      // Which adjudicator settled this
    uint64 truthTime;           // T* - when the outcome became true
    uint8 winningOutcome;       // 0 = NO, 1 = YES
}

mapping(uint256 => MarketResult) public results;
```

**Access Control**:

- **Owner**: Can store results (`storeResult`)
- **Provers**: Can store settlement roots (`storeSettlementRoot`)
- **Anyone**: Can claim their PnL (`claimSettlement`)

---

## 👥 Roles & Permissions

### Owner (Guardian)

**Who**: Protocol administrator/DAO
**Powers**:

- Register/disable adjudicators
- Store market results
- Set provers
- Emergency controls

**Functions**:

```solidity
// In SoothSettlement
function storeResult(
    uint256 marketId,
    bytes32 adjudicatorId,
    uint8 winningOutcome,
    uint64 truthTime
) external onlyOwner

function setProver(address who, bool allowed) external onlyOwner
```

### Provers

**Who**: Off-chain PnL computation engines, ZK proof generators
**Powers**:

- Submit Merkle roots for settlement batches
- Provide cryptographic proof of PnL calculations

**Functions**:

```solidity
function storeSettlementRoot(
    uint256 marketId,
    bytes32 batchId,
    bytes32 root,
    bytes calldata proofMeta
) external // requires provers[msg.sender] == true
```

### Traders/Users

**Who**: Anyone with positions in markets
**Powers**:

- Claim their PnL after settlement
- Provide Merkle proof of their position

**Functions**:

```solidity
function claimSettlement(
    uint256 marketId,
    bytes32 batchId,
    int256 pnlDelta,
    bytes32[] calldata merkleProof
) external
```

---

## 🔄 Complete Settlement Process

### Phase 1: Market Trading (Pre-Settlement)

```
┌─────────────────────────────────────────────────────────────┐
│                    MARKET IS LIVE                           │
├─────────────────────────────────────────────────────────────┤
│ 1. Traders buy/sell YES/NO shares                          │
│ 2. AMM updates prices based on trades                      │
│ 3. Positions tracked in yesBalance[trader] / noBalance[]   │
│ 4. Market awaits truth time T*                             │
└─────────────────────────────────────────────────────────────┘
```

**Example**:

```solidity
// Trader buys 100 YES shares
market.trade(0, 100); // outcomeIndex=0 (YES), deltaShares=100

// State after trade:
yesBalance[trader] = 100
ammState.qYes += 100
// Trader paid cost to vault
```

---

### Phase 2: Adjudication (Determining Outcome)

```
┌─────────────────────────────────────────────────────────────┐
│              ADJUDICATION MECHANISM                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Different adjudicator types:                               │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ UMA Oracle   │  │  ZK Proof    │  │ Attestation  │     │
│  │              │  │              │  │              │     │
│  │ - Optimistic │  │ - On-chain   │  │ - Multi-sig  │     │
│  │ - Dispute    │  │   verifier   │  │ - Threshold  │     │
│  │ - Bond       │  │ - Provable   │  │ - Trusted    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                             │
│  All produce: (winningOutcome, truthTime)                  │
└─────────────────────────────────────────────────────────────┘
```

**Adjudicator Classes**:

| Class ID | Type           | External Contract  | Description                           |
| -------- | -------------- | ------------------ | ------------------------------------- |
| 1        | UMA/Optimistic | UMA Oracle address | Optimistic oracle with dispute period |
| 2        | ZK Proof       | Verifier contract  | On-chain ZK proof verification        |
| 3        | Oracle+ZK      | Oracle + Verifier  | Hybrid approach                       |
| 4        | Attestation    | Multi-sig contract | Threshold signatures                  |

---

### Phase 3: Result Storage (Guardian Action)

```
┌─────────────────────────────────────────────────────────────┐
│              GUARDIAN STORES RESULT                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  settlement.storeResult(                                    │
│      marketId: 1,                                           │
│      adjudicatorId: keccak256("DUMMY_ADJ"),                │
│      winningOutcome: 1,  // YES won                        │
│      truthTime: 1732800000                                  │
│  )                                                          │
│                                                             │
│  ✅ Verifies adjudicator is enabled                        │
│  ✅ Marks market as settled                                │
│  ✅ Stores outcome and truth time                          │
│  ✅ Emits ResultStored event                               │
└─────────────────────────────────────────────────────────────┘
```

**Code Example**:

```typescript
// Guardian (owner) stores the adjudicated result
const tx = await settlement.storeResult(
  marketId,
  adjudicatorId,
  1, // YES won
  truthTime
);

// Event emitted:
// ResultStored(marketId=1, adjudicatorId=0x..., winningOutcome=1, truthTime=1732800000)
```

---

### Phase 4: PnL Computation (Off-chain)

```
┌─────────────────────────────────────────────────────────────┐
│           OFF-CHAIN PNL ENGINE                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  For each trader with positions:                           │
│                                                             │
│  1. Fetch all trades around T* (truth time)                │
│  2. Replay trades to compute final PnL                     │
│  3. Calculate: pnlDelta = winnings - losses                │
│                                                             │
│  Example:                                                   │
│  - Trader A: 100 YES shares, YES won                       │
│    pnlDelta = +100 * (1 - entry_price)                     │
│                                                             │
│  - Trader B: 50 NO shares, YES won                         │
│    pnlDelta = -50 * entry_price                            │
│                                                             │
│  4. Build Merkle tree of all (trader, pnlDelta) pairs      │
│  5. Compute Merkle root                                    │
└─────────────────────────────────────────────────────────────┘
```

**Merkle Tree Structure**:

```
                    Root
                   /    \
                  /      \
                 /        \
            Hash1          Hash2
           /    \         /    \
      Leaf1  Leaf2   Leaf3  Leaf4
        |      |       |      |
    (A,+50) (B,-20) (C,+30) (D,+10)

Each leaf = keccak256(abi.encodePacked(marketId, trader, pnlDelta))
```

---

### Phase 5: Settlement Root Storage (Prover Action)

```
┌─────────────────────────────────────────────────────────────┐
│           PROVER SUBMITS MERKLE ROOT                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  settlement.storeSettlementRoot(                            │
│      marketId: 1,                                           │
│      batchId: keccak256("batch_1"),                        │
│      root: 0xabc123...,  // Merkle root                    │
│      proofMeta: ""       // Optional ZK proof              │
│  )                                                          │
│                                                             │
│  ✅ Verifies msg.sender is authorized prover               │
│  ✅ Verifies market is settled                             │
│  ✅ Stores Merkle root for this batch                      │
│  ✅ Emits SettlementRootStored event                       │
└─────────────────────────────────────────────────────────────┘
```

**Code Example**:

```typescript
// Prover submits the computed Merkle root
const batchId = ethers.keccak256(ethers.toUtf8Bytes("batch_1"));
const merkleRoot = computedTree.getRoot();

await settlement.storeSettlementRoot(
  marketId,
  batchId,
  merkleRoot,
  "0x" // proofMeta (could contain ZK proof)
);
```

---

### Phase 6: User Claims (Trader Action)

```
┌─────────────────────────────────────────────────────────────┐
│              TRADERS CLAIM THEIR PNL                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  For each trader:                                           │
│                                                             │
│  1. Get their pnlDelta from off-chain engine               │
│  2. Get Merkle proof for their leaf                        │
│  3. Call claimSettlement()                                 │
│                                                             │
│  settlement.claimSettlement(                                │
│      marketId: 1,                                           │
│      batchId: keccak256("batch_1"),                        │
│      pnlDelta: 50 ether,  // Their winnings                │
│      merkleProof: [0x..., 0x..., 0x...]                    │
│  )                                                          │
│                                                             │
│  ✅ Verifies Merkle proof                                  │
│  ✅ Prevents double-claiming                               │
│  ✅ Transfers funds via vault.applySettlementDelta()       │
│  ✅ Emits Claimed event                                    │
└─────────────────────────────────────────────────────────────┘
```

**Claim Verification**:

```solidity
// 1. Reconstruct leaf
bytes32 leaf = keccak256(abi.encodePacked(marketId, msg.sender, pnlDelta));

// 2. Verify proof
require(MerkleProof.verify(merkleProof, root, leaf), "Bad proof");

// 3. Apply PnL
vault.applySettlementDelta(msg.sender, pnlDelta);
//   - If pnlDelta > 0: Vault pays trader
//   - If pnlDelta < 0: Trader pays vault
```

**Code Example**:

```typescript
// Trader claims their PnL
const pnlDelta = ethers.parseEther("50"); // Won 50 tokens
const proof = merkleTree.getProof(traderAddress);

await settlement.claimSettlement(marketId, batchId, pnlDelta, proof);

// Trader receives 50 tokens from vault
```

---

## 📊 Complete Flow Diagram

```
┌──────────────┐
│   TRADING    │
│   (Phase 1)  │
│              │
│ - Buy/Sell   │
│ - Positions  │
│   tracked    │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ ADJUDICATION │
│   (Phase 2)  │
│              │
│ - UMA/ZK/... │
│ - Determines │
│   outcome    │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────┐
│ GUARDIAN STORES RESULT (Phase 3)    │
│                                      │
│ settlement.storeResult()             │
│   ├─ marketId: 1                    │
│   ├─ adjudicatorId: 0xabc...        │
│   ├─ winningOutcome: 1 (YES)        │
│   └─ truthTime: T*                  │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ OFF-CHAIN PNL COMPUTATION (Phase 4) │
│                                      │
│ - Replay all trades around T*       │
│ - Calculate each trader's PnL       │
│ - Build Merkle tree                 │
│ - Compute root                      │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ PROVER SUBMITS ROOT (Phase 5)       │
│                                      │
│ settlement.storeSettlementRoot()     │
│   ├─ marketId: 1                    │
│   ├─ batchId: 0xdef...              │
│   ├─ root: 0x123...                 │
│   └─ proofMeta: (optional ZK)       │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ TRADERS CLAIM PNL (Phase 6)         │
│                                      │
│ settlement.claimSettlement()         │
│   ├─ marketId: 1                    │
│   ├─ batchId: 0xdef...              │
│   ├─ pnlDelta: +50 ether            │
│   └─ merkleProof: [...]             │
│                                      │
│ ✅ Vault transfers funds             │
└──────────────────────────────────────┘
```

---

## 🔐 Security Considerations

### Access Control Matrix

| Function                | Owner | Prover | Anyone |
| ----------------------- | ----- | ------ | ------ |
| `registerAdjudicator()` | ✅    | ❌     | ❌     |
| `storeResult()`         | ✅    | ❌     | ❌     |
| `setProver()`           | ✅    | ❌     | ❌     |
| `storeSettlementRoot()` | ❌    | ✅     | ❌     |
| `claimSettlement()`     | ✅    | ✅     | ✅     |

### Protection Mechanisms

1. **Double-Claim Prevention**:

   ```solidity
   mapping(bytes32 => mapping(address => bool)) public claimed;
   require(!claimed[batchId][msg.sender], "Already claimed");
   claimed[batchId][msg.sender] = true;
   ```

2. **Merkle Proof Verification**:

   ```solidity
   bytes32 leaf = keccak256(abi.encodePacked(marketId, msg.sender, pnlDelta));
   require(MerkleProof.verify(merkleProof, root, leaf), "Bad proof");
   ```

3. **Settlement Finality**:

   ```solidity
   require(!r.settled, "Already settled");
   r.settled = true; // Can only settle once
   ```

4. **Adjudicator Validation**:
   ```solidity
   (, , , bool enabled) = adjudicatorRegistry.getAdjudicator(adjudicatorId);
   require(enabled, "Adjudicator disabled");
   ```

---

## 💻 Integration Examples

### Example 1: Guardian Settling a Market

```typescript
// 1. Market has reached truth time
const marketId = 1;
const adjudicatorId = ethers.keccak256(ethers.toUtf8Bytes("DUMMY_ADJ"));
const winningOutcome = 1; // YES won
const truthTime = Math.floor(Date.now() / 1000);

// 2. Guardian stores the result
const settlement = new ethers.Contract(
  deployments.SoothSettlement,
  settlementABI,
  guardianSigner
);

await settlement.storeResult(
  marketId,
  adjudicatorId,
  winningOutcome,
  truthTime
);

console.log("Market settled: YES won");
```

### Example 2: Prover Computing and Submitting PnL

```typescript
// 1. Fetch all trades for this market
const trades = await fetchTradesFromEvents(marketId);

// 2. Compute PnL for each trader
const pnlMap = computePnL(trades, winningOutcome, truthTime);
// pnlMap = {
//   "0xTraderA": ethers.parseEther("50"),
//   "0xTraderB": ethers.parseEther("-20"),
//   ...
// }

// 3. Build Merkle tree
const leaves = Object.entries(pnlMap).map(([trader, pnl]) =>
  ethers.keccak256(
    ethers.solidityPacked(
      ["uint256", "address", "int256"],
      [marketId, trader, pnl]
    )
  )
);

const merkleTree = new MerkleTree(leaves, ethers.keccak256, {
  sortPairs: true,
});
const root = merkleTree.getRoot();

// 4. Submit root
const batchId = ethers.keccak256(ethers.toUtf8Bytes(`batch_${marketId}_1`));

await settlement.storeSettlementRoot(
  marketId,
  batchId,
  root,
  "0x" // No ZK proof in this example
);

console.log("Settlement root submitted:", root);

// 5. Distribute proofs to traders (off-chain)
for (const [trader, pnl] of Object.entries(pnlMap)) {
  const leaf = ethers.keccak256(
    ethers.solidityPacked(
      ["uint256", "address", "int256"],
      [marketId, trader, pnl]
    )
  );
  const proof = merkleTree.getProof(leaf);

  // Send to trader via API/email/IPFS
  await notifyTrader(trader, { marketId, batchId, pnl, proof });
}
```

### Example 3: Trader Claiming PnL

```typescript
// 1. Trader receives notification with their PnL and proof
const { marketId, batchId, pnl, proof } = await getClaimInfo(traderAddress);

// 2. Claim settlement
const settlement = new ethers.Contract(
  deployments.SoothSettlement,
  settlementABI,
  traderSigner
);

const tx = await settlement.claimSettlement(marketId, batchId, pnl, proof);

await tx.wait();

console.log(`Claimed ${ethers.formatEther(pnl)} tokens`);
```

---

## 🎯 Key Takeaways

1. **Flexible Adjudication**: Different adjudicator types (UMA, ZK, oracle) can be registered and used
2. **Two-Phase Settlement**:
   - Phase 1: Guardian stores outcome
   - Phase 2: Prover computes PnL and submits Merkle root
3. **Trustless Claims**: Traders prove their PnL with Merkle proofs
4. **Role Separation**: Guardian, Prover, and Trader roles are clearly defined
5. **Batch Processing**: Multiple traders can be settled in one batch with a single Merkle root

---

## 📚 Related Contracts

- **SoothSettlement**: `contracts/settlement/SoothSettlement.sol`
- **SoothAdjudicatorRegistry**: `contracts/core/SoothAdjudicatorRegistry.sol`
- **SoothMarket**: `contracts/core/SoothMarket.sol`
- **SoothVault**: `contracts/core/SoothVault.sol`

---

## 🔗 Next Steps

1. Review the settlement contract: `contracts/settlement/SoothSettlement.sol`
2. Understand Merkle proof generation: See example code above
3. Integrate with your off-chain PnL engine
4. Test the complete flow on testnet
