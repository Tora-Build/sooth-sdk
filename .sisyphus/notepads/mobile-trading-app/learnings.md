# Learnings

## Task 2: SDK-Core Extraction

### ABI Handling
- Web app's `abis/` directory has a MIX of raw JSON arrays (AMMEngine, LaunchpadEngine, TickBookPoolManager, TickBookVault, TruthMarket) and **Foundry artifacts** (Collateralizer, DynamicFeeHook, ITickBookHooks, OutcomeToken, TickBook, TickBookVaultPoolManager) that have `{abi, bytecode, ...}` structure
- Must extract `.abi` field from Foundry artifacts when converting to `as const` exports
- The web's `getAbi()` helper handled this dynamically; sdk-core does it at build time

### Module Resolution
- sdk-core uses `moduleResolution: "bundler"` — this works with Vite/web but NOT with Node.js direct imports (needs `.js` extensions for NodeNext)
- For mobile (Expo), bundler resolution should work fine since Metro handles it
- Runtime verification uses `tsx` which handles bundler-style imports

### Collateralizer API
- `getBalances(market, user)` — arg order is (market, user), NOT (user, market)
- No `availableBalance`/`lockedBalance` functions; the Collateralizer tracks outcome tokens per market

### TickBookPoolManager API  
- No `getCurrentTick` function; use `getMarketState(marketKey)` which returns `(tick, liqNo, liqYes, prob)`

### LMSR Outcome Mapping
- LMSR internal: outcomeIndex 0 = qYes modification, 1 = qNo modification
- Contract encoding: 0 = NO, 1 = YES
- So contract YES (1) → LMSR index 0, contract NO (0) → LMSR index 1
- `getQuoteForOutcome()` handles this mapping correctly

### Deployment Config
- 4 chains supported: baseSepolia (84532), monadTestnet (10143), megaethTestnet (6343), arcTestnet (5042002)
- Version: V11.1
- TickBook address = TickBookPoolManager address (same contract)
