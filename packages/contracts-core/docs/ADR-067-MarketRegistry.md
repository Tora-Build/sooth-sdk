# ADR-067: MarketRegistry — Single Source of Truth for Module Status Sync

**Date**: 2026-01-01
**Status**: Proposed (V9.9.7)
**Blocked by**: V9.9.6 bug fixes

---

## Architecture Flowchart

### Current Architecture (Distributed State)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CURRENT: Cross-Module Dependencies                   │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────┐
                              │ TruthMarket  │
                              │  (External)  │
                              │              │
                              │ • isLive()   │
                              │ • isSettled()│
                              └──────┬───────┘
                                     │ queries
        ┌────────────────────────────┼────────────────────────────┐
        │                            │                            │
        ▼                            ▼                            ▼
┌───────────────┐           ┌───────────────┐           ┌─────────────────┐
│  AMMEngine    │◄─────────►│LaunchpadEngine│──────────►│  Collateralizer │
│               │  router   │               │ graduation│                 │
│ • initialized │           │ • creator     │           │ • registered    │
│ • qYes/qNo    │           │ • isGraduated │           │ • yesToken      │
│ • liquidity   │           │ • bBase/bCurr │           │ • noToken       │
│               │           │ • feesAccrued │           │                 │
│               │           │ • allMarkets[]│           │                 │
└───────────────┘           └───────┬───────┘           └─────────────────┘
                                    │ graduation
                                    ▼
                            ┌───────────────┐
                            │ TickBookPool  │
                            │   Manager     │
                            │               │
                            │ • isActive    │
                            │ • marketKey   │
                            │ • tokens      │
                            └───────────────┘

  PROBLEMS:
  ┌────────────────────────────────────────────────────────────────────────┐
  │ 1. Each module tracks its own registration state (5 separate booleans) │
  │ 2. LaunchpadEngine sets isGraduated=true BEFORE module registrations   │
  │ 3. If TickBook fails, market is "half-graduated"                       │
  │ 4. Frontend needs 3-4 RPC calls to get complete status                 │
  │ 5. No single source of truth for market phase                          │
  └────────────────────────────────────────────────────────────────────────┘
```

### New Architecture (Central Registry)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      NEW: MarketRegistry as Central Hub                      │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────┐
                              │ TruthMarket  │
                              │  (External)  │
                              └──────┬───────┘
                                     │ isLive/isSettled
                                     ▼
                         ┌───────────────────────┐
                         │    MarketRegistry     │◄──── SINGLE SOURCE OF TRUTH
                         │                       │
                         │  • MarketPhase enum   │      Phases:
                         │  • allMarkets[]       │      ┌─────────────┐
                         │  • marketInfo mapping │      │ Unregistered│
                         │                       │      │      ↓      │
                         │  Query API:           │      │   Bonding   │
                         │  • getMarketInfo()    │      │      ↓      │
                         │  • getPhase()         │      │  Graduated  │
                         │  • canTradeAMM()      │      │      ↓      │
                         │  • canTradeTickBook() │      │   Settled   │
                         │  • getMarkets()       │      └─────────────┘
                         └───────────┬───────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │ reports              │ reports              │ reports
              ▼                      ▼                      ▼
     ┌───────────────┐      ┌───────────────┐      ┌─────────────────┐
     │  AMMEngine    │      │LaunchpadEngine│      │  Collateralizer │
     │               │      │               │      │                 │
     │ confirmInit() │      │registerMarket │      │confirmRegister()│
     │      │        │      │reportGraduat° │      │       │         │
     └──────┼────────┘      └───────┬───────┘      └───────┼─────────┘
            │                       │                      │
            └───────────────────────┼──────────────────────┘
                                    │ reports
                                    ▼
                            ┌───────────────┐
                            │ TickBookPool  │
                            │   Manager     │
                            │               │
                            │confirmRegist()│
                            └───────────────┘

  BENEFITS:
  ┌────────────────────────────────────────────────────────────────────────┐
  │ 1. Single MarketPhase enum replaces 5 separate booleans                │
  │ 2. Graduation updates registry AFTER all modules succeed               │
  │ 3. Atomic: all succeed or none updated                                 │
  │ 4. Frontend: ONE RPC call for complete status                          │
  │ 5. Modules report TO registry (not registry calling modules)           │
  └────────────────────────────────────────────────────────────────────────┘
```

### Graduation Flow Comparison

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GRADUATION FLOW: Before vs After                          │
└─────────────────────────────────────────────────────────────────────────────┘

BEFORE (Current - Non-Atomic):
══════════════════════════════

  LaunchpadEngine._distributeFee()
           │
           ▼
  ┌─────────────────────────────┐
  │ 1. isGraduated = true       │ ◄── State changes FIRST (dangerous!)
  │    graduatedAt = now        │
  └─────────────────────────────┘
           │
           ▼
  ┌─────────────────────────────┐
  │ 2. Collateralizer           │
  │    .registerMarket()        │ ◄── If this fails, isGraduated is already true
  └─────────────────────────────┘
           │
           ▼
  ┌─────────────────────────────┐
  │ 3. TickBook                 │
  │    .registerMarket()        │ ◄── If this fails, tokens exist but no orderbook
  └─────────────────────────────┘     Result: "HALF-GRADUATED" state


AFTER (With Registry - Atomic):
═══════════════════════════════

  LaunchpadEngine._distributeFee()
           │
           ▼
  ┌─────────────────────────────┐
  │ 1. Collateralizer           │
  │    .registerMarket()        │ ◄── External call FIRST
  │    → returns (yes, no)      │
  └─────────────────────────────┘
           │ success
           ▼
  ┌─────────────────────────────┐
  │ 2. TickBook                 │
  │    .registerMarket()        │ ◄── External call SECOND
  │    → returns marketKey      │
  └─────────────────────────────┘
           │ success
           ▼
  ┌─────────────────────────────┐
  │ 3. NOW update state:        │ ◄── State changes LAST (safe!)
  │    isGraduated = true       │
  │    graduatedAt = now        │
  │                             │
  │ 4. Report to registry:      │
  │    registry.reportGraduation│
  │    (market, yes, no, key)   │
  └─────────────────────────────┘

  If ANY step fails → transaction reverts → NO state changed
```

### Frontend Query Comparison

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FRONTEND QUERIES: Before vs After                         │
└─────────────────────────────────────────────────────────────────────────────┘

BEFORE (Current - Multiple RPC Calls):
═══════════════════════════════════════

  Frontend                          Contracts
     │
     ├──► LaunchpadEngine.markets(addr)          ──► isGraduated, creator, bBase
     │
     ├──► LaunchpadEngine.getGraduationProgress()──► progressBps, threshold
     │
     ├──► Collateralizer.getOutcomeTokens()      ──► yesToken, noToken
     │                                                (fails if pre-graduation!)
     ├──► TickBook.getMarketInfo(key)            ──► isActive, tokens
     │
     └──► TruthMarket.isLive()                   ──► live status

  Total: 4-5 RPC calls + workaround for stale data:
  ┌──────────────────────────────────────────────────────────────────┐
  │ // useLaunchpadMarketDirect.ts:81                                │
  │ const isEffectiveGraduated = isGraduated ||                      │
  │   (!!progressBps && progressBps >= 10000n);  // Defensive check! │
  └──────────────────────────────────────────────────────────────────┘


AFTER (With Registry - Single RPC Call):
════════════════════════════════════════

  Frontend                          Contracts
     │
     └──► MarketRegistry.getMarketInfo(addr)     ──► Complete MarketInfo struct:
                                                     {
                                                       phase: Graduated,
                                                       creator: 0x...,
                                                       yesToken: 0x...,
                                                       noToken: 0x...,
                                                       tickBookMarketKey: 0x...,
                                                       ammInitialized: true,
                                                       collateralizerRegistered: true,
                                                       tickBookRegistered: true,
                                                       createdAt: 1735...,
                                                       graduatedAt: 1735...,
                                                       name: "...",
                                                       symbol: "..."
                                                     }

  Total: 1 RPC call, no workarounds needed
```

### Module Communication Pattern

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MODULE COMMUNICATION PATTERN                              │
└─────────────────────────────────────────────────────────────────────────────┘

                           ┌─────────────────────┐
                           │   MarketRegistry    │
                           │                     │
                           │  Authorized Callers:│
                           │  • LaunchpadEngine  │ ─── lifecycle events
                           │  • AMMEngine        │ ─── confirmations
                           │  • Collateralizer   │ ─── confirmations
                           │  • TickBook         │ ─── confirmations
                           └──────────┬──────────┘
                                      │
         ┌────────────────────────────┼────────────────────────────┐
         │                            │                            │
         │                            │                            │
    LIFECYCLE                   CONFIRMATIONS                  QUERIES
    (write)                       (write)                      (read)
         │                            │                            │
         ▼                            ▼                            ▼
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│ LaunchpadEngine │         │    Modules      │         │    Frontend     │
│                 │         │                 │         │                 │
│ registerMarket()│         │ confirmAMMInit()│         │ getMarketInfo() │
│ reportGraduat°()│         │ confirmCollat°()│         │ getPhase()      │
│ reportSettlem°()│         │ confirmTickBook()         │ canTradeAMM()   │
└─────────────────┘         └─────────────────┘         │ getMarkets()    │
                                                        └─────────────────┘

Trading paths (tradePositions, placeOrder) do NOT touch registry
→ Zero gas overhead on hot path
```

---

## Problem Statement

Current V9 architecture has 5 modules tracking market state independently:
- **LaunchpadEngine**: creator, isGraduated, bBase, feesAccrued, allMarkets[]
- **AMMEngine**: initialized, qYes/qNo, liquidity
- **Collateralizer**: registered, yesToken, noToken
- **TickBookPoolManager**: isActive, marketKey, tokens
- **TickBookVault**: implicit via collateral

**Key issues:**
1. Graduation atomicity failure (LaunchpadEngine:414-435) - `isGraduated=true` before Collateralizer/TickBook registration
2. Frontend needs 3-4 RPC calls to get complete market status
3. Stale RPC workarounds (`isEffectiveGraduated` in useLaunchpadMarketDirect.ts:81)
4. No bidirectional validation between modules

## Design Decisions (User Confirmed)

1. **Registry TRACKS state** - modules call registry to report their registration (not registry calling modules)
2. **Start fresh** - existing 10 Base Sepolia markets grandfathered, only new markets use registry
3. **Replace allMarkets** - registry becomes canonical market list, remove from LaunchpadEngine

---

## Implementation Plan

### Step 1: Create IMarketRegistry Interface

**File:** `packages/contracts-core/src/interfaces/IMarketRegistry.sol`

```solidity
interface IMarketRegistry {
    enum MarketPhase { Unregistered, Bonding, Graduated, Settled, Invalid }

    struct MarketInfo {
        address truthMarket;
        address creator;
        address yesToken;
        address noToken;
        MarketPhase phase;
        uint64 createdAt;
        uint64 graduatedAt;
        uint64 settledAt;
        bool ammInitialized;
        bool collateralizerRegistered;
        bool tickBookRegistered;
        bytes32 tickBookMarketKey;
        string name;
        string symbol;
    }

    // Lifecycle (called by LaunchpadEngine)
    function registerMarket(address market, address creator, string calldata name, string calldata symbol) external;
    function reportGraduation(address market, address yesToken, address noToken, bytes32 tickBookKey) external;
    function reportSettlement(address market) external;

    // Module confirmations
    function confirmAMMInit(address market) external;
    function confirmCollateralizerRegistration(address market, address yes, address no) external;
    function confirmTickBookRegistration(address market, bytes32 marketKey) external;

    // Queries (frontend-optimized)
    function getMarketInfo(address market) external view returns (MarketInfo memory);
    function getPhase(address market) external view returns (MarketPhase);
    function canTradeAMM(address market) external view returns (bool);
    function canTradeTickBook(address market) external view returns (bool);
    function canRedeem(address market) external view returns (bool);
    function getOutcomeTokens(address market) external view returns (address yes, address no);
    function getMarkets() external view returns (address[] memory);
    function getMarketCount() external view returns (uint256);
}
```

### Step 2: Create MarketRegistry Contract

**File:** `packages/contracts-core/src/MarketRegistry.sol`

Key features:
- Single storage for all market lifecycle state
- Authorized callers: LaunchpadEngine (lifecycle), AMMEngine/Collateralizer/TickBook (confirmations)
- Phase enumeration arrays for efficient filtering
- Live settlement check via ITruthMarket.isSettled()

### Step 3: Modify LaunchpadEngine

**File:** `packages/contracts-core/src/LaunchpadEngine.sol`

Changes:
1. Add `IMarketRegistry public immutable registry` in constructor
2. Remove `address[] public allMarkets` storage
3. Remove `getMarkets()` and `getMarketCount()` (delegate to registry)
4. Modify `createMarket()`:
   ```solidity
   // After internal state setup
   registry.registerMarket(market, msg.sender, name, symbol);
   ```
5. Modify `_distributeFee()` graduation block (lines 413-439):
   ```solidity
   if (feesInWad >= graduationThreshold) {
       // Step 1: Register tokens in Collateralizer
       (address yes, address no) = collateralizer.isMarketRegistered(market)
           ? collateralizer.getOutcomeTokens(market)
           : collateralizer.registerMarket(market, state.name, state.symbol);

       // Step 2: Register in TickBook
       (,, uint256 ammProbability) = ammEngine.getMarketState(market);
       bytes32 marketKey;
       try tickBook.registerMarket(market, yes, no, ammProbability, defaultHook) returns (bytes32 key) {
           marketKey = key;
       } catch (bytes memory reason) {
           bytes4 duplicateMarketSelector = 0xedd7c146;
           if (reason.length < 4 || bytes4(reason) != duplicateMarketSelector) {
               revert("LaunchpadEngine: tickbook register failed");
           }
       }

       // Step 3: ONLY NOW update local state AND report to registry
       state.isGraduated = true;
       state.graduatedAt = uint64(block.timestamp);
       registry.reportGraduation(market, yes, no, marketKey);

       emit MarketGraduated(market, state.feesAccrued, block.timestamp);
   }
   ```

### Step 4: Add Module Confirmations (Optional Enhancement)

For bidirectional validation, modules can confirm their registration:
- `AMMEngine.initializeMarket()` → calls `registry.confirmAMMInit(market)`
- `Collateralizer.registerMarket()` → calls `registry.confirmCollateralizerRegistration()`
- `TickBook.registerMarket()` → calls `registry.confirmTickBookRegistration()`

**Decision:** Implement as optional - registry tracks what LaunchpadEngine reports, modules can confirm for extra validation.

### Step 5: Frontend Integration

**New file:** `apps/web/src/hooks/useMarketRegistry.ts`

```typescript
export function useMarketRegistry(marketAddress: Address) {
  // Single RPC call for complete market state
  return useDirectRead({
    queryKey: ["marketRegistry", chainId, marketAddress],
    read: async (client) => {
      const info = await client.readContract({
        address: registryAddress,
        abi: MarketRegistryABI,
        functionName: "getMarketInfo",
        args: [marketAddress],
      });
      return {
        phase: info.phase,
        canTradeAMM: info.phase === 1 || info.phase === 2,
        canTradeTickBook: info.phase === 2,
        isGraduated: info.phase >= 2,
        ...info
      };
    },
  });
}

export function useOnChainMarkets() {
  // Replace LaunchpadEngine.getMarkets() with registry
  return useDirectRead({
    queryKey: ["marketRegistry", "allMarkets"],
    read: async (client) => {
      return client.readContract({
        address: registryAddress,
        abi: MarketRegistryABI,
        functionName: "getMarkets",
        args: [],
      });
    },
  });
}
```

**Deprecate:** Remove graduation workaround from `useLaunchpadMarketDirect.ts`:
```typescript
// DELETE THIS:
const isEffectiveGraduated = isGraduated || (!!progressBps && progressBps >= 10000n);
```

### Step 6: Update Deployment Scripts

**File:** `packages/contracts-core/script/1_DeployCore.s.sol`

Add MarketRegistry to deployment order:
1. Deploy MarketRegistry
2. Deploy Collateralizer, AMMEngine, TickBookVault, TickBookPoolManager
3. Deploy LaunchpadEngine (pass registry address)
4. Set LaunchpadEngine as authorized caller on MarketRegistry

### Step 7: Update ABIs and Config

- Generate `MarketRegistry.json` ABI
- Add to `apps/web/src/config/abis.ts`
- Add `MarketRegistry` address to `deployments/v9-*.json`

---

## Files to Create

| File | Purpose |
|------|---------|
| `packages/contracts-core/src/interfaces/IMarketRegistry.sol` | Interface |
| `packages/contracts-core/src/MarketRegistry.sol` | Implementation |
| `packages/contracts-testing/test/v9/MarketRegistry.t.sol` | Tests |
| `apps/web/src/hooks/useMarketRegistry.ts` | Frontend hook |

## Files to Modify

| File | Changes |
|------|---------|
| `packages/contracts-core/src/LaunchpadEngine.sol` | Add registry, remove allMarkets, update graduation flow |
| `packages/contracts-core/src/interfaces/ILaunchpadEngine.sol` | Remove getMarkets/getMarketCount |
| `packages/contracts-core/script/1_DeployCore.s.sol` | Deploy registry, pass to LaunchpadEngine |
| `apps/web/src/hooks/useOnChainMarkets.ts` | Point to registry instead of LaunchpadEngine |
| `apps/web/src/hooks/useLaunchpadMarketDirect.ts` | Remove graduation workaround |
| `apps/web/src/config/abis.ts` | Add MarketRegistry ABI |

---

## Testing Strategy

1. **Unit tests** (`MarketRegistry.t.sol`):
   - Phase transitions: Unregistered → Bonding → Graduated → Settled
   - Authorization: only LaunchpadEngine can register/graduate
   - Query functions return correct data

2. **Integration tests**:
   - Full flow: create market → trade → graduate → verify registry state
   - Graduation atomicity: if TickBook fails, registry not updated

3. **Fork tests**:
   - Verify existing markets (grandfathered) still work
   - New markets use registry correctly

---

## Rollout Plan

1. **V9.9.7**: Deploy MarketRegistry alongside existing contracts
2. New markets created via LaunchpadEngine automatically registered
3. Existing 10 markets continue to work (grandfathered)
4. Frontend uses registry for new markets, falls back to LaunchpadEngine for old

---

## Gas Impact

- `registerMarket()`: ~70k gas (new cost, but createMarket already costs ~200k)
- `reportGraduation()`: ~50k gas (replaces some of current graduation overhead)
- `getMarketInfo()`: ~8k gas (single SLOAD + struct copy)
- **Trading paths: NO CHANGE** (registry not called during trades)

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| LaunchpadEngine upgrade required | Fresh deployment on testnets (alpha phase) |
| Frontend coordination | Fallback logic for grandfathered markets |
| Registry becomes SPOF | Simple stateless design, minimal logic |
