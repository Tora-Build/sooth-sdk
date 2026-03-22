# Sooth-Core Migration Guide: Main → Develop

> Comprehensive diff of `packages/contracts-core` (main) and `packages/contracts-testing` (main) vs `packages/contracts-core` submodule (develop, pointing to `sooth-core` repo).
> Covers: source contracts, libraries, interfaces, tests, deploy scripts, deployment configs, and all integration changes pushed onto the rest of the monorepo.
> Generated: 2026-03-14 | Revised: 2026-03-23 (updated for sooth-core post-cleanup state)

---

## Table of Contents

1. [Package Structure Change](#1-package-structure-change)
2. [Build & Toolchain Changes](#2-build--toolchain-changes)
3. [Source Contract Inventory Diff](#3-source-contract-inventory-diff)
4. [Contract-by-Contract Logic Diff](#4-contract-by-contract-logic-diff)
5. [Library Changes](#5-library-changes)
6. [Interface Changes](#6-interface-changes)
7. [Test Suite Comparison](#7-test-suite-comparison)
8. [Deploy Scripts & Tooling](#8-deploy-scripts--tooling)
9. [Deployment Config & Addresses](#9-deployment-config--addresses)
10. [Integration Impact: Frontend](#10-integration-impact-frontend)
11. [Integration Impact: SDK-Core](#11-integration-impact-sdk-core)
12. [Integration Impact: Indexer](#12-integration-impact-indexer)
13. [Integration Impact: Keeper](#13-integration-impact-keeper)
14. [ABI Surface Changes](#14-abi-surface-changes)
15. [Migration Checklist](#15-migration-checklist)

---

## 1. Package Structure Change

### Main Branch

```
packages/
├── contracts-core/          ← Regular directory, part of monorepo
│   ├── src/                 ← 10 contracts + 9 interfaces + 4 libraries
│   ├── script/              ← Deploy scripts (Forge .s.sol + TypeScript)
│   ├── deployments/         ← 5 chain JSONs
│   ├── foundry.toml
│   └── package.json
└── (no contracts-testing/)  ← Tests were absent from contracts-core on main
```

### Develop Branch

```
packages/
└── contracts-core/          ← Git submodule → github.com/Tora-Build/sooth-core (develop branch)
    ├── src/                 ← 5 core contracts + 3 adjudicator base/registry + 3 interfaces (⚠️ some files pending)
    ├── test/                ← 11 test files (unit, integration, invariant, fork)
    ├── script/
    │   ├── deploy/          ← Forge deploy scripts (DeployCore, DeployBase, DeployAdjudicator)
    │   ├── markets/         ← Market creation scripts
    │   ├── adjudicators/    ← Adjudicator scripts
    │   ├── interactive/     ← Full interactive testing framework (CLI + scenarios)
    ├── config/              ← Per-chain JSON configs (fee params, RPC)
    ├── deployments/         ← Chain deployment JSONs
    ├── .github/             ← CI workflows (incl. notify-alpha on develop push)
    ├── foundry.toml
    └── package.json
```

**Key change:** `contracts-core` is now an **external git submodule**. All development happens in the `sooth-core` repo. The monorepo just pins a commit. Legacy TS scripts, interactive CLI, and adjudicator implementations have been removed from core — only Forge-based tooling remains.

> **2026-03-19 cleanup:** `mocks/` dir removed (MockUSDC moved to `test/mocks/`), `script/interactive/` removed, `script/polymarket/` removed, legacy TS deploy scripts removed, `docs/` stale research docs removed.

---

## 2. Build & Toolchain Changes

| Setting | Main | Develop | Impact |
|---------|------|---------|--------|
| `pragma solidity` | `^0.8.20` | `^0.8.33` | New Solidity features available |
| `solc_version` | `0.8.30` | `0.8.33` | Must update compiler |
| `optimizer_runs` | `1` (size-optimized) | `200` (speed-optimized) | Different gas profile, larger bytecode |
| `via_ir` | `true` | `false` | **Disabled** (2026-03-19) — removed to fix stack-too-deep errors and speed up compilation |
| Error style | `require(x, "string")` | `require(x, CustomError())` | All error handling changes |
| Package deps | OpenZeppelin, forge-std | Same + `clones-with-immutable-args` | New dependency for TruthMarket clones |

> **⚠️ AGENTS.md discrepancy:** `AGENTS.md` currently lists `solc_version: 0.8.30` and `optimizer_runs: 1`. After migration, update to `0.8.33` and `200` respectively.

### foundry.toml Profile Changes

```toml
# MAIN
[profile.default]
solc_version = "0.8.30"
optimizer_runs = 1

# DEVELOP
[profile.default]
solc_version = "0.8.33"
optimizer_runs = 200
via_ir = false        # Disabled (was true on main)
```

---

## 3. Source Contract Inventory Diff

### Contracts in `src/`

| Contract | Main | Develop | Change |
|----------|------|---------|--------|
| `AMMEngine.sol` | ✅ 644 lines | ✅ 769 lines | **Major rewrite** — direct trades, LP ops, fee claims |
| `LaunchpadEngine.sol` | ✅ ~800 lines | ✅ 437 lines | **Major reduction** — market creation + trial only |
| `TruthMarket.sol` | ✅ ~350 lines | ✅ 302 lines | **Rewrite** — CREATE2 clones, new lifecycle |
| `SoothBook.sol` | ✅ ~900 lines | ✅ 896 lines | **Rewrite** — MatchingEngine custody, internal positions |
| `LaunchpadLPToken.sol` | ✅ ~120 lines | ✅ 136 lines | **Modified** — dual authorization |
| `ValidatedAdjudicator.sol` | ✅ ~300 lines | ❌ | **REMOVED** (2026-03-19) — ZkTLS/TEE stack cleaned up; adjudicator implementations expected to live outside core |
| `FeeRouter.sol` | ❌ | ✅ 405 lines | **NEW** — fee accounting extracted from LaunchpadEngine |
| `MatchingEngine.sol` | ❌ | ✅ 285 lines | **NEW** — token custody for orderbook fills |
| `Collateralizer.sol` | ✅ ~250 lines | ❌ | **REMOVED** — split/merge now in SoothBook |
| `OutcomeToken.sol` | ✅ ~100 lines | ❌ | **REMOVED** — internal positions, no ERC20 tokens |
| `ProtocolConfig.sol` | ✅ ~150 lines | ❌ | **REMOVED** — config inline per contract |
| `MockUSDC.sol` | ✅ (in src/) | ✅ (in test/mocks/) | **Moved** to `test/mocks/` (standalone `mocks/` dir removed 2026-03-19) |

> **Note — TickBook system not in `contracts-core`:** The V9/V10 TickBook orderbook contracts (`TickBookPoolManager.sol`, `TickBookVault.sol`, `DynamicFeeHook.sol`, `TransientDelta.sol`) were part of the old `packages/contracts-evm/` package, which was removed from the monorepo before the submodule migration. They are **not** present in `contracts-core` on either branch. However, the TickBook system was a major part of the deployed protocol and its functionality is now replaced by `SoothBook` + `MatchingEngine` on develop. See [§4.12](#412-tickbook-system--soothbook--matchingengine-transition) for the architectural transition.

### Adjudicators (new directory `src/adjudicators/`)

| File | Main | Develop | Notes |
|------|------|---------|-------|
| `AdjudicatorBase.sol` | ❌ | ✅ 121 lines | Abstract guardian whitelist (per-adjudicator) |
| `Adjudicator.sol` | ❌ | ✅ 164 lines | Abstract reusable lifecycle logic |
| `AdjudicatorRegistry.sol` | ❌ | ✅ 105 lines | Whitelist of approved adjudicators |
| `ZkTLSAdjudicator.sol` | ❌ | ❌ | **REMOVED** (2026-03-19) — zkTLS stack removed from core; implementations live outside |
| `ValidatedAdjudicator.sol` | — | ❌ | **REMOVED** (2026-03-19) — TEE/ERC-8004 impl removed from core |

---

## 4. Contract-by-Contract Logic Diff

### 4.1 AMMEngine.sol — From Router Delegate to Primary Trade Entry Point

#### Constructor

```solidity
// MAIN:
constructor(address _usdc, address _protocolConfig, address _owner)
// Dependencies: USDC, ProtocolConfig

// DEVELOP:
constructor(address _baseToken, address _launchpadEngine, address _feeRouter, address _owner)
// Dependencies: baseToken (generic ERC20), LaunchpadEngine, FeeRouter
```

#### State Variables

| Variable | Main | Develop | Change |
|----------|------|---------|--------|
| `usdc` (IERC20) | ✅ immutable | Renamed → `baseToken` | Generic ERC20 support |
| `usdcDecimals` | ✅ | Renamed → `baseTokenDecimals` | |
| `protocolConfig` | ✅ immutable | ❌ **REMOVED** | |
| `router` (address) | ✅ mutable | ❌ **REMOVED** | No router pattern |
| `launchpadEngine` | ❌ | ✅ immutable | For pause check |
| `feeRouter` | ❌ | ✅ immutable | For fee calculation |
| `_lockedBalance` | ✅ mapping | ❌ **REMOVED** | Simplified balance model |
| `lpTokens` | ❌ | ✅ mapping | LP token registry |
| `_adjudicatorClaimed` | ❌ | ✅ mapping | Pull-based fee claims |
| `_protocolClaimed` | ❌ | ✅ uint256 | Pull-based fee claims |
| `protocolTreasury` | ❌ | ✅ address | For protocol fee claims |
| `_marketDeposits` | ❌ | ✅ mapping | Creator deposit tracking |

#### Functions — Removed

```solidity
// ROUTER PATTERN — eliminated
function setRouter(address _router) external onlyOwner
function tradePositionsFor(address user, ..., uint256 fee) external onlyRouter
modifier onlyRouter()

// BALANCE — simplified
function getBalances(user) → (available, locked)  // was 2 returns, now 1
function spendBalanceFor(address user, uint256 amount) external onlyRouter  // router pattern removed

// EVENTS — removed
event LockedBalanceReduced(...)
event RouterUpdated(...)
event BalanceUsed(...)
event WalletPull(...)
event BalanceCredited(...)
```

#### Functions — Added (NEW on develop)

```solidity
// LP OPERATIONS (moved from LaunchpadEngine)
function setLPToken(address market, address lpToken) external  // only LaunchpadEngine
function mintLPTokens(address market, address to, uint256 amount) external  // only LaunchpadEngine
function redeemLP(address market, uint256 lpAmount) external nonReentrant → (uint256 payout)
  // Redemption: burns LP tokens, pays floor value per LP share
  // Can only be called after market is settled
  // Floor = max(0, grossCash - max(qYes, qNo))

// SETTLEMENT
function settlePosition(address market) external nonReentrant
  // Settles user's AMM position after market settles
  // Winning shares → baseToken payout, losing shares → 0
  // INVALID (outcome=2) → 50% payout

// FEE CLAIMS (pull-based)
function claimAdjudicatorFees(address market) external nonReentrant → uint256
  // Adjudicator of the market claims accrued fees
function claimProtocolFees() external nonReentrant → uint256
  // Protocol treasury claims accrued fees
function setProtocolTreasury(address treasury) external onlyOwner

// CREATOR LIQUIDITY
function increaseLiquidityFromCreator(address market, uint256 additionalB) external nonReentrant
  // Creator can add more liquidity to their market (costs deposit)

// VIEW FUNCTIONS
function getLockQueue(address user) external view → LockEntry[]
function getClaimableAmount(address user) external view → uint256
function getLiquidity(address market) external view → uint256
function lpTokens(address market) external view → address
```

#### Functions — Changed Signature

```solidity
// initializeMarket — NEW signature
// MAIN:
function initializeMarket(address market, uint256 initialLiquidity) external
  // Always starts at 50/50

// DEVELOP:
function initializeMarket(address market, uint256 b, uint256 qYes, uint256 qNo, uint256 depositWad) external
  // Accepts initial quantities (for non-50/50 starting probability)
  // Only callable by LaunchpadEngine

// tradePositions — same signature, BUT:
// MAIN:  Only callable by user directly OR via router (tradePositionsFor)
// DEVELOP: Only callable by user directly (no router). Fee handled internally via FeeRouter callback.
function tradePositions(
    address market,
    uint8 outcome,
    int256 deltaShares,
    uint256 maxCostOrMinProceeds
) external returns (uint256 actualCost)

// getBalances — simplified return
// MAIN:   function getBalances(user) → (uint256 available, uint256 locked)
// DEVELOP: function getBalances(user) → (uint256 available)   ← single value

// getPositionQuote — return expanded
// MAIN:   → (uint256 cost, uint256 newPrice)
// DEVELOP: → (uint256 cost, uint256 newPrice)  ← same
```

#### Core Logic Change: Fee Integration

```solidity
// MAIN: Fee is passed in by router as parameter, sent back to router
function _tradePositions(..., uint256 fee) internal {
    if (fee > 0) {
        usdc.safeTransfer(payer, _wadToUsdc(fee));
    }
}

// DEVELOP: Fee calculated internally via FeeRouter callback
function tradePositions(...) external {
    // 1. Calculate base cost
    uint256 baseCost = LMSRMath.calculateCost(...);
    // 2. Ask FeeRouter to calculate and distribute fee
    (uint256 feeAmount, uint256 lpMintAmount) = feeRouter.calculateAndDistributeFee(market, baseCost, true, msg.sender);
    // 3. Total cost = baseCost + feeAmount
    uint256 totalCost = baseCost + feeAmount;
    // 4. Mint LP tokens if pre-graduation
    if (lpMintAmount > 0) { LaunchpadLPToken(lpToken).mint(msg.sender, lpMintAmount); }
}
```

#### Core Logic Change: Lock Model Simplified

```solidity
// MAIN: Two-balance model (available + locked)
_availableBalance[user] += proceedsToUser;   // total balance
_lockedBalance[user] += proceedsToUser;      // subset that can't be withdrawn
// On buy: proportionally reduce locked to maintain locked <= available invariant
// On claim: reduce both available and locked

// DEVELOP: Single available balance + lock queue
_availableBalance[user] += proceedsToUser;   // only one balance
_lockQueue[user].push(LockEntry{...});        // queue tracks when each lock expires
// No _lockedBalance mapping at all
// claimUnlocked() processes queue, reduces _availableBalance, transfers tokens
```

---

### 4.2 LaunchpadEngine.sol — Slimmed Down to Market Factory

#### Constructor

```solidity
// MAIN (7 dependencies):
constructor(
    address _usdc,
    address _ammEngine,
    address _collateralizer,    // REMOVED
    address _soothBook,         // REMOVED
    address _protocolConfig,    // REMOVED
    address _protocolTreasury,  // REMOVED (moved to AMMEngine)
    address _owner
)

// DEVELOP (7 dependencies, different ones):
constructor(
    address _baseToken,
    address _truthMarketImpl,      // NEW: clone implementation
    address _adjudicatorRegistry,  // NEW: optional whitelist
    address _ammEngine,
    address _feeRouter,            // NEW
    address _matchingEngine,       // NEW
    address _owner
)
```

#### Functions — Removed (moved elsewhere or eliminated)

```solidity
// TRADE ROUTING — eliminated (traders call AMMEngine directly)
function tradePositions(address market, uint8 outcome, int256 deltaShares, uint256 maxCost)
function tradePositionsFor(address user, ...)
function depositAndTrade(address market, uint256 depositAmount, uint8 outcome, int256 deltaShares, uint256 maxCost)

// LP MANAGEMENT — moved to AMMEngine
function redeemLP(address market, uint256 lpAmount)
function increaseBBase(address market, uint256 amount)

// TRIAL DISMISS/REFUND — eliminated (adjudicator settles as INVALID instead)
function dismissMarket(address market)
function claimRefund(address market)

// FEE CONFIGURATION — moved to FeeRouter
function setPreGradFeeBps(uint16 bps)
function setPostGradFeeBps(uint16 bps)
function setFeeSplits(uint16 bBase, uint16 lpYield, uint16 protocol)
function setGraduationMultiplier(uint8 multiplier)
function getGraduationProgress(address market) → (...)

// FEE STATE — removed (now in FeeRouter)
// MarketState struct fields removed: bCurrent, feesAccrued, totalLPSupply, lpYieldPool, isGraduated, createdAt

// ADAPTER PATTERN — removed
function createMarketFor(address creator, ...)
function setAuthorizedAdapter(address adapter, bool authorized)

// CONFIG — removed (ProtocolConfig eliminated)
function protocolConfig() → address
function protocolTreasury() → address

// READ FUNCTIONS — removed
function preGradFeeBps()
function postGradFeeBps()
function graduationMultiplier()
function getLPToken(address market) → address  // still exists on develop
```

#### createMarket() — Signature Change

```solidity
// MAIN:
function createMarket(
    string calldata question,
    uint64 startTime,
    uint64 deadline,
    address adjudicator,
    address guardian,              // REMOVED — guardians now per-adjudicator
    uint256 initialLiquidity,      // Renamed → bBase
    uint256 agentId,               // REMOVED — validated via adjudicator type
    uint8 minValidators            // REMOVED — validated via adjudicator type
) external returns (address market, uint256 lpTokens)
  // Deploys TruthMarket via `new TruthMarket(...)`
  // Transfers USDC to LaunchpadEngine (it holds the tokens)
  // Initializes AMMEngine with 50/50 probability
  // Returns LP token amount minted to creator

// DEVELOP:
function createMarket(
    string calldata question,
    uint64 startTime,
    uint64 deadline,
    address adjudicator,
    uint256 bBase,                    // Renamed from initialLiquidity
    uint256 initialProbabilityWad     // NEW — set starting YES probability (e.g., 0.5e18 = 50%)
) external returns (address market, address lpToken)
  // Deploys TruthMarket via CREATE2 minimal proxy clone
  // Transfers baseToken directly to AMMEngine (LaunchpadEngine holds nothing)
  // Initializes AMMEngine with custom initial probability
  // Returns LP token address (not amount)
  // Registers market in FeeRouter
  // Checks AdjudicatorRegistry if set
  // Uses deterministic salt: keccak256(creator, adjudicator, question, nonce)
```

#### MarketState Struct — Simplified

```solidity
// MAIN:
struct MarketState {
    address creator;
    address lpToken;
    uint256 bBase;
    uint256 bCurrent;           // REMOVED
    uint256 feesAccrued;        // REMOVED (now in FeeRouter)
    uint256 totalLPSupply;      // REMOVED (now in LP token)
    uint256 lpYieldPool;        // REMOVED (now in FeeRouter)
    bool isGraduated;           // REMOVED (now in FeeRouter)
    uint256 creatorDeposit;
    uint256 createdAt;          // REMOVED
    uint64 trialEndTime;        // REMOVED (computed from TruthMarket clone args)
    bool isDismissed;           // REMOVED (concept eliminated)
    uint256 totalLockedCost;    // REMOVED (concept eliminated)
}

// DEVELOP:
struct MarketState {
    address creator;
    address lpToken;
    uint256 bBase;
    uint256 creatorDeposit;
    uint256 graduatedAt;        // NEW: timestamp when graduated (0 = not graduated)
}
```

#### Functions — Added (NEW on develop)

```solidity
function notifyGraduation(address market) external onlyFeeRouter
  // Callback from FeeRouter when fees reach graduation threshold
  // Sets graduatedAt timestamp
  // Registers market in SoothBook (via MatchingEngine)

function isTrialExpiredWithoutGraduation(address market) external view → bool
  // AMMEngine checks this before allowing trades

function predictMarketAddress(
    address creator, address adjudicator, string calldata question,
    uint64 startTime, uint64 deadline, uint256 nonce
) external view → address
  // Deterministic address from CREATE2 salt

function creatorNonce(address creator) external view → uint256
  // Auto-incrementing nonce per creator

function pause() / unpause() external onlyOwner
  // Local pause (was global via ProtocolConfig on main)

function isPaused() external view → bool

function setDefaultTrialPeriod(uint64 period) external onlyOwner
```

#### Trial Period Logic Change

```solidity
// MAIN: Default trial = 7 days, flat
uint64 constant DEFAULT_TRIAL_PERIOD = 7 days;
// Trial end = createdAt + DEFAULT_TRIAL_PERIOD
// Dismiss: creator calls dismissMarket() after trial if not graduated
// Refund: users call claimRefund() after dismissal

// DEVELOP: Default trial = 3 days, capped at 30% of time to deadline
uint64 public defaultTrialPeriod = 3 days;
// Trial end = min(defaultTrialPeriod, 0.3 * timeUntilDeadline)
// NO dismiss/refund functions. If trial expires without graduation:
//   - AMMEngine blocks new trades (isTrialExpiredWithoutGraduation = true)
//   - Adjudicator must settle market as INVALID (outcome=2)
//   - Users get 50% payout via standard settlement path
```

---

### 4.3 TruthMarket.sol — Lifecycle Rewrite + Clone Deployment

#### Deployment Model

```solidity
// MAIN: Standard constructor, deployed as standalone contract
constructor(
    string memory _question,
    uint64 _startTime,
    uint64 _deadline,
    address _adjudicator,
    address _guardian,          // REMOVED on develop
    address _launchpadEngine
)
// Stores all params in storage

// DEVELOP: EIP-1167 minimal proxy clone with immutable args
// No constructor — deployed via Clones.cloneDeterministicWithImmutableArgs()
// Immutable args packed as: questionHash(32) + startTime(8) + deadline(8) + adjudicator(20) + launchpadEngine(20) + creator(20) = 108 bytes
// Args decoded via assembly from appended clone bytecode
```

#### Lifecycle State Machine

```
MAIN:   LIVE ──settle()──► SETTLING ──finalize()──► SETTLED ──(auto)──► FINALIZED
                              │
                           veto()
                              │
                              ▼
                            LIVE

DEVELOP: LIVE ──resolve()──► RESOLVING ──accept()──► RESOLVED ──settle()──► SETTLED (terminal)
                               │
                            veto()
                               │
                               ▼
                             LIVE
         LIVE ──invalidate()──► SETTLED (with INVALID outcome, when deadline passes)
```

#### Function Rename Map

| Main | Develop | Called By | Notes |
|------|---------|-----------|-------|
| `settle(uint8 outcome, uint64 tStar)` | `resolve(uint8 outcome, uint64 tStar)` | Adjudicator | LIVE → RESOLVING |
| — (no equivalent) | `accept()` | Adjudicator | RESOLVING → RESOLVED (NEW step) |
| `finalize()` | `settle()` | Anyone | Terminal state (SETTLED) |
| `isSettling()` | `isResolving()` | View | Intermediate state check |
| `isSettled()` (intermediate) | `isResolved()` | View | **⚠️ SEMANTIC SHIFT** |
| `isFinalized()` (terminal) | `isSettled()` (terminal) | View | **⚠️ SAME NAME, DIFFERENT MEANING** |
| — | `invalidate()` | Anyone | NEW: when deadline passes without adjudicator action |
| `question()` → string | `questionHash()` → bytes32 | View | **String no longer stored on-chain** |
| `guardian()` → address | — **REMOVED** | View | Guardian now per-adjudicator |
| `activate()` | — **REMOVED** | Creator | |

#### Events Renamed

```solidity
// MAIN:
event MarketSettled(address indexed market, uint8 outcome, uint64 tStar);
event MarketFinalized(address indexed market, uint8 outcome);
event MarketVetoed(address indexed market);

// DEVELOP:
event MarketResolved(address indexed market, uint8 outcome, uint64 tStar);  // was MarketSettled
event MarketAccepted(address indexed market);   // NEW
event MarketSettled(address indexed market);     // was MarketFinalized (NOTE: no outcome param)
event MarketVetoed(address indexed market);      // same
event MarketInvalidated(address indexed market); // NEW
```

#### View Functions Changed

```solidity
// MAIN: Stored in contract storage, simple getter
function question() external view returns (string memory)
function startTime() external view returns (uint64)
function deadline() external view returns (uint64)
function adjudicator() external view returns (address)
function creator() external view returns (address)

// DEVELOP: Decoded from immutable args (appended clone bytecode)
function questionHash() external view returns (bytes32)     // was question() string
function startTime() public view returns (uint64)           // decoded from clone args
function deadline() public view returns (uint64)            // decoded from clone args
function adjudicator() public view returns (address)        // decoded from clone args
function creator() external view returns (address)          // decoded from clone args
function launchpadEngine() public view returns (address)    // decoded from clone args
```

#### getRedemptionValue() — NEW

```solidity
// DEVELOP only:
function getRedemptionValue(uint8 outcome) external view returns (uint256)
  // Returns WAD value for each outcome after settlement:
  //   winning outcome → 1e18
  //   losing outcome → 0
  //   INVALID (outcome=2) → 0.5e18 (50% payout for both sides)
```

---

### 4.4 SoothBook.sol — MatchingEngine Custody + Internal Positions

#### Constructor

```solidity
// MAIN:
constructor() Ownable(msg.sender)
  // Owner = deployer, manages everything inline

// DEVELOP:
constructor(
    address _baseToken,
    address _matchingEngine,    // NEW: token custody delegate
    address _feeRouter,         // NEW: fee calculations
    address _registrar,         // NEW: who can register markets
    address _owner
)
```

#### Key Architecture Changes

```
MAIN:
  SoothBook deploys ERC20 OutcomeTokens per market
  SoothBook holds all baseToken custody itself
  SoothBook manages collateral directly

DEVELOP:
  SoothBook uses internal Position mapping (no ERC20 tokens)
  MatchingEngine holds all baseToken custody
  MatchingEngine handles token transfers during fills
  SoothBook calls MatchingEngine.fillOrder() for atomic settlement
  FeeRouter handles fee calculation for fills
```

#### Position Model

```solidity
// MAIN:
// OutcomeTokens are ERC20s, users hold token balances
// SoothBook tracks collateral in mapping
struct MarketInfo {
    address yesToken;      // ERC20 address
    address noToken;       // ERC20 address
    uint256 collateral;    // total USDC locked
    ...
}

// DEVELOP:
// Internal position tracking, NO ERC20 tokens
struct Position {
    uint256 yesShares;
    uint256 noShares;
}
mapping(bytes32 => mapping(address => Position)) private _positions;
```

#### Market Registration

```solidity
// MAIN: registerMarket deploys 2 OutcomeTokens
function registerMarket(address market, string memory name, ...) external onlyOwner
  // Creates YES and NO ERC20 OutcomeTokens
  // Sets up collateral tracking

// DEVELOP: registerMarketFromEngine — no token deployment
function registerMarketFromEngine(address market, address baseToken, uint256 initialPrice) external
  // Only callable by registrar
  // Registers in MatchingEngine
  // No token deployment (internal positions)
```

#### Settlement

```solidity
// MAIN: Users redeem ERC20 OutcomeTokens
// Requires Collateralizer for split/merge/redeem

// DEVELOP: Internal settlement
function settlePosition(address market, address user) external
  // Reads winning outcome from TruthMarket
  // Credits winning shares as baseToken
  // Via MatchingEngine.withdraw()

function redeemByKey(bytes32 marketKey) external nonReentrant
  // Market key version of settlement
```

---

### 4.5 FeeRouter.sol — NEW Contract (Pure Accounting)

```solidity
// Does NOT exist on main. Fee logic was inline in LaunchpadEngine.

contract FeeRouter is IFeeRouter, Ownable {
    // Configuration
    uint16 public preGradFeeBps = 500;       // 5% pre-graduation
    uint16 public postGradFeeBps = 100;       // 1% post-graduation
    uint16 public graduationBps = 10000;      // 100% of creator deposit

    // 4-way fee distribution (post-graduation):
    uint16 public bBaseShareBps = 5000;       // 50% → AMM liquidity growth
    uint16 public lpYieldShareBps = 3000;     // 30% → LP yield
    uint16 public adjudicatorShareBps = 1000; // 10% → adjudicator (NEW)
    uint16 public protocolShareBps = 1000;    // 10% → protocol treasury

    // Per-market fee state
    struct MarketFeeState {
        uint256 bBase;
        uint256 totalFees;
        uint256 bBaseGrowth;
        uint256 lpYieldAccrued;
        uint256 adjudicatorFeesAccrued;   // NEW (was not tracked on main)
        uint256 protocolFeesAccrued;
        bool isGraduated;
    }

    // Core function — called by AMMEngine and MatchingEngine
    function calculateAndDistributeFee(
        address market,
        uint256 baseCost,
        bool isBuy,
        address trader
    ) external returns (uint256 feeAmount, uint256 lpMintAmount)

    // View functions
    function getGraduationProgress(address market) → (feesAccrued, threshold, progressBps, isGraduated)
    function getFeeState(address market) → MarketFeeState
    function getAccruedFees(address market) → (adjudicatorFees, protocolFees, lpYield)
    function quoteFee(address market, uint256 baseCost, bool isBuy) → (feeAmount, feeBps)
}
```

**Graduation logic change:**

```
MAIN:   threshold = bBase × ln(2) × graduationMultiplier
DEVELOP: threshold = creatorDeposit × graduationBps / 10000
  (with graduationBps = 10000 meaning fees must equal creator deposit)
```

---

### 4.6 MatchingEngine.sol — NEW Contract (Token Custody for Orderbook)

```solidity
// Does NOT exist on main. SoothBook handled its own custody.

contract MatchingEngine is IMatchingEngine, Ownable, ReentrancyGuard {
    IERC20 public immutable baseToken;

    // Per-market state
    struct MarketState {
        bool registered;
        uint256 yesCollateral;    // total YES-side backing
        uint256 noCollateral;     // total NO-side backing
    }

    // Core function — atomic fill settlement
    function fillOrder(
        address market,
        address buyer,
        address seller,
        uint8 buyerOutcome,
        uint256 shares,
        uint256 price,
        uint256 buyerCost,
        uint256 sellerProceeds
    ) external onlySoothBook

    // Deposit/withdraw
    function deposit(address market, address from, uint256 baseUnits) external onlySoothBook
    function withdraw(address market, address to, uint256 baseUnits) external onlySoothBook

    // Deadline enforcement
    function requireBeforeDeadline(address market) external view

    // View
    function getCollateralBacking(address market) → (yes, no)
}
```

---

### 4.7 LaunchpadLPToken.sol — Dual Authorization

```solidity
// MAIN:
constructor(address _market, address _launchpadEngine, string name, string symbol)
modifier onlyLaunchpadEngine()  // only LaunchpadEngine can mint/burn

// DEVELOP:
constructor(address _market, address _launchpadEngine, address _ammEngine, string name, string symbol)
modifier onlyAuthorized()  // LaunchpadEngine OR AMMEngine can mint/burn
  // Because LP minting happens via FeeRouter → AMMEngine path
  // And LP burning happens in AMMEngine.redeemLP()
```

---

### 4.8 Adjudicator Hierarchy — NEW on Develop

```
MAIN:
  ValidatedAdjudicator (standalone, inherits Ownable)
    - Guardian stored in ProtocolConfig (global)
    - Settlement: settle() on TruthMarket → finalize()

DEVELOP:
  AdjudicatorBase (abstract)
    - Per-adjudicator guardian whitelist
    - addGuardian() / removeGuardian() / isGuardian()

  Adjudicator : AdjudicatorBase (abstract)
    - Reusable lifecycle: configure() → resolve() → (veto window) → settle()
    - Has vetoWindowDuration configuration

  (ValidatedAdjudicator — REMOVED from core 2026-03-19)
    - TEE/ERC-8004 attestation — expected to live in external adjudicator repo

  (ZkTLSAdjudicator — REMOVED from core 2026-03-19)
    - zkTLS proof verification — expected to live in external adjudicator repo

  AdjudicatorRegistry (NEW)
    - Whitelist of approved adjudicators
    - LaunchpadEngine checks this before allowing market creation
```

---

### 4.9 Collateralizer.sol — REMOVED

```
MAIN: Standalone contract for split/merge/redeem of ERC20 outcome tokens
  split(market, amount)  — 1 USDC → 1 YES + 1 NO token
  merge(market, amount)  — 1 YES + 1 NO → 1 USDC
  redeem(market, outcome, amount) — after settlement: winning token → USDC

DEVELOP: Functionality absorbed into SoothBook
  SoothBook.mint(marketKey, amount)   — equivalent of split (complete set creation)
  SoothBook.merge(marketKey, amount)  — equivalent of merge
  Settlement via settlePosition()     — equivalent of redeem
  No ERC20 tokens involved — internal position tracking
```

---

### 4.10 ProtocolConfig.sol — REMOVED

```
MAIN: Global configuration contract
  - Guardian management (addGuardian, removeGuardian, isGuardian)
  - Global pause (pause, unpause, isPaused)
  - Referenced by: AMMEngine, LaunchpadEngine, TruthMarket

DEVELOP: Functionality distributed
  - Guardian → per-adjudicator via AdjudicatorBase
  - Pause → local per-contract (LaunchpadEngine.pause())
  - No central config contract
```

---

### 4.11 OutcomeToken.sol — REMOVED

```
MAIN: ERC20 token for YES/NO outcomes
  - Deployed by Collateralizer per market
  - Users hold token balances
  - Required for orderbook (SoothBook) trading

DEVELOP: Eliminated
  - SoothBook uses internal Position { yesShares, noShares } mapping
  - No ERC20 transfer overhead
  - Positions are non-transferable ledger entries
```

---

### 4.12 TickBook System → SoothBook + MatchingEngine Transition

> The V9/V10 TickBook orderbook contracts lived in the old `packages/contracts-evm/` package (removed from the monorepo). They are not present in `contracts-core` on either branch, but the architectural transition is critical to understand.

#### Old Architecture (V9/V10 — `packages/contracts-evm/`)

```
TickBookPoolManager.sol  (1,686 lines)  — Singleton orderbook with flash accounting (EIP-1153)
TickBookVault.sol        (353 lines)    — Deposit/withdraw custody for orderbook users
DynamicFeeHook.sol       (334 lines)    — Hook-based dynamic fee system (13 callback points)
TransientDelta.sol       (254 lines)    — Transient storage library for flash accounting
ITickBook.sol                           — Core TickBook interface
ITickBookHooks.sol                      — Hooks interface (13 callbacks)
ITickBookVault.sol                      — Vault interface
```

#### New Architecture (Develop — `contracts-core`)

```
SoothBook.sol            (896 lines)    — Orderbook with 4 atomic actions (buyYes, buyNo, mint, merge)
MatchingEngine.sol       (285 lines)    — Token custody delegate for orderbook fills
```

#### Key Changes

| Aspect | TickBook (V9/V10) | SoothBook + MatchingEngine (Develop) |
|--------|-------------------|--------------------------------------|
| **Deployment** | Singleton PoolManager | Per-market registration in single SoothBook |
| **Custody** | TickBookVault (separate deposit/withdraw) | MatchingEngine (atomic per-fill) |
| **Tokens** | ERC20 OutcomeTokens (split/merge via Collateralizer) | Internal positions (mint/merge directly in SoothBook) |
| **Fees** | DynamicFeeHook (hook callbacks) | FeeRouter (direct call, shared with AMM) |
| **Flash accounting** | EIP-1153 transient storage (TSTORE/TLOAD) | Not used — atomic fills instead |
| **Order model** | Range orders + spot sells, tick bitmap | 4 actions: buyYes, buyNo, mint, merge |
| **Registration** | `registerMarket()` on PoolManager | `registerMarketFromEngine()` via LaunchpadEngine (post-graduation) |
| **User flow** | Deposit to vault → place order → claim fills → withdraw | Approve USDC → place order (atomic fill) |

#### Migration Impact

- **Frontend:** All `TickBookPoolManager` / `TickBookVault` hooks and ABIs are obsolete. Replace with SoothBook hooks.
- **SDK-Core:** 6 stale ABI exports to remove: `DynamicFeeHook`, `ITickBookHooks`, `TickBook`, `TickBookPoolManager`, `TickBookVault`, `TickBookVaultPoolManager`.
- **Keeper:** `POOL_MANAGER_ABI` and `VAULT_ABI` in `packages/keeper/src/config.ts` must be replaced.
- **Indexer:** TickBook events (order placed, filled, cancelled) replaced by SoothBook events.

---

## 5. Library Changes

| Library | Main | Develop | Change |
|---------|------|---------|--------|
| `LMSRMath.sol` | ✅ | ⚠️ imported but `src/libraries/` dir missing | Expected in `src/libraries/` — pending re-addition |
| `DecimalMath.sol` | ✅ | ⚠️ imported but `src/libraries/` dir missing | Expected in `src/libraries/` — pending re-addition |
| `TickBitmap.sol` | ✅ | ⚠️ imported by tests but `src/libraries/` dir missing | Expected in `src/libraries/` — pending re-addition |
| `TickMath.sol` | ✅ | ❌ **REMOVED** | Linear tick math eliminated |

> **Note — `TransientDelta.sol`:** This EIP-1153 transient storage library was part of the old `packages/contracts-evm/` TickBook system, not `contracts-core`. It is eliminated on develop — SoothBook uses atomic fills instead of flash accounting. See [§4.12](#412-tickbook-system--soothbook--matchingengine-transition).

### LMSRMath New Function

```solidity
// DEVELOP only:
function calculateInitialQuantities(uint256 b, uint256 probabilityWad)
    → (uint256 qYes, uint256 qNo)
  // Given desired YES probability and liquidity b,
  // calculates initial qYes and qNo quantities
  // Used by createMarket to set starting probability
```

---

## 6. Interface Changes

| Interface | Main | Develop | Change |
|-----------|------|---------|--------|
| `IAMMEngine.sol` | ✅ | ✅ | Major rewrite (added LP ops, settlement, fee claims; removed router pattern) |
| `ILaunchpadEngine.sol` | ✅ | ✅ | Slimmed (removed trade routing, fee config, dismiss/refund) |
| `ITruthMarket.sol` | ✅ | ✅ | New lifecycle (resolve/accept/settle/invalidate), removed question/guardian |
| `ISoothBook.sol` | ✅ | ❌ **REMOVED** | SoothBook on develop has no separate interface (concrete contract only) |
| `IFeeRouter.sol` | ❌ | ✅ | **NEW** |
| `IMatchingEngine.sol` | ❌ | ✅ | **NEW** — token custody interface (SoothBook calls this) |
| `IAdjudicatorRegistry.sol` | ❌ | ✅ | **NEW** |
| `ICollateralizer.sol` | ✅ | ❌ **REMOVED** | Collateralizer eliminated |
| `IProtocolConfig.sol` | ✅ | ❌ **REMOVED** | ProtocolConfig eliminated |
| `IAdjudicator.sol` | ✅ | ⚠️ referenced but not in `src/interfaces/` | Expected in external adjudicator package |
| `IERC8004.sol` | ✅ | ⚠️ referenced but not in `src/interfaces/` | Removed with ValidatedAdjudicator (2026-03-19) |

> **⚠️ Build status (2026-03-23):** Several contracts and interfaces (`TruthMarket.sol`, `SoothBook.sol`, `LaunchpadLPToken.sol`, `LMSRMath.sol`, `DecimalMath.sol`, `TickBitmap.sol`, `ITruthMarket.sol`, `IAMMEngine.sol`, `ILaunchpadEngine.sol`) are **imported by source files but missing from the repo**. `forge build` currently fails. This indicates sooth-core develop is in an intermediate refactoring state — these files may be pending extraction to separate packages or re-addition.

> **Note — TickBook interfaces:** `ITickBook.sol`, `ITickBookHooks.sol`, and `ITickBookVault.sol` were part of the old `packages/contracts-evm/` package, not `contracts-core`. They are eliminated on develop — SoothBook uses `IMatchingEngine` and `IFeeRouter` instead. SDK-Core still exports `ITickBookHooks` and must be cleaned up (see [§11](#11-integration-impact-sdk-core-packagessdk-core)).

---

## 7. Test Suite Comparison

### Main Branch

**Zero test files** in `packages/contracts-core/test/`. Tests were absent from the main branch contracts-core package.

### Develop Branch — 11 Test Files

> Verified against submodule commit `7659907a` (2026-03-23). Test files counted as `*.t.sol` under `test/`.
> **Note:** ValidatedAdjudicator, ZkTLSAdjudicator, and SettlementFlow tests were removed in the 2026-03-19 cleanup (adjudicator implementations moved outside core).

#### Unit Tests (7 files)

| File | Tests | What It Covers |
|------|-------|----------------|
| `unit/LaunchpadEngine.t.sol` | 6 tests | createMarket, nonce, trial period |
| `unit/TruthMarket.t.sol` | 24 tests | Full lifecycle (resolve/accept/settle/veto/invalidate), all edge cases |
| `unit/FeeRouter.t.sol` | 26 tests | Pre/post-grad fees, distribution, graduation trigger, config |
| `unit/LaunchpadLPToken.t.sol` | 11 tests | Minting, burning, settlement-locked transfers |
| `unit/RedeemLP.t.sol` | 14 tests | LP redemption at different market states, floor calculation |
| `unit/DeadlineTrading.t.sol` | 11 tests | Trading blocked after deadline, invalidation |
| `unit/TickBitmap.t.sol` | 5 tests | Bitmap set/unset/next discovery |

#### Integration Tests (3 files)

| File | Tests | What It Covers |
|------|-------|----------------|
| `integration/GraduationFlow.t.sol` | 3 tests | Full graduation via trading fees |
| `integration/SoothBookFlow.t.sol` | 12 tests | Orderbook flow: buy/sell/mint/merge/settle |
| `integration/TrialPeriodFlow.t.sol` | 5 tests | Trial expiration and trade blocking |

#### Invariant Tests (1 file)

| File | Tests | What It Covers |
|------|-------|----------------|
| `invariants/TrialPeriodInvariants.t.sol` | 3 invariants | Trial period state consistency |

#### Fork Tests (1 file)

| File | Tests | What It Covers |
|------|-------|----------------|
| `fork/LiveLaunchpad.t.sol` | 4 tests | Live contract interaction on Base Sepolia |

#### Test Mocks (3 files)

- `MockAMMEngine.sol` — Stub for testing LaunchpadEngine in isolation
- `MockFeeRouter.sol` — Stub for testing AMMEngine in isolation
- `MockUSDC.sol` — 18-decimal test token

#### Test Base (1 file)

- `base/TrialPeriodTestBase.sol` — Shared setup for trial period tests

---

## 8. Deploy Scripts & Tooling

### Main Branch Deploy Scripts

| File | Type | Purpose |
|------|------|---------|
| `DeploySoothBook.s.sol` | Forge | Standalone SoothBook deploy |
| `deploy-multichain.ts` | TypeScript/Bun | Main deploy orchestrator |
| `verify-deployment.ts` | TypeScript | Full verification |
| `create-*.ts` | TypeScript | Seed market creation (3 scripts) |
| `fix-base-market.ts` | TypeScript | Market maintenance |
| `graduate-base-market.ts` | TypeScript | Manual graduation |
| `multi-actor-test.sh` | Bash | On-chain multi-actor test |

### Develop Branch Deploy Scripts

| File | Type | Purpose | NEW? |
|------|------|---------|------|
| `deploy/DeployCore.s.sol` | Forge | **All 7 core contracts** in order with circular dep resolution | **NEW** |
| `deploy/DeployBase.s.sol` | Forge | Base helpers: CreateX CREATE3, salt computation, JSON config | **NEW** |
| `deploy/PredictAddresses.s.sol` | Forge | Pre-compute deterministic addresses | **NEW** |
| `deploy/SaltLib.sol` | Forge | Salt computation library | **NEW** |
| `deploy/ICreateX.sol` | Forge | CreateX factory interface | **NEW** |
| `VerifyContract.s.sol` | Forge | Per-contract verification | **NEW** |
| `VerifyDeployment.s.sol` | Forge | Full deployment verification | **NEW** |

> **Removed in 2026-03-19 cleanup:**
> - `deploy/DeployAdjudicator.s.sol` — ZkTLS stack removed
> - `adjudicators/CreateZkTLSMarket.s.sol` — ZkTLS stack removed
> - `deploy-multichain.ts`, `chainConfigs.ts` — legacy TS deploy orchestrator removed (use Forge scripts)
> - `create-*.ts`, `fix-base-market.ts`, `graduate-base-market.ts` — legacy market management scripts removed

### Key Deploy Changes

**CreateX CREATE3 deployment** (develop only):

```solidity
// All contracts deployed via CreateX for deterministic addresses across chains
// Salt = keccak256(abi.encodePacked(deployer, "sooth-core-v11", contractName))
// Same deployer + same salt = same address on every chain
```

**Circular dependency resolution** (DeployCore.s.sol):

```
1. Deploy MockUSDC (or use existing baseToken)
2. Deploy TruthMarket implementation (for cloning)
3. Deploy FeeRouter
4. Deploy AMMEngine (needs FeeRouter)
5. Deploy MatchingEngine
6. Deploy LaunchpadEngine (needs AMMEngine, FeeRouter, MatchingEngine, TruthMarketImpl)
7. Deploy SoothBook (needs MatchingEngine, FeeRouter)
8. Wire: FeeRouter.setAMMEngine(ammEngine)
9. Wire: FeeRouter.setMatchingEngine(matchingEngine)
10. Wire: AMMEngine.setProtocolTreasury(treasury)
```

### Interactive Testing Framework — REMOVED (2026-03-19)

> The `script/interactive/` directory containing the TypeScript CLI (interactive-test.ts, actors.ts, scenarios/, etc.) was removed as part of the legacy scripts cleanup. On-chain testing is now done via Forge test suites and manual `cast` commands.

---

## 9. Deployment Config & Addresses

### Config Files

```
MAIN: Per-chain deployment JSONs only
  deployments/baseSepolia.json
  deployments/monadTestnet.json
  deployments/monadMainnet.json
  deployments/megaethTestnet.json
  deployments/arcTestnet.json

DEVELOP: Per-chain configs (fee params) + single deployment JSON
  config/baseSepolia.json        ← NEW: fee params, RPC, gas config
  config/monadTestnet.json       ← NEW
  config/arcTestnet.json         ← NEW
  config/megaethTestnet.json     ← NEW
  deployments/baseSepolia_0.1.0.json  ← V11 via CreateX (FeeRouter/MatchingEngine architecture)
  (Note: legacy V12.0 deployment JSONs and monadTestnet.json were cleaned up)
```

### Contract Set Comparison

| Contract | Main Deployments | Develop Deployments |
|----------|-----------------|---------------------|
| MockUSDC | ✅ | ✅ |
| ProtocolConfig | ✅ | ❌ (in V12 JSON but **eliminated** from source) |
| Collateralizer | ✅ | ❌ (in V12 JSON but **eliminated** from source) |
| AMMEngine | ✅ | ✅ |
| SoothBook | ✅ | ✅ |
| LaunchpadEngine | ✅ | ✅ |
| FeeRouter | ❌ | ✅ (in `baseSepolia_0.1.0.json`) |
| MatchingEngine | ❌ | ✅ (in `baseSepolia_0.1.0.json`) |
| TruthMarketImpl | ❌ | ✅ (in `baseSepolia_0.1.0.json`) |
| AdjudicatorRegistry | ❌ | ✅ (in `baseSepolia_0.1.0.json`) |

**Note:** The `deployments/baseSepolia.json` on develop is the SAME V12.0 deployment from main (still references ProtocolConfig/Collateralizer). The new architecture deployment is in `baseSepolia_0.1.0.json` — this is the one that matches the develop source code.

---

## 10. Integration Impact: Frontend

### 10.0 `apps/soothsayer/` — Secondary Frontend (Needs Migration)

`apps/soothsayer/` is a separate Vite+React frontend app (currently untracked in git). It uses `@sooth/sdk-core` and references **main-branch ABIs and contract patterns**:

| Issue | Location | Detail |
|-------|----------|--------|
| Trades via LaunchpadEngine | `hooks/useAMMTrade.ts` | Must retarget to `AMMEngine.tradePositions()` |
| Quotes via LaunchpadEngine | `hooks/useAMMQuote.ts` | Uses both LaunchpadEngine and AMMEngine ABIs |
| Collateralizer reference | `hooks/useMarkets.ts` | `Collateralizer` removed on develop |
| TickBookPoolManager reference | `hooks/useMarkets.ts` | TickBook system eliminated |
| `isFinalized()` calls | `hooks/useMarkets.ts` | Must change to `isSettled()` (terminal) |
| `question()` string reads | `hooks/useMarkets.ts` | Must change to `questionHash()` + off-chain source |
| `trialState` reads | `hooks/useMarkets.ts` | Trial state model changed on develop |

**Recommendation:** Migrate `apps/soothsayer/` alongside `apps/web/` in Phase 3–4 of the checklist. Same contract call retargeting and lifecycle rename work applies.

### 10.1 `apps/web/src/` — Primary Frontend

### 10.1 Contract Call Targets Must Change

| Operation | Main Target | Develop Target | Files Affected |
|-----------|-------------|----------------|----------------|
| Trade (buy/sell shares) | LaunchpadEngine.tradePositions() | **AMMEngine.tradePositions()** | SimpleTradingPanel.tsx, useLaunchpadMarket.ts, sdk/commands/market.ts |
| Token approval for trading | approve(LaunchpadEngine) | **approve(AMMEngine)** | SimpleTradingPanel.tsx, trade hooks |
| Redeem LP tokens | LaunchpadEngine.redeemLP() | **AMMEngine.redeemLP()** | Portfolio.tsx, Trade.tsx, useLaunchpadMarket.ts |
| Settle AMM position | (manual via Collateralizer) | **AMMEngine.settlePosition()** | AMMSettlementCard.tsx |
| Read fee config | LaunchpadEngine.preGradFeeBps() | **FeeRouter.quoteFee()** | useLaunchpadMarket.ts, useLaunchpadMarketDirect.ts |
| Read graduation progress | LaunchpadEngine.getGraduationProgress() | **FeeRouter.getGraduationProgress()** | GraduationProgress.tsx (both versions) |
| Read protocol config | LaunchpadEngine.protocolConfig() | **REMOVED** | Create.tsx, Launchpad.tsx, Operator.tsx, hooks |
| Dismiss market | LaunchpadEngine.dismissMarket() | **REMOVED** | Create.tsx, useLaunchpadMarket.ts |
| Claim refund | LaunchpadEngine.claimRefund() | **REMOVED** | Portfolio.tsx, useLaunchpadMarket.ts |
| Read trial states | LaunchpadEngine.trialStates() | **REMOVED** (trial state in MarketState + computed) | useOnChainMarkets.ts, useLaunchpadMarketDirect.ts |
| Read guardian | TruthMarket.guardian() / ProtocolConfig.guardian() | **AdjudicatorBase.isGuardian()** | GuardianPanel.tsx, Operator.tsx, Gov.tsx |
| Read question text | TruthMarket.question() | **OFF-CHAIN** (questionHash on-chain) | useOnChainMarkets.ts, Pro.tsx, Trade.tsx |
| Check terminal state | TruthMarket.isFinalized() | **TruthMarket.isSettled()** | 14+ files |
| Check intermediate state | TruthMarket.isSettled() | **TruthMarket.isResolved()** | 14+ files |
| Check resolving state | TruthMarket.isSettling() | **TruthMarket.isResolving()** | GuardianPanel.tsx, SettlementPanel.tsx |
| Adjudicator settle | finalize() on adjudicator | **settle()** on adjudicator | SettlementPanel.tsx, adjudicator ABIs |
| Read balances | AMMEngine.getBalances(user) → (avail, locked) | **AMMEngine.getBalances(user) → (avail)** | useAvailableBalance.ts |
| Orderbook deposit | TickBookVault.depositUsdc() | **MatchingEngine.deposit()** (via SoothBook) | useTickBookVaultDirect.ts |
| Split tokens | Collateralizer.split() | **SoothBook.mint()** | Collateralizer hooks |
| Merge tokens | Collateralizer.merge() | **SoothBook.merge()** | Collateralizer hooks |

### 10.2 createMarket() Argument Changes

```typescript
// MAIN — frontend passes:
writeContract({
  address: contracts.LaunchpadEngine,
  abi: ABIS.LaunchpadEngine,
  functionName: 'createMarket',
  args: [question, startTime, deadline, adjudicator, guardian, initialLiquidity, agentId, minValidators]
})

// DEVELOP — frontend must pass:
writeContract({
  address: contracts.LaunchpadEngine,
  abi: ABIS.LaunchpadEngine,
  functionName: 'createMarket',
  args: [question, startTime, deadline, adjudicator, bBase, initialProbabilityWad]
  // guardian: REMOVED (per-adjudicator)
  // agentId: REMOVED
  // minValidators: REMOVED
  // bBase: renamed from initialLiquidity
  // initialProbabilityWad: NEW (e.g., 500000000000000000n for 50%)
})

// Return value changed:
// MAIN:    (address market, uint256 lpTokens)  — returns LP amount
// DEVELOP: (address market, address lpToken)   — returns LP token address
```

### 10.3 Lifecycle Display Text Changes

| Main UI Text | Develop UI Text |
|---|---|
| "Settling" | "Resolving" |
| "Settled" (intermediate) | "Resolved" |
| "Finalized" (terminal) | "Settled" (terminal) |
| "Dismissed" | **REMOVE** (concept eliminated) |

### 10.4 Files Requiring Changes (by priority)

**CRITICAL — Contract calls will revert:**

- `hooks/useTruthMarketDirect.ts` — calls `isFinalized()` (removed)
- `hooks/useOnChainMarkets.ts` — calls `isFinalized()`, `trialStates()` (removed)
- `hooks/useLaunchpadMarketDirect.ts` — calls `trialStates()`, `dismissMarket()`, `claimRefund()`, fee reads wrong contract
- `hooks/useLaunchpadMarket.ts` — `tradePositions()` on wrong contract, `redeemLP()` wrong contract
- `hooks/useLaunchpadFactory.ts` — `protocolConfig()` read, createMarket wrong args
- `hooks/useAvailableBalance.ts` — `getBalances()` expects 2 return values (now 1)
- `components/features/SimpleTradingPanel.tsx` — trades target LaunchpadEngine (must be AMMEngine)
- `pages/Create.tsx` — `protocolConfig()`, createMarket wrong args
- `pages/Launchpad.tsx` — `protocolConfig()`
- `pages/Portfolio.tsx` — `redeemLP` wrong target, `claimRefund` removed
- `config/abis.ts` — stale ABIs with removed functions
- `types.ts` — `MarketState`, `TruthMarket`, `DeployedContracts` all stale

**HIGH — Logic/display errors:**

- `pages/Pro.tsx` — 20+ lifecycle refs, trial UI, settlement
- `pages/Trade.tsx` — lifecycle display, trial, settlement
- `pages/Operator.tsx` — ProtocolConfig guardian, fee settings
- `pages/Gov.tsx` — guardian logic
- `components/features/AMMSettlementCard.tsx` — all lifecycle text
- `components/features/DismissedMarketPanel.tsx` — entire component obsolete → **DELETE**
- `components/features/GraduationProgress.tsx` — reads wrong contract for progress
- `components/features/GuardianPanel.tsx` — guardian model changed
- `components/features/SettlementPanel.tsx` — settle/finalize naming
- `components/features/launchpad/MarketDetailHeader.tsx` — lifecycle labels

**MEDIUM — Missing new integrations:**

- No `FeeRouter` hooks exist (need fee reads, graduation progress)
- No `MatchingEngine` hooks exist (need for OB deposits)
- No `AdjudicatorRegistry` hooks exist (need for market creation validation)
- `question()` → `questionHash()`: need off-chain source for question strings
- `config/bytecode.ts` — TruthMarket bytecode stale (now uses clones, not full deploy)

### 10.5 ABI Cleanup Required

| Legacy ABI in `config/abis.ts` | Status |
|---|---|
| `SOOTH_MARKET_ABI` | Dead (V7) → DELETE |
| `SOOTH_FEE_CONTROLLER_ABI` | Dead (V7) → DELETE |
| `TRADER_VAULT_V4_ABI` | Dead (V4) → DELETE — used by 8+ hooks that need rewrite |
| `GOVERNOR_VAULT_V4_ABI` | Dead (V4) → DELETE |
| `MARKET_V4_ABI` | Dead (V4) → DELETE — used by 3+ hooks |
| `PROTOCOL_CONFIG_ABI` | Dead → DELETE |
| `LAUNCHPAD_FACTORY_ABI` | Stale (has `protocolConfig()`, `usdc()`) → UPDATE or DELETE |
| `LAUNCHPAD_MARKET_ABI` | Stale (has `redeemLP`, `lockedProceeds`) → UPDATE or DELETE |
| `SOOTH_OPTIMISTIC_ADJUDICATOR_ABI` | Has `finalize()` → rename to `settle()` |

**New ABIs needed in frontend:**

- `FeeRouter` (from sdk-core)
- `MatchingEngine` (from sdk-core)
- `AdjudicatorRegistry` (from sdk-core)

---

## 11. Integration Impact: SDK-Core (`packages/sdk-core/`)

### ABIs Exported (need update check)

Currently exports (12 ABIs): `AMMEngine`, `Collateralizer`, `DynamicFeeHook`, `ITickBookHooks`, `LaunchpadEngine`, `OutcomeToken`, `TickBook`, `TickBookPoolManager`, `TickBookVault`, `TickBookVaultPoolManager`, `TruthMarket`

**Must add (4):** `FeeRouter`, `MatchingEngine`, `AdjudicatorRegistry`, `ZkTLSAdjudicator`

**Must remove or deprecate (8):**

| Export | Status | Reason |
|--------|--------|--------|
| `Collateralizer` | **REMOVE** | Contract eliminated — split/merge now in SoothBook |
| `OutcomeToken` | **REMOVE** | Contract eliminated — internal positions |
| `DynamicFeeHook` | **REMOVE** | TickBook hook system eliminated — fees now via FeeRouter |
| `ITickBookHooks` | **REMOVE** | TickBook hook interface eliminated |
| `TickBook` | **REMOVE** | Replaced by SoothBook |
| `TickBookPoolManager` | **REMOVE** | Replaced by SoothBook |
| `TickBookVault` | **REMOVE** | Replaced by MatchingEngine |
| `TickBookVaultPoolManager` | **REMOVE** | Replaced by MatchingEngine |

**Keep and update (3):** `AMMEngine` (major ABI changes), `LaunchpadEngine` (slimmed ABI), `TruthMarket` (lifecycle rename)

### Contract Helpers (`src/contracts/`)

| File | Functions | Issues |
|------|-----------|--------|
| `contracts/markets.ts` | `getMarketDetails` reads `question()`, `isFinalized()` | Must change to `questionHash()`, `isSettled()` |
| `contracts/amm.ts` | `getAmmMarketState`, `getAmmPosition` | Check ABI matches develop AMMEngine |
| `contracts/portfolio.ts` | Reads Collateralizer | Collateralizer removed — needs rewrite |
| `contracts/tickbook.ts` | Reads TickBookPoolManager | Check compatibility |

### Deployments Config (`src/config/deployments.ts`)

Must include new contract addresses:

- `FeeRouter`
- `MatchingEngine`
- `TruthMarketImpl`
- `AdjudicatorRegistry` (optional)

Must remove:

- `ProtocolConfig`
- `Collateralizer` (or mark legacy)

---

## 12. Integration Impact: Indexer (`packages/indexer/`)

### Events to Update

| Current Event (main) | Develop Event | Change |
|---|---|---|
| `MarketSettled(market, outcome, tStar)` | `MarketResolved(market, outcome, tStar)` | Renamed |
| `MarketFinalized(market, outcome)` | `MarketSettled(market)` | Renamed + different params |
| — | `MarketAccepted(market)` | NEW event |
| — | `MarketInvalidated(market)` | NEW event |
| `MarketDismissed(market)` | **REMOVED** | Dismiss eliminated |
| `RefundClaimed(market, user, amount)` | **REMOVED** | Refund eliminated |

### Schema Changes

```
// Remove:
isFinalized field → replaced by isSettled (terminal)
isDismissed field
trialEndTime field (compute from clone args if needed)

// Add:
isResolving field
isResolved field
questionHash field (bytes32, index for lookups)

// Rename:
isSettling → isResolving
"finalized" stage → "settled"
"settled" stage (intermediate) → "resolved"
```

### ABI Updates

The indexer ABIs (`packages/indexer/src/abis/`) need to match the develop contract event signatures. Key changes:

- TruthMarket events renamed
- LaunchpadEngine events: `MarketDismissed` and `RefundClaimed` removed
- AMMEngine events: `LockedBalanceReduced` removed, new LP/settlement events
- New FeeRouter events if any are indexed

---

## 13. Integration Impact: Keeper (`packages/keeper/`)

### Inline ABIs Stale

The keeper has hardcoded ABIs in `packages/keeper/src/config.ts` for:

- `POOL_MANAGER_ABI` (TickBookPoolManager)
- `LAUNCHPAD_ABI` (LaunchpadEngine)
- `COLLATERALIZER_ABI` (Collateralizer — **REMOVED from contracts**)
- `VAULT_ABI` (TickBookVault)
- `ERC20_ABI`

These must be updated to match develop contract ABIs. The Collateralizer reference must be removed or redirected to SoothBook.

### Stale Deployment Addresses

Keeper `baseSepolia` contract addresses differ from sdk-core/web deployments — likely pointing to V10.9 vintage contracts. Must be updated.

---

## 14. ABI Surface Changes

### Complete Function Rename/Move Map

```
CONTRACT FUNCTION MOVES:
  LaunchpadEngine.tradePositions()        → AMMEngine.tradePositions()
  LaunchpadEngine.tradePositionsFor()     → REMOVED (no router pattern)
  LaunchpadEngine.redeemLP()              → AMMEngine.redeemLP()
  LaunchpadEngine.increaseBBase()         → AMMEngine.increaseLiquidityFromCreator()
  LaunchpadEngine.setPreGradFeeBps()      → FeeRouter.setPreGradFee()
  LaunchpadEngine.setPostGradFeeBps()     → FeeRouter.setPostGradFee()
  LaunchpadEngine.setFeeSplits()          → FeeRouter.setFeeDistribution()
  LaunchpadEngine.setGraduationMultiplier() → FeeRouter.setGraduationBps()
  LaunchpadEngine.getGraduationProgress() → FeeRouter.getGraduationProgress()
  LaunchpadEngine.protocolConfig()        → REMOVED
  LaunchpadEngine.protocolTreasury()      → AMMEngine.protocolTreasury()
  LaunchpadEngine.dismissMarket()         → REMOVED
  LaunchpadEngine.claimRefund()           → REMOVED
  Collateralizer.split()                  → SoothBook.mint()
  Collateralizer.merge()                  → SoothBook.merge()
  Collateralizer.redeem()                 → AMMEngine.settlePosition() / SoothBook.settlePosition()

TRUTHMARKET RENAMES:
  settle(outcome, tStar)  → resolve(outcome, tStar)
  finalize()              → settle()
  isSettling()            → isResolving()
  isFinalized()           → REMOVED (isSettled() is now terminal)
  isSettled()             → isResolved() (⚠️ isSettled now means TERMINAL)
  question()              → questionHash() (returns bytes32 not string)
  guardian()              → REMOVED

AMMENGINE RETURN CHANGES:
  getBalances(user) → was (available, locked), now → (available) only
```

### Custom Errors (replaces all string requires)

All `"ContractName: error message"` strings are replaced with `error ErrorName()` custom errors. Error decoding in frontend must use ABI custom error decoding instead of string matching.

```solidity
// MAIN (error handling in frontend):
if (revertReason.includes("LaunchpadEngine: market not created")) { ... }

// DEVELOP (error handling in frontend):
// Must decode custom error from ABI:
// error MarketNotFound()
// error ZeroLiquidity()
// error NotApprovedAdjudicator()
// etc.
```

---

## 15. Migration Checklist

### Phase 1: Contract Build & Deploy

- [ ] Update submodule to latest sooth-core develop commit
- [ ] Verify `forge build` succeeds with solc 0.8.33
- [ ] Run `forge test` — all 15 test files pass
- [ ] Deploy new contracts via `DeployCore.s.sol` (or `deploy-multichain.ts`)
- [ ] Note: Deployment order matters due to circular dependencies
- [ ] Verify deployment via `VerifyDeployment.s.sol`
- [ ] Create seed markets via `2_CreateMarket.s.sol`

### Phase 2: SDK-Core Updates

- [ ] Add FeeRouter, MatchingEngine, AdjudicatorRegistry, ZkTLSAdjudicator ABIs to exports
- [ ] **Remove 8 stale ABI exports:** Collateralizer, OutcomeToken, DynamicFeeHook, ITickBookHooks, TickBook, TickBookPoolManager, TickBookVault, TickBookVaultPoolManager
- [ ] Update AMMEngine, LaunchpadEngine, TruthMarket ABIs to match develop
- [ ] Update `contracts/markets.ts`: `question()` → `questionHash()`, `isFinalized()` → `isSettled()`
- [ ] Update `contracts/portfolio.ts`: remove Collateralizer dependency
- [ ] Update `contracts/tickbook.ts`: rewrite for SoothBook API
- [ ] Update `config/deployments.ts`: add new contract addresses, remove ProtocolConfig

### Phase 3: Frontend — Critical (contract calls will fail)

- [ ] Update `types.ts` — DeployedContracts, MarketState, TruthMarket interfaces
- [ ] Clean `config/abis.ts` — remove all legacy ABIs, add FeeRouter/MatchingEngine
- [ ] Retarget trade routing: SimpleTradingPanel → AMMEngine
- [ ] Retarget LP operations: redeemLP → AMMEngine
- [ ] Fix lifecycle in all 14+ files: isFinalized→isSettled, isSettling→isResolving
- [ ] Fix createMarket args in Create.tsx, Launchpad.tsx, useLaunchpadFactory.ts
- [ ] Remove ProtocolConfig reads from all hooks/pages
- [ ] Remove trial dismiss/refund from all hooks/pages
- [ ] Fix getBalances() return value (2→1)
- [ ] Update token approval target (LaunchpadEngine→AMMEngine)

### Phase 4: Frontend — New Integrations

- [ ] Create `useFeeRouter.ts` hook for fee reads and graduation progress
- [ ] Solve question string display (off-chain source from MarketCreated event or indexer)
- [ ] Update GuardianPanel for per-adjudicator model
- [ ] Add AdjudicatorRegistry check to market creation flow
- [ ] Delete `DismissedMarketPanel.tsx`
- [ ] Update all lifecycle display text
- [ ] Update custom error decoding (string→custom errors)

### Phase 5: Indexer

- [ ] Update event ABIs to match develop contracts
- [ ] Rename event handlers: MarketSettled→MarketResolved, MarketFinalized→MarketSettled
- [ ] Add handlers for new events: MarketAccepted, MarketInvalidated
- [ ] Remove handlers: MarketDismissed, RefundClaimed
- [ ] Update schema for new lifecycle states

### Phase 6: Keeper

- [ ] Update inline ABIs in config.ts
- [ ] Remove Collateralizer references
- [ ] Update deployment addresses
- [ ] Verify keeper functions against new contract APIs

### Phase 7: Cleanup & Documentation

- [ ] Delete legacy V4 hooks (useLockedFunds, useAmmMarketById, etc.)
- [ ] Remove `config/bytecode.ts` (TruthMarket now deployed via clones)
- [ ] Remove `config/markets-megaeth.json` (legacy)
- [ ] Consolidate deployment configs (remove web's local deployments.json, use sdk-core only)
- [ ] **Update `AGENTS.md`**: `solc_version` 0.8.30 → 0.8.33, `optimizer_runs` 1 → 200
- [ ] **Update `.claude/rules/knowledge.md`**: Contract architecture, function signatures, error strings all changed
- [ ] Migrate `apps/soothsayer/` hooks/ABIs (same changes as `apps/web/`, see [§10.0](#100-appssoothsayer--secondary-frontend-needs-migration))
- [ ] Update AGENTS.md, knowledge.md, lessons.md for new architecture
