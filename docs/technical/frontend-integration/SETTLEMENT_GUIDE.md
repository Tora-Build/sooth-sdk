# Settlement & Claims - Frontend Quick Guide

> **For detailed adjudication process**: See [ADJUDICATION_AND_SETTLEMENT.md](../ADJUDICATION_AND_SETTLEMENT.md)

## Overview for Frontend Developers

The settlement process has **two user-facing flows**:

1. **Guardian/Admin Flow**: Store market results (owner-only)
2. **Trader Flow**: Claim PnL after settlement (anyone)

---

## 🎯 What Frontend Needs to Implement

### 1. Check if Market is Settled

```typescript
const settlement = new ethers.Contract(
  deployments.SoothSettlement,
  settlementABI,
  provider
);

const result = await settlement.results(marketId);

if (result.settled) {
  console.log(
    `Market settled: ${result.winningOutcome === 1 ? "YES" : "NO"} won`
  );
  console.log(`Truth time: ${result.truthTime}`);
}
```

**UI Display**:

```tsx
{
  result.settled && (
    <div className="settlement-banner">
      <span>Market Settled</span>
      <span>{result.winningOutcome === 1 ? "YES" : "NO"} Won</span>
      <span>
        Truth Time: {new Date(result.truthTime * 1000).toLocaleString()}
      </span>
    </div>
  );
}
```

---

### 2. Check if User Can Claim

```typescript
// Check if settlement root exists
const batchId = ethers.keccak256(ethers.toUtf8Bytes(`batch_${marketId}_1`));
const root = await settlement.settlementRoots(batchId);
const hasRoot = root !== ethers.ZeroHash;

// Check if user already claimed
const hasClaimed = await settlement.claimed(batchId, userAddress);

// User can claim if: root exists AND not claimed yet
const canClaim = hasRoot && !hasClaimed;
```

**UI Button Gating**:

```tsx
<button disabled={!canClaim} onClick={handleClaim}>
  {hasClaimed ? "Already Claimed" : "Claim Settlement"}
</button>
```

---

### 3. Fetch User's PnL and Proof (Off-chain API)

```typescript
// Call your backend API to get claim data
const claimData = await fetch(
  `/api/settlement/${marketId}/${userAddress}`
).then((res) => res.json());

// Response format:
// {
//   pnlDelta: "50000000000000000000",  // 50 tokens in wei
//   merkleProof: ["0xabc...", "0xdef...", "0x123..."],
//   batchId: "0x456..."
// }
```

**Backend Requirements**:

- Compute PnL for all traders
- Build Merkle tree
- Store proofs for each user
- Provide API endpoint for users to fetch their proof

---

### 4. Execute Claim Transaction

```typescript
async function claimSettlement(marketId: number, userAddress: string) {
  // 1. Fetch claim data from API
  const { pnlDelta, merkleProof, batchId } = await fetchClaimData(
    marketId,
    userAddress
  );

  // 2. Execute claim
  const settlement = new ethers.Contract(
    deployments.SoothSettlement,
    settlementABI,
    signer
  );

  const tx = await settlement.claimSettlement(
    marketId,
    batchId,
    pnlDelta,
    merkleProof
  );

  await tx.wait();

  // 3. Show success message
  const amount = ethers.formatEther(pnlDelta);
  toast.success(`Claimed ${amount} tokens!`);
}
```

---

## 📋 Complete Claim Flow (User Perspective)

```
┌────────────────────────────────────────────────────┐
│ 1. User checks if market is settled                │
│    → settlement.results(marketId)                  │
└────────────────┬───────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────┐
│ 2. Check if settlement root is available           │
│    → settlement.settlementRoots(batchId)           │
│    → If root === 0x00, show "Processing..."        │
└────────────────┬───────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────┐
│ 3. Check if user already claimed                   │
│    → settlement.claimed(batchId, userAddress)      │
│    → If true, show "Already Claimed"               │
└────────────────┬───────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────┐
│ 4. Fetch user's PnL and proof from API             │
│    → GET /api/settlement/{marketId}/{userAddress}  │
└────────────────┬───────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────┐
│ 5. Display claim amount to user                    │
│    → "You can claim: +50 tokens" or "-20 tokens"   │
└────────────────┬───────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────┐
│ 6. User clicks "Claim Settlement"                  │
│    → settlement.claimSettlement(...)               │
└────────────────┬───────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────┐
│ 7. Transaction confirmed                           │
│    → Funds transferred to/from user                │
│    → Show success message                          │
└────────────────────────────────────────────────────┘
```

---

## 🎨 UI Components Needed

### Settlement Status Badge

```tsx
function SettlementStatus({ marketId }: { marketId: number }) {
  const { data: result } = useSettlementResult(marketId);

  if (!result?.settled) {
    return <Badge variant="active">Trading</Badge>;
  }

  return (
    <Badge variant="settled">
      Settled: {result.winningOutcome === 1 ? "YES" : "NO"} Won
    </Badge>
  );
}
```

### Claim Button

```tsx
function ClaimButton({ marketId, userAddress }: Props) {
  const { data: result } = useSettlementResult(marketId);
  const { data: claimStatus } = useClaimStatus(marketId, userAddress);
  const { mutate: claim, isPending } = useClaimSettlement();

  if (!result?.settled) return null;
  if (!claimStatus?.hasRoot) return <span>Processing settlement...</span>;
  if (claimStatus?.hasClaimed) return <span>✓ Claimed</span>;

  return (
    <button
      onClick={() => claim({ marketId, userAddress })}
      disabled={isPending}
    >
      {isPending ? "Claiming..." : `Claim ${claimStatus.pnlDelta} tokens`}
    </button>
  );
}
```

---

## 🔗 React Hooks Examples

### useSettlementResult

```typescript
function useSettlementResult(marketId: number) {
  const settlement = useContract(deployments.SoothSettlement, settlementABI);

  return useQuery({
    queryKey: ["settlement", "result", marketId],
    queryFn: async () => {
      const result = await settlement.results(marketId);
      return {
        exists: result.exists,
        settled: result.settled,
        adjudicatorId: result.adjudicatorId,
        truthTime: Number(result.truthTime),
        winningOutcome: result.winningOutcome,
      };
    },
  });
}
```

### useClaimStatus

```typescript
function useClaimStatus(marketId: number, userAddress: string) {
  const settlement = useContract(deployments.SoothSettlement, settlementABI);

  return useQuery({
    queryKey: ["settlement", "claim-status", marketId, userAddress],
    queryFn: async () => {
      const batchId = ethers.keccak256(
        ethers.toUtf8Bytes(`batch_${marketId}_1`)
      );
      const root = await settlement.settlementRoots(batchId);
      const hasClaimed = await settlement.claimed(batchId, userAddress);

      // Fetch PnL from API if not claimed
      let pnlDelta = null;
      if (root !== ethers.ZeroHash && !hasClaimed) {
        const data = await fetch(
          `/api/settlement/${marketId}/${userAddress}`
        ).then((res) => res.json());
        pnlDelta = data.pnlDelta;
      }

      return {
        hasRoot: root !== ethers.ZeroHash,
        hasClaimed,
        pnlDelta: pnlDelta ? ethers.formatEther(pnlDelta) : null,
      };
    },
    enabled: !!userAddress,
  });
}
```

### useClaimSettlement

```typescript
function useClaimSettlement() {
  const settlement = useContract(
    deployments.SoothSettlement,
    settlementABI,
    true
  );
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      marketId,
      userAddress,
    }: {
      marketId: number;
      userAddress: string;
    }) => {
      // Fetch claim data
      const { pnlDelta, merkleProof, batchId } = await fetch(
        `/api/settlement/${marketId}/${userAddress}`
      ).then((res) => res.json());

      // Execute claim
      const tx = await settlement.claimSettlement(
        marketId,
        batchId,
        pnlDelta,
        merkleProof
      );

      return tx.wait();
    },
    onSuccess: (_, { marketId, userAddress }) => {
      // Invalidate queries
      queryClient.invalidateQueries({
        queryKey: ["settlement", "claim-status", marketId, userAddress],
      });
    },
  });
}
```

---

## 📊 Event Monitoring

### Listen for Settlement Events

```typescript
// Listen for market settlements
settlement.on(
  "ResultStored",
  (marketId, adjudicatorId, winningOutcome, truthTime) => {
    console.log(
      `Market ${marketId} settled: ${winningOutcome === 1 ? "YES" : "NO"} won`
    );
    // Refresh UI
    queryClient.invalidateQueries({
      queryKey: ["settlement", "result", marketId],
    });
  }
);

// Listen for settlement roots
settlement.on("SettlementRootStored", (marketId, batchId, root) => {
  console.log(`Settlement root available for market ${marketId}`);
  // Enable claim buttons
  queryClient.invalidateQueries({
    queryKey: ["settlement", "claim-status", marketId],
  });
});

// Listen for claims
settlement.on("Claimed", (marketId, batchId, account, pnlDelta) => {
  if (account === userAddress) {
    toast.success(`Claimed ${ethers.formatEther(pnlDelta)} tokens!`);
  }
});
```

---

## ⚠️ Important Notes for Frontend

1. **Batch IDs**: The batchId format is determined by your backend. Common pattern:

   ```typescript
   const batchId = ethers.keccak256(ethers.toUtf8Bytes(`batch_${marketId}_1`));
   ```

2. **Negative PnL**: Users can have negative PnL (losses). Handle this in UI:

   ```tsx
   const pnlClass = pnlDelta >= 0 ? "profit" : "loss";
   const pnlSign = pnlDelta >= 0 ? "+" : "";
   <span className={pnlClass}>
     {pnlSign}
     {ethers.formatEther(pnlDelta)}
   </span>;
   ```

3. **Gas Costs**: Claiming requires a transaction. Inform users about gas costs.

4. **Proof Availability**: Settlement roots are uploaded by provers (off-chain). There may be a delay between market settlement and proof availability.

5. **Multiple Batches**: A market can have multiple settlement batches. Your UI should handle this if your system uses batch processing.

---

## 🔗 Related Documentation

- **Detailed Process**: [../ADJUDICATION_AND_SETTLEMENT.md](../ADJUDICATION_AND_SETTLEMENT.md)
- **Contract Interfaces**: [CONTRACT_INTERFACES.md](./CONTRACT_INTERFACES.md#3-soothsettlement---settlement--claims-contract)
- **ABIs**: See `CONTRACT_INTERFACES.md` Section 7

---

## 📝 Checklist for Frontend Integration

- [ ] Implement `useSettlementResult` hook
- [ ] Implement `useClaimStatus` hook
- [ ] Implement `useClaimSettlement` mutation
- [ ] Create Settlement Status Badge component
- [ ] Create Claim Button component
- [ ] Set up event listeners for settlement events
- [ ] Build API endpoint to fetch user's PnL and proof
- [ ] Handle negative PnL display
- [ ] Add loading states for claim processing
- [ ] Add error handling for failed claims
- [ ] Test with both positive and negative PnL scenarios
