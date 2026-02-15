# SoothBook V12 — 4-Atomic Orderbook

> Radically simplified prediction market orderbook. 4 actions, no vault, no growth accumulators. 75% code reduction from TickBook V10.

## Design Philosophy

TickBook V10 had 18+ external functions, a separate vault contract, growth accumulators, deferred claims, and dual order systems. SoothBook V12 asks: **what's the minimum set of atomic actions needed to express every possible prediction market trade?**

The answer: **4 actions**.

## The 4 Atomics

| Action | What it does | Collateral flow |
|--------|-------------|-----------------|
| `buyYes(marketKey, tick, amount, escrow, maxCollateral)` | Place limit order to buy YES shares at `tick` price | USDC → SoothBook |
| `buyNo(marketKey, tick, amount, escrow, maxCollateral)` | Place limit order to buy NO shares at `tick` price | USDC → SoothBook |
| `mint(marketKey, amount)` | Deposit USDC, receive equal YES + NO tokens | USDC → SoothBook, YES+NO → user |
| `merge(marketKey, amount)` | Burn equal YES + NO tokens, receive USDC | YES+NO burned, USDC → user |

### Why No Sell Action?

**Selling = buying the opposite side.**

Want to sell YES? Buy NO. The auto-match engine handles the rest. When `buyYes.price + buyNo.price ≥ 1000`, the engine mints a complete set from collateral and distributes tokens to both sides. This eliminates the need for separate sell logic entirely.

### Escrow Flag (Not a 5th Action)

`buyNo(escrow=true)` handles the "sell YES for USDC" use case:

1. User holds YES tokens and wants USDC
2. Calls `buyNo(escrow=true)` — burns their YES tokens as collateral
3. When the order fills (matched with a buyYes), auto-merges the YES+NO pair
4. User receives USDC back

Same for `buyYes(escrow=true)` to exit a NO position.

This keeps the interface at exactly 4 actions while covering every exit scenario.

## Auto-Match Engine

When a new order arrives, the engine checks if the best opposing order creates a matchable pair:

```
bestYesTick + bestNoTick ≥ 1000 ticks
```

If yes:
1. **Mint** a complete YES+NO set from collateral (1 USDC per pair)
2. **Distribute** YES tokens to the YES buyer, NO tokens to the NO buyer
3. **Surplus goes to taker** — price improvement for the one who triggers the match
4. **Maker fills at exact price** — gets exactly what they asked for

### Example

- Alice: `buyYes(tick=600)` — willing to pay 60¢ for YES
- Bob: `buyNo(tick=450)` — willing to pay 45¢ for NO
- Sum: 600 + 450 = 1050 ≥ 1000 → **matchable**
- Cost to mint 1 pair: 1000 ticks (100¢)
- Alice pays 60¢, Bob pays 45¢ = 105¢ total
- Surplus: 5¢ → goes to taker (whoever placed the later order)

## Tick System

- **1000 ticks**: 1–999 (0.1% granularity)
- **Price = tick / 1000** (in WAD: `tick * 1e15`)
- **YES tick 600 = 60.0¢**, NO tick 400 = 40.0¢
- **Implied price**: derived from best YES bid + best NO bid
- **TickBitmap**: efficient O(1) lookup for non-empty tick levels (reused from V10)

## Order Matching: FIFO

Orders at each tick level follow **First-In-First-Out** (FIFO):
- Simpler than pro-rata
- Arguably fairer — rewards early price setters
- Array-based with head pointer (avoids costly array shifts)

## ERC20 Outcome Tokens

YES and NO positions are **real ERC20 tokens** (`OutcomeToken.sol`):
- Transferable between wallets
- Composable with DeFi (LP, collateral, etc.)
- `setMinter()` for multi-minter support
- Deployed automatically via factory pattern

**Not internal balance mappings** like V10's vault system.

## Factory Pattern

```solidity
createMarket(bytes32 key, address collateral, string name)
```

One transaction:
1. Deploys YES OutcomeToken (`name-YES`)
2. Deploys NO OutcomeToken (`name-NO`)
3. Registers market in SoothBook
4. Sets SoothBook as minter for both tokens

No separate vault deployment needed.

## Market Lifecycle

```
createMarket → active trading → resolveMarket(outcome) → redeem
```

1. **Create**: Deploy market with collateral token
2. **Trade**: Users place orders (buyYes/buyNo), mint/merge as needed
3. **Resolve**: Owner sets outcome (0=NO, 1=YES, 2=invalid)
4. **Redeem**: Winners burn outcome tokens for collateral (invalid = 50/50 split)

## Additional Actions

Beyond the 4 atomics:

| Action | Purpose |
|--------|---------|
| `cancel(marketKey, side, tick)` | Cancel your resting orders at a specific tick |
| `redeem(marketKey)` | After resolution, burn winning tokens for collateral |

## V12 vs V10 Comparison

| Metric | TickBook V10 | SoothBook V12 |
|--------|-------------|---------------|
| Contract LOC | 2,710 | 602 |
| External functions | 18+ | 8 |
| Separate vault | Yes (TickBookVault) | No |
| Growth accumulators | Yes | No |
| Deferred claims | Yes | No |
| Outcome tokens | Internal balances | ERC20 (transferable) |
| Order types | Buy + Sell + Spot + Range | Buy only (4 atomics) |
| Matching | Complex dual-book | Auto-mint on cross |

**75% code reduction. ~60% gas savings.**

## Polymarket Flow Coverage

All Polymarket user flows are expressible via the 4 atomics:

| Polymarket flow | SoothBook V12 |
|----------------|---------------|
| Buy YES | `buyYes(tick, amount)` |
| Buy NO | `buyNo(tick, amount)` |
| Sell YES for USDC | `buyNo(escrow=true)` — burns YES, auto-merges |
| Sell NO for USDC | `buyYes(escrow=true)` — burns NO, auto-merges |
| Mint complete set | `mint(amount)` |
| Redeem complete set | `merge(amount)` |
| Market order (fill any price) | `buyYes(tick=999)` or `buyNo(tick=999)` |
| Limit order | `buyYes(tick=X)` or `buyNo(tick=X)` |

## View Functions

| Function | Returns |
|----------|---------|
| `markets(key)` | collateral, yesToken, noToken, active, finalized, outcome |
| `getBalance(key, user)` | YES balance, NO balance |
| `getCollateralBacking(key)` | Total USDC locked in market |
| `getBestTick(key, side)` | Best (highest) bid tick for a side |
| `getOrdersAtTick(key, side, tick)` | Total amount + order count at tick |
| `getImpliedPrice(key)` | YES price, NO price (WAD) |

---

## Deployed Contracts (Base Sepolia)

| Contract | Address |
|----------|---------|
| SoothBook | `0x9a992959490578c8f171C25BC8615E9Cc1AA2aB8` |
| MockUSDC | `0x39d579b27011FCE3f944Aa0DfBb1885279c9eD89` |
| Test YES Token | `0x7C68410557A837B4Cc0f9595CA75186e4A66a705` |
| Test NO Token | `0x04280B7C3584c4fd66885d2C32F3B89c1C4eE972` |
| Test Market Key | `0x79a7bc6308ae7267ddd3776d02ad1446f41d1e3ed74ed41b5184fc53cc8bd5b5` |

**Deployer**: `0xEfdB15EE6e7C7C7906cb230AfF1EDb75CcBaA74F`

## Test Coverage

- **45 unit tests** (`SoothBook.t.sol`, 720 lines) — mint, merge, buy, auto-match, escrow exits, cancel, redeem, FIFO, invariants, full flows
- **16 multi-actor on-chain tests** (`multi-actor-test.sh`) — Alice/Bob/Carol trading on Base Sepolia

## Source Files

| File | Lines | Purpose |
|------|-------|---------|
| `packages/contracts-core/src/SoothBook.sol` | 602 | Core contract |
| `packages/contracts-core/src/OutcomeToken.sol` | ~50 | ERC20 outcome token with minter |
| `packages/contracts-core/src/libraries/TickBitmap.sol` | ~80 | Efficient tick lookup |
| `packages/contracts-testing/test/unit/SoothBook.t.sol` | 720 | Foundry unit tests |
| `packages/contracts-core/script/DeploySoothBook.s.sol` | 63 | Deploy script |
| `packages/contracts-core/script/multi-actor-test.sh` | ~200 | On-chain integration tests |

## Branch

`v12-4atomic-orderbook` — all V12 work lives here.
