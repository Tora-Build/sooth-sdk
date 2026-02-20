# Lens Chain Prediction Markets — Research & Implementation Notes

*Date: 2026-02-20*

---

## 1. Lens Chain Overview

| Parameter | Mainnet | Testnet |
|-----------|---------|---------|
| Chain ID | `232` | `37111` |
| Gas Token | GHO | GRASS |
| RPC | `https://rpc.lens.xyz` | `https://rpc.testnet.lens.xyz` |
| Explorer | explorer.lens.xyz | explorer.testnet.lens.xyz |
| API | `https://api.lens.xyz/graphql` | `https://api.testnet.lens.xyz/graphql` |
| Stack | ZKsync L2 (Ethereum security) | Same |

GHO is both the gas token and the native collateral for prediction markets on Lens Chain. WGHO (Wrapped GHO) is the ERC20 version used in contracts.

---

## 2. Orb Prediction Market — Reverse Engineering

### 2.1 Overview

Orb (the Lens social app) has a live prediction market feature using Lens V3 Post Actions. It uses a **pari-mutuel** model — users enter a pool, creator resolves the outcome, and the winning pool splits the total pot.

### 2.2 Contract

| Field | Value |
|-------|-------|
| Address | `0xc610487FB21b7fF8993D2586d8fB24DFd2063d62` |
| Chain | Lens Chain Mainnet (232) |
| Source | Closed-source (not verified on explorer) |
| Token | WGHO at `0x6bDc36E20D267Ff0dd6097799f82e78907105e2F` (18 decimals) |
| Activity | ~185 transactions as of 2026-02-20 |

### 2.3 How It Works

Orb's prediction market is attached as a **Post Action** to Lens posts. When a user creates a post with "Prediction Mode" enabled in Orb:

1. **Creation**: The post metadata includes `ORB-PREDICTION` tag and an internal ID. The Post Action `configure()` is called with market parameters (outcomes, duration, min/max entry, resolver).

2. **Entries**: Users call `execute()` on the ActionHub to enter the market. They choose an outcome and stake WGHO. Earlier entries earn a higher share of the pot (time-weighted pari-mutuel).

3. **Resolution**: The market creator calls `execute()` with a RESOLVE action to set the winning outcome. There is no enforced time lock — the creator can resolve immediately.

4. **Payout**: Winners share the total pool. The pot is distributed proportionally, weighted by entry time (earlier = better share).

### 2.4 Decoded On-Chain Data (from our test market)

We created a market on Orb using the `lens/orb_aurora_292` account (`0xB106cfa2E09e9e0da066C9F90fC4099852f3d6fB`):

| Field | Value |
|-------|-------|
| Question | "Lens should be:" |
| Outcomes | "Agent friendly" (0) vs "Zion mode" (1) |
| Duration | ~3 days |
| Min Entry | 1 WGHO |
| Created | 2026-02-20 01:35:15 UTC |
| Resolved | 2026-02-20 01:42:46 UTC (7.5 minutes later) |
| Winning Outcome | "Zion mode" (index 1) |
| Entries | 0 (no participants besides creator) |

### 2.5 Key Observations

- **No automated pricing**: It's a simple pool-split model. No AMM, no price discovery.
- **Creator-resolved**: The post author has full control over resolution timing and outcome.
- **No minimum duration enforcement**: Despite showing "3 days" in the UI, the creator resolved in 7 minutes.
- **Pari-mutuel, not AMM**: Users don't get continuous pricing — they just stake into a pool.
- **WGHO collateral**: 18 decimals, same as WAD — no decimal conversion needed.
- **Post Action interface**: Uses Lens V3 `IPostAction` with `configure()`, `execute()`, `setDisabled()`.

### 2.6 Tags System

Orb uses internal tags on posts to identify prediction markets:
- `ORB-PREDICTION`
- `ORB-INTERNAL_ID-<uuid>` (internal tracking, not rendered in UI)

---

## 3. Lens V3 Post Actions — Interface

The ActionHub (`0xc6D57Ee750Ef2ee017a9E985A0C4198bEd16A802`) is the central entry point. All Post Action calls go through it.

```solidity
struct KeyValue {
    bytes32 key;
    bytes value;
}

interface IPostAction {
    function configure(
        address originalMsgSender,
        address feed,
        uint256 postId,
        KeyValue[] calldata params
    ) external payable returns (bytes memory);

    function execute(
        address originalMsgSender,
        address feed,
        uint256 postId,
        KeyValue[] calldata params
    ) external payable returns (bytes memory);

    function setDisabled(
        address originalMsgSender,
        address feed,
        uint256 postId,
        bool isDisabled,
        KeyValue[] calldata params
    ) external payable returns (bytes memory);
}
```

Key design points:
- `originalMsgSender` is the actual user (ActionHub forwards this)
- `msg.sender` inside the action contract is always the ActionHub
- Parameters are passed as `KeyValue[]` with `bytes32` keys (typically `keccak256("prefix.param.name")`) and ABI-encoded values
- Actions must restrict calls to `onlyActionHub` for security

---

## 4. SoothPostAction — Our LMSR Implementation

### 4.1 Sooth vs Orb Comparison

| Feature | Orb | Sooth |
|---------|-----|-------|
| Pricing Model | Pari-mutuel (pool split) | **LMSR AMM** (continuous pricing) |
| Price Discovery | None (just pool ratios) | **Real-time probability** |
| Buy/Sell | Enter only, no exit | **Buy AND sell anytime** |
| Collateral | WGHO | WGHO |
| Resolution | Creator-resolved | Creator-resolved |
| Creator Deposit | None | **b * ln(2) subsidy** (market maker deposit) |
| Fee | Unknown (closed source) | 2% default (configurable 0-10%) |
| Outcome Types | Multiple (N outcomes) | Binary (YES/NO/INVALID) |

### 4.2 Architecture

```
Lens Post (metadata: question, tags)
  └── SoothPostAction (IPostAction)
        ├── configure() → Create LMSR market (b param, deadline, creator subsidy)
        ├── execute()   → Multiplexed: BUY / SELL / RESOLVE / REDEEM
        └── setDisabled() → Pause/unpause market

State per market (feed + postId → Market):
  ├── LMSR: qYes, qNo, b (liquidity depth)
  ├── Positions: user → { yesShares, noShares }
  ├── Settlement: resolved, winningOutcome, resolver
  └── Collateral: totalCollateral (WGHO held)
```

### 4.3 Action Multiplexing

The `execute()` function decodes an action type from the `KeyValue[]` params:

| Action | Code | Who | Params | Effect |
|--------|------|-----|--------|--------|
| BUY | 0 | Anyone | outcome, shares, maxCost | LMSR cost → transfer WGHO → credit shares |
| SELL | 1 | Share holder | outcome, shares | Reverse LMSR → return WGHO → debit shares |
| RESOLVE | 2 | Resolver only | winningOutcome (0/1/2) | Freeze trading, set outcome |
| REDEEM | 3 | Share holder | (none) | Winning shares → WGHO payout |

### 4.4 KeyValue Encoding

Keys are `keccak256("sooth.param.<name>")`, values are `abi.encode(...)`:

| Key | Hash | Type |
|-----|------|------|
| `sooth.param.b` | `keccak256(...)` | `uint256` (WAD) |
| `sooth.param.deadline` | `keccak256(...)` | `uint256` (unix timestamp) |
| `sooth.param.feeBps` | `keccak256(...)` | `uint256` (basis points) |
| `sooth.param.action` | `keccak256(...)` | `uint256` (0-3) |
| `sooth.param.outcome` | `keccak256(...)` | `uint256` (0=NO, 1=YES, 2=INVALID) |
| `sooth.param.amount` | `keccak256(...)` | `uint256` (shares in WAD) |
| `sooth.param.maxCost` | `keccak256(...)` | `uint256` (slippage limit) |

### 4.5 LMSR Solvency — Creator Subsidy

LMSR requires initial funding to guarantee payouts. The cost function at initialization is:

```
C(0, 0) = b * ln(e^0 + e^0) = b * ln(2) ≈ b * 0.693
```

This is the maximum possible loss for the market maker. In our design, the **post creator** deposits this amount when `configure()` is called. This ensures:
- The contract always has enough WGHO to pay out winning shares
- The creator is the initial market maker / liquidity provider
- The subsidy is `(b * 693147180559945309) / 1e18` in WAD math

For the default `b = 100 WGHO`, the creator deposits ~69.3 WGHO.

### 4.6 Outcome Encoding

Consistent with Sooth Protocol conventions:

| Value | Outcome | Payout |
|-------|---------|--------|
| 0 | NO | noShares holders win |
| 1 | YES | yesShares holders win |
| 2 | INVALID | 50/50 split of (yesShares + noShares) |

---

## 5. Contract Addresses (Reference)

### Lens Chain Mainnet (232)

| Contract | Address |
|----------|---------|
| ActionHub | `0xc6D57Ee750Ef2ee017a9E985A0C4198bEd16A802` |
| WGHO | `0x6bDc36E20D267Ff0dd6097799f82e78907105e2F` |
| Orb Prediction Action | `0xc610487FB21b7fF8993D2586d8fB24DFd2063d62` |
| SoothPostAction | *not yet deployed* |

### Sooth Lens Accounts

| Account | Address | Username |
|---------|---------|----------|
| Sooth Protocol | `0xD663aAdBBe8C669797aE5171aAe25116f50a5be9` | lens/soothalpha |
| Test Account | `0xB106cfa2E09e9e0da066C9F90fC4099852f3d6fB` | lens/orb_aurora_292 |

---

## 6. File Locations

| File | Purpose |
|------|---------|
| `packages/contracts-plugin/src/lens/IPostAction.sol` | Lens V3 Post Action interface |
| `packages/contracts-plugin/src/lens/SoothPostAction.sol` | LMSR prediction market contract (~510 lines) |
| `packages/contracts-plugin/test/lens/SoothPostAction.t.sol` | Unit tests (22 tests, all passing) |
| `packages/contracts-plugin/foundry.toml` | Foundry config with Lens RPCs |
| `packages/contracts-core/src/libraries/LMSRMath.sol` | LMSR math library (shared) |
| `apps/lens/check-posts.mjs` | Script to query soothalpha posts on Lens mainnet |
| `apps/lens/check-orb.mjs` | Script to find Orb prediction posts |
| `apps/lens/docs/LENS_API_REVIEW.md` | Full Lens V3 API technical review |
| `apps/lens/docs/FIREFLY_LENS_SPEC.md` | Firefly plugin spec |

---

## 7. Next Steps

1. **Deploy SoothPostAction** to Lens testnet (chain 37111)
   - Constructor args: WGHO address, ActionHub address, owner
   - Need testnet WGHO or deploy a mock

2. **Register with ActionHub** — attach the action to posts

3. **Build frontend integration** — SDK calls for configure/execute

4. **Test E2E on testnet** — create post + configure action + buy/sell/resolve/redeem

5. **Deploy to mainnet** — Lens Chain (chain 232) with real WGHO

---

*v1.0 — 2026-02-20*
