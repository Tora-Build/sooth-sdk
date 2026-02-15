# V12 Orderbook — Handover

## What Was Built

A new orderbook contract replacing TickBook V10. Same concept (CLOB for prediction markets), radically simpler.

**Branch:** `v12-4atomic-orderbook`

**Key commits (clean):**
| Commit | Description |
|--------|-------------|
| `cc72762` | Core contract — 602 lines |
| `0c21fec` | ERC20 OutcomeTokens (YES/NO are real transferable tokens) |
| `be3af88` | Test suite — 45/45 passing |
| `59f2f5a` | Factory pattern — `createMarket()` auto-deploys both tokens |
| `611d73a` | Deployed to Base Sepolia |
| `9b0dcb7` | Multi-actor on-chain test (3 actors, 16/16 passing) |

**Ignore commits after `9b0dcb7`** — messy UI experiments that were reverted. Can be squashed out.

---

## Architecture: 4 Atomic Actions

| Action | What it does |
|--------|-------------|
| `buyYes(marketKey, tick, amount)` | Place limit order to buy YES tokens at `tick/1000` price |
| `buyNo(marketKey, tick, amount)` | Place limit order to buy NO tokens. With `escrow=true`: lock existing YES tokens, auto-merge on fill |
| `mint(marketKey, amount)` | Deposit collateral → get 1 YES + 1 NO (always at price = 1.0) |
| `merge(marketKey, amount)` | Burn 1 YES + 1 NO → withdraw collateral |

**No sell action.** Selling YES = `buyNo(escrow=true)`. Selling NO = `buyYes(escrow=true)`.

### Auto-Matching

When `buyYes.tick + buyNo.tick >= 1000`, the engine auto-mints a complete set from combined collateral and distributes tokens. Surplus (price improvement) goes to the taker.

### Ticks

1000 ticks total. Tick 1 = 0.1%, tick 999 = 99.9%. Price = `tick / 1000`. FIFO matching within each tick.

---

## Contracts

**SoothBook.sol** (602 lines) — `packages/contracts-core/src/SoothBook.sol`
- Factory: `createMarket(key, collateral, name)` deploys YES + NO OutcomeTokens
- Orderbook: buyYes, buyNo, cancelOrder, mint, merge
- Settlement: resolve (set outcome), redeem (burn winning tokens for collateral)
- Uses TickBitmap (same as V10) for gas-efficient tick scanning

**OutcomeToken.sol** — `packages/contracts-core/src/OutcomeToken.sol`
- Standard ERC20 with minter role
- `setMinter()` for multi-minter support (SoothBook is the minter)

### V12 vs V10

| | V10 (TickBook) | V12 |
|--|----------------|-----|
| Lines | 2,710 | 602 |
| External functions | 18+ | 8 |
| Vault contract | Yes (TickBookVault) | No — holds collateral directly |
| Growth accumulators | Yes | No |
| Deferred claims | Yes | No |
| Token type | Internal balances | ERC20 |

---

## Deployed (Base Sepolia)

| Contract | Address |
|----------|---------|
| SoothBook | `0x9a992959490578c8f171C25BC8615E9Cc1AA2aB8` |
| MockUSDC | `0x39d579b27011FCE3f944Aa0DfBb1885279c9eD89` |
| Test YES | `0x7C68410557A837B4Cc0f9595CA75186e4A66a705` |
| Test NO | `0x04280B7C3584c4fd66885d2C32F3B89c1C4eE972` |

Deploy script: `packages/contracts-core/script/DeploySoothBook.s.sol`
Multi-actor test: `packages/contracts-core/script/multi-actor-test.sh`

---

## What Needs Doing: UI Replacement

Replace TickBook V10 UI in `apps/web` with V12 hooks and components.

### Files to replace

**Hooks (read contract state + write txs):**
- `apps/web/src/hooks/useOrderbook.ts` — orderbook depth data
- `apps/web/src/hooks/useOrderbookTrade.ts` — trade execution
- `apps/web/src/hooks/usePlaceOrder.ts` — order placement
- `apps/web/src/hooks/useTickBookPoolManager.ts` — pool manager interactions
- `apps/web/src/hooks/useTickBookDirect.ts` — direct contract reads
- `apps/web/src/hooks/useTickBookQuoteDirect.ts` — quote calculations
- `apps/web/src/hooks/useTickBookVault.ts` — vault interactions (no vault in V12)
- `apps/web/src/hooks/useTickBookVaultDirect.ts` — direct vault reads (no vault in V12)
- `apps/web/src/hooks/indexer/useOrderbookIndexed.ts` — indexed data

**Components:**
- `apps/web/src/components/features/trader/Orderbook.tsx` — orderbook display
- `apps/web/src/components/features/trader/OrderbookForm.tsx` — order form
- `apps/web/src/components/features/trader/LimitOrderForm.tsx` — limit order UI
- `apps/web/src/components/features/ProTerminal/Orderbook.tsx` — pro terminal view
- `apps/web/src/components/features/TickBook/OrderbookDepth.tsx` — depth chart

**SDK:**
- `apps/web/src/lib/sdk/commands/orderbook.ts` — orderbook commands

### Key differences for UI

1. **No vault** — remove all vault deposit/withdraw UI
2. **No sell action** — "Sell YES" button should call `buyNo(escrow=true)`
3. **ERC20 tokens** — balances via standard `balanceOf`, not internal mappings
4. **4 tabs**: Buy YES, Buy NO, Mint, Merge
5. **Factory** — market creation via `createMarket()` instead of separate pool setup

### Note

`apps/web` has ~95 pre-existing TypeScript errors (before any V12 changes). Don't try to fix them all.

---

## Testing

```bash
# Unit tests (45/45)
cd packages/contracts-testing
forge test --match-contract SoothBookTest -vv

# Multi-actor on-chain test (Base Sepolia)
cd packages/contracts-core
./script/multi-actor-test.sh
```

---

## Contract ABI (key functions)

```solidity
// Market creation
function createMarket(bytes32 key, address collateral, string name) external returns (address yes, address no)

// Trading
function buyYes(bytes32 key, uint24 tick, uint256 amount) external
function buyNo(bytes32 key, uint24 tick, uint256 amount, bool escrow) external
function cancelOrder(bytes32 key, uint256 orderId) external

// Minting/Merging
function mint(bytes32 key, uint256 amount) external
function merge(bytes32 key, uint256 amount) external

// Settlement
function resolve(bytes32 key, bool yesWins) external
function redeem(bytes32 key, uint256 amount) external

// Views
function getMarket(bytes32 key) external view returns (Market memory)
function getOrder(bytes32 key, uint256 orderId) external view returns (Order memory)
function getBestYesTick(bytes32 key) external view returns (uint24)
function getBestNoTick(bytes32 key) external view returns (uint24)
```
