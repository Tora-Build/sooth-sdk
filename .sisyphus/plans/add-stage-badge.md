# Add Stage Badge, Fee→LP Hint, and LP Portfolio Display to Sooth Lite

## TL;DR

> **Quick Summary**: Add market stage badge to FeedCard, a gentle reminder in TradeModal about the fee→LP mechanism, and show LP token positions in the Portfolio page.
> 
> **Deliverables**:
> - Stage badge pill on FeedCard
> - Fee→LP explainer hint in TradeModal (bonding markets only)
> - LP token balance display in Portfolio positions
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 1, 2 can parallel → Task 3 depends on data changes

---

## Context

### Original Request
User wants:
1. Bonding / graduated status shown on FeedCard
2. Gentle reminder about the fee → LP token mechanism
3. LP token positions shown in Portfolio

### Data Already Available
- `Market.stage` field exists: `'bonding' | 'live' | 'settled' | 'finalized' | 'dismissed'`
- `useMarkets.ts` already reads `markets()` mapping which returns `lpToken` (index 1) and `totalLPSupply` (index 6) — currently `lpToken` is skipped in destructuring
- `usePositions.ts` currently only reads AMM share positions (`getPosition`), not LP token balances
- LP token is a standard ERC20, so reading balance is just `balanceOf(user)` on the lpToken address

### How Fee → LP Works
- During **bonding** phase: every trade's fee is partially converted to LP tokens for the trader
- After **graduation**: LP holders earn from trading fees proportionally
- LP tokens are standard ERC20 — `balanceOf` on the lpToken address from `markets()` mapping

### Key Contract Data
From `LaunchpadEngine.markets(marketAddress)` returns tuple:
```
[0] creator (Address)
[1] lpToken (Address)        ← need this for balanceOf
[2] bBase (bigint)
[3] bCurrent (bigint)
[4] creatorDeposit (bigint)
[5] feesAccrued (bigint)
[6] totalLPSupply (bigint)   ← already stored on Market type
[7] lpYieldPool (bigint)
[8] isGraduated (boolean)
[9] createdAt (bigint)
[10] graduatedAt (bigint)
```

---

## Work Objectives

### Must Have
- Stage badge on each FeedCard
- Gentle one-liner in TradeModal for bonding markets explaining fee→LP
- LP balance shown per position in Portfolio (if user has LP tokens)

### Must NOT Have
- No complex graduation progress bar
- No LP redemption/claim UI (just display)
- No new pages or modals

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: Stage badge on FeedCard (no deps)
└── Task 2: Fee→LP hint in TradeModal (no deps)

Wave 2 (After Wave 1):
└── Task 3: LP balance in Portfolio (data layer + UI changes)
```

---

## TODOs

- [ ] 1. Add stage badge to FeedCard

  **What to do**:
  - In `apps/lite/src/components/FeedCard.tsx`
  - Add a small pill badge showing `market.stage`
  - Place it in the `bottom-52` absolute div, as the first element before the Odds/Pool/Ends stats row
  - Use this config:

  ```tsx
  const STAGE_CONFIG = {
    bonding: { label: 'Bonding', bg: 'bg-[#00d4aa]/10', text: 'text-[#00d4aa]', border: 'border-[#00d4aa]/30' },
    live: { label: 'Graduated', bg: 'bg-[#00d4aa]/20', text: 'text-[#00d4aa]', border: 'border-[#00d4aa]/40' },
    settled: { label: 'Settled', bg: 'bg-[#ffd700]/10', text: 'text-[#ffd700]', border: 'border-[#ffd700]/30' },
    finalized: { label: 'Finalized', bg: 'bg-[#00d4aa]/20', text: 'text-[#00d4aa]', border: 'border-[#00d4aa]/40' },
    dismissed: { label: 'Dismissed', bg: 'bg-[#e01b24]/10', text: 'text-[#e01b24]', border: 'border-[#e01b24]/30' },
  } as const;
  ```

  - Render as:
  ```tsx
  const stageInfo = STAGE_CONFIG[market.stage];
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${stageInfo.bg} ${stageInfo.text} ${stageInfo.border}`}>
    {stageInfo.label}
  </span>
  ```

  **Must NOT do**:
  - No new icon imports
  - No hook or data layer changes

  **References**:
  - `apps/lite/src/components/FeedCard.tsx` — Badge goes inside `<div className="absolute bottom-52 ...">` before the stats flex row
  - `apps/lite/src/hooks/useMarkets.ts:11` — Market type with stage field

  **Acceptance Criteria**:
  - [ ] Badge visible on each FeedCard showing current stage
  - [ ] Colors match Moltbook palette
  - [ ] `npm run build` in `apps/lite` passes

  **Commit**: YES (group with Task 2)
  - Message: `feat(lite): add market stage badge and fee-LP hint`
  - Files: `apps/lite/src/components/FeedCard.tsx`, `apps/lite/src/components/TradeModal.tsx`

---

- [ ] 2. Add fee → LP mechanism hint in TradeModal

  **What to do**:
  - In `apps/lite/src/components/TradeModal.tsx`
  - TradeModal receives `market` prop which has `market.stage`
  - When `market.stage === 'bonding'`, show a gentle one-liner below the Order Summary (before "View Contract" link, around line 281)
  - Implementation:

  ```tsx
  {market.stage === 'bonding' && (
    <p className="text-[10px] text-[#00d4aa]/70 text-center leading-relaxed">
      Trading fees earn you LP tokens during bonding. After graduation, LP holders earn from fees.
    </p>
  )}
  ```

  - Keep it subtle — small text, muted color, max two lines
  - Do NOT show for graduated/settled/finalized/dismissed markets

  **Must NOT do**:
  - No modal or tooltip — just inline text
  - No new state or hooks

  **References**:
  - `apps/lite/src/components/TradeModal.tsx:279-288` — Insert between error block and "View Contract" link
  - `apps/web/src/components/features/LPHolders.tsx:16` — Reference text: "In bonding mode, every trade you make earns you LP tokens as a reward."

  **Acceptance Criteria**:
  - [ ] Hint visible in TradeModal only when market.stage === 'bonding'
  - [ ] Hint NOT visible for other stages
  - [ ] `npm run build` in `apps/lite` passes

  **Commit**: YES (grouped with Task 1)

---

- [ ] 3. Show LP token balance in Portfolio positions

  **What to do**:

  **Step A: Extend Market type to include lpToken address**
  - In `apps/lite/src/hooks/useMarkets.ts`
  - Add `lpToken?: Address` to the `Market` interface (line 11-18)
  - In `fetchMarketsFromRPC()` line 139, change destructuring from:
    `const [, , , , , , , , isGraduated, createdAt] = marketsMapping;`
    to:
    `const [, lpToken, , , , , , , isGraduated, createdAt] = marketsMapping;`
  - Add `lpToken: lpToken as Address` to the market object (~line 200)
  - In `fetchMarketsFromIndexer()`, set `lpToken: undefined` (indexer doesn't return it)

  **Step B: Fetch LP balance in usePositions**
  - In `apps/lite/src/hooks/usePositions.ts`
  - Add `lpBalance: bigint` to `Position` interface
  - After reading AMM shares, read LP balance if `market.lpToken` exists and is not zero address:
    ```typescript
    let lpBalance = 0n;
    if (market.lpToken && market.lpToken !== '0x0000000000000000000000000000000000000000') {
      try {
        lpBalance = await client.readContract({
          address: market.lpToken,
          abi: [{ name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }],
          functionName: 'balanceOf',
          args: [userAddress],
        }) as bigint;
      } catch {}
    }
    ```
  - Include positions with LP tokens even if shares are 0:
    `if (yesShares > 0n || noShares > 0n || lpBalance > 0n)`
  - Add `lpBalance` to position object

  **Step C: Display LP balance in Portfolio PositionCard**
  - In `apps/lite/src/pages/Portfolio.tsx`, in `PositionCard` component
  - After YES/NO shares display, add LP if > 0:
    ```tsx
    {position.lpBalance > 0n && (
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-[#ffd700]" />
        <span className="text-sm text-[#ffd700] font-bold">
          {formatShares(position.lpBalance)} LP
        </span>
      </div>
    )}
    ```
  - Use gold `#ffd700` color to distinguish from YES (teal) and NO (red)

  **Must NOT do**:
  - No LP redemption/claim UI
  - No LP value estimation (just raw token count)
  - Do NOT break existing positions if lpBalance is undefined

  **References**:
  - `apps/lite/src/hooks/useMarkets.ts:116-139` — Where `markets()` tuple is destructured; lpToken at index 1
  - `apps/lite/src/hooks/usePositions.ts:36-56` — Where AMM shares are read; add LP read after
  - `apps/lite/src/pages/Portfolio.tsx:15-56` — PositionCard component
  - `apps/web/src/hooks/useLaunchpadMarketDirect.ts:112-119` — How web app reads LP balance

  **Acceptance Criteria**:
  - [ ] `Market` type has optional `lpToken` field
  - [ ] `Position` type has `lpBalance` field
  - [ ] Portfolio shows LP count in gold for positions with LP tokens
  - [ ] Positions with only LP tokens (no shares) still appear
  - [ ] Existing share-only positions still work
  - [ ] `npm run build` in `apps/lite` passes

  **Commit**: YES
  - Message: `feat(lite): show LP token balance in portfolio`
  - Files: `apps/lite/src/hooks/useMarkets.ts`, `apps/lite/src/hooks/usePositions.ts`, `apps/lite/src/pages/Portfolio.tsx`

---

## Commit Strategy

| After Tasks | Message | Files |
|-------------|---------|-------|
| 1, 2 | `feat(lite): add market stage badge and fee-LP hint` | FeedCard.tsx, TradeModal.tsx |
| 3 | `feat(lite): show LP token balance in portfolio` | useMarkets.ts, usePositions.ts, Portfolio.tsx |

---

## Success Criteria

### Final Checklist
- [ ] Each FeedCard shows a stage pill badge (Bonding/Graduated/Settled/Finalized/Dismissed)
- [ ] TradeModal shows fee→LP hint for bonding markets only
- [ ] Portfolio shows LP token balance in gold alongside YES/NO shares
- [ ] `npm run build` passes in `apps/lite`
