# Sooth Mobile Trading App (Expo + Privy)

## TL;DR

> **Quick Summary**: Build a consumer-oriented mobile prediction market trading app using Expo (iOS-first) with Privy embedded wallet. Extract shared contract logic from the web app into `@sooth/sdk-core`, then build an Instagram Stories-inspired mobile UI for market discovery, AMM trading, simplified TickBook market orders, and basic portfolio.
>
> **Deliverables**:
> - Extended `packages/sdk-core` with ABIs, contract read functions, and LMSR math
> - `apps/mobile` Expo project with Privy auth, market cards, trading, and portfolio
> - Stories-style vertical swipe navigation with vibrant social UI
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Task 1 (Spike) → Task 2 (SDK extraction) → Task 3 (Expo setup) → Tasks 4-6 (screens, parallel) → Task 7 (polish)

---

## Context

### Original Request
Build a mobile trading app for Sooth Protocol. Consumer-oriented, social/fun, Instagram Stories-inspired. Reuse logic from the existing web app.

### Interview Summary
**Key Discussions**:
- **Platform**: Expo managed workflow, iOS-first
- **Wallet**: Privy embedded wallet — social login (Google/Apple/email), no app switching
- **Trading**: AMM buy/sell + simplified TickBook (market orders only, ticks 1-999)
- **Design**: Full-screen cards, swipe navigation, vibrant gradients, social energy
- **Code sharing**: Extract hooks/logic into `@sooth/sdk-core`, NOT a new `packages/shared`
- **Chain**: Base Sepolia only (chain ID 84532) for V1
- **Portfolio**: Basic positions + values + redeem. No P&L charts.
- **Project location**: `apps/mobile` in monorepo

**Research Findings**:
- `@sooth/sdk-core` already exists with types, utils, errors — extend it, don't create new package
- 54 hooks in `apps/web/src/hooks/` — most are wagmi-dependent, not directly portable
- The "Direct" hooks (useAMMQuoteDirect, etc.) use `useDirectRead` wrapping React Query + viem — the **read logic** (contract, function, args) is extractable, not the hooks themselves
- ABIs are in `apps/web/src/config/abis/` (11 JSON files) — must move to sdk-core
- MockUSDC is 18 decimals on testnet (WAD throughout). However, `apps/web/src/types.ts` defines `USDC_DECIMALS = 6` with `wadToUsdc`/`usdcToWad` converters for production USDC. **Policy for mobile**: always read `decimals()` at runtime from MockUSDC contract; internally use WAD (1e18) for all math/quotes; convert at display boundaries using the runtime-read decimals. In sdk-core, create **parameterized** helpers `wadToTokenUnits(wad, tokenDecimals)` and `tokenUnitsToWad(units, tokenDecimals)` rather than reusing the hardcoded 6-decimal `wadToUsdc`/`usdcToWad` from `apps/web/src/types.ts`. On Base Sepolia testnet where MockUSDC is 18 decimals, the WAD↔token conversion is effectively a no-op.

### Canonical Outcome Encoding Source of Truth
**`apps/web/src/types.ts`** is the authoritative source for outcome encoding: `0=NO, 1=YES, 2=INVALID`. If any inline comments in other files (e.g., `useAMMQuoteDirect.ts` or `lmsr.ts`) appear to contradict this, ignore those comments — `types.ts` and `AGENTS.md` are canonical.

### Metis Review
**Critical Finding**: Privy + viem + BigInt compatibility in Expo/Hermes must be validated FIRST via a spike. If any fails, the entire architecture changes.

**Identified Gaps** (addressed):
- `sdk-core` already exists — plan uses it instead of creating new package
- Web hooks are wagmi-coupled — plan extracts pure contract-read functions, not hooks
- BigInt in Hermes engine — added validation spike as Task 1
- Token approval flow — included in trading task
- Empty states / edge cases — included in UI tasks

---

## Work Objectives

### Core Objective
Ship a functional mobile trading app that lets users discover prediction markets, trade YES/NO outcomes via AMM and market orders, and view their portfolio — all with social login and no wallet app switching.

### Concrete Deliverables
- `packages/sdk-core/src/abis/` — All 11 contract ABIs
- `packages/sdk-core/src/contracts/` — Pure contract read/write functions
- `packages/sdk-core/src/math/lmsr.ts` — LMSR pricing math
- `packages/sdk-core/src/config/deployments.ts` — Chain deployments
- `apps/mobile/` — Expo project with:
  - Privy social login (Google/Apple/email)
  - Market discovery (vertical swipe cards)
  - AMM trading (buy/sell YES/NO)
  - Market order execution (TickBook, ticks 1-999)
  - Portfolio (positions, values, redeem)

### Definition of Done
- [x] `cd packages/sdk-core && pnpm build` succeeds
- [x] `cd apps/web && pnpm build` succeeds (no regressions from extraction)
- [ ] `cd apps/mobile && npx expo start` launches iOS simulator
- [ ] User can sign in with Privy (social login)
- [ ] User can view market cards and swipe between them
- [ ] User can execute an AMM buy on Base Sepolia
- [ ] User can view positions in portfolio
- [ ] User can redeem finalized positions (redeem button only shown for `stage === 'finalized'`)

### Must Have
- Privy social login (at least email + one social provider)
- Market card display with question, price, volume
- AMM buy/sell execution with amount input
- Market order execution on TickBook
- USDC approval flow (first-time user)
- Portfolio positions list with current values
- Redeem button for finalized markets (gated on `stage === 'finalized'`; settled-but-not-finalized shows outcome badge but disables redeem)
- Base Sepolia chain pinned (no chain switching)

### Must NOT Have (Guardrails)
- Limit orders or range orders
- LP management or market creation
- Multi-chain support or chain switching UI
- Search, filters, or categories in market discovery
- P&L charts, trade history, or analytics
- Push notifications or social features
- Settings, profile editing, or account management
- Animations beyond card swipe transition
- Orderbook visualization
- wagmi in mobile app (unless Privy Expo explicitly provides adapters)
- New `packages/shared` — use `sdk-core`
- Copy-pasting web hooks — extract logic layer first
- Landscape mode — portrait locked

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: NO (new Expo project)
- **User wants tests**: Manual verification for V1 (mobile app)
- **Framework**: Expo build + manual device testing + cast verification

### Automated Verification Approach
Each task uses a mix of:
- `pnpm build` / `npx expo start` for build verification
- `cast call` for on-chain state verification
- Expo simulator for UI verification (screenshot where applicable)

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
└── Task 1: Validation Spike (Privy + viem + BigInt in Expo)

Wave 2 (After Spike Succeeds):
├── Task 2: SDK-core extraction (ABIs, contracts, math, deployments)
│   └── Task 2b: Verify web app still builds after extraction

Wave 3 (After SDK-core ready):
├── Task 3: Expo project setup + Privy auth

Wave 4 (After Expo + Auth working):
├── Task 4: Market Discovery screen (parallel with 5)
├── Task 5: Trading Flow screen (parallel with 4)
└── Task 6: Portfolio screen (parallel with 4, 5)

Wave 5 (After all screens):
└── Task 7: Stories UI polish + edge cases
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 2, 3, 4, 5, 6, 7 | None |
| 2 | 1 | 3, 4, 5, 6 | None |
| 3 | 2 | 4, 5, 6 | None |
| 4 | 3 | 7 | 5, 6 |
| 5 | 3 | 7 | 4, 6 |
| 6 | 3 | 7 | 4, 5 |
| 7 | 4, 5, 6 | None | None |

---

## TODOs

- [x] 1. Validation Spike: Privy + viem + BigInt in Expo

  **What to do**:
  - Create minimal Expo project (throwaway, in `/tmp/sooth-spike` or similar)
  - Install `@privy-io/expo`, `viem`, verify they resolve
  - Verify BigInt works in Hermes engine: `const x = 1000000000000000000n; console.log(x.toString())`
  - Verify viem client creation: `createPublicClient({ chain: baseSepolia, transport: http() })`
  - Verify Privy embedded wallet can sign a message
  - Verify `client.readContract()` works (read MockUSDC.decimals())
  - Document: which Privy APIs give us a viem WalletClient? Does Privy Expo support wagmi adapters?
  - If ANY of the above fails, document the failure and STOP — the architecture needs revisiting
  - Write results to `.sisyphus/spike-results.md` (this file WILL be committed to repo so Task 3 can reference it)

  **Must NOT do**:
  - Build any real app screens
  - Spend time on UI
  - The Expo project itself is throwaway (in `/tmp`), but the spike-results.md file goes in the repo

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Technical investigation requiring Expo + crypto library expertise
  - **Skills**: [`research-assistant`]
    - `research-assistant`: Need to research Privy Expo SDK docs and verify compatibility

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1 (solo)
  - **Blocks**: Tasks 2-7
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `apps/web/src/config/deployments.json` — Base Sepolia contract addresses and chain config
  - `packages/sdk-core/src/utils.ts` — Existing utility functions (e.g., `computeMarketKey`)
  - `packages/sdk-core/src/types.ts` — WAD constant (`export const WAD = ...`) and type definitions

  **External References**:
  - Privy Expo SDK: https://docs.privy.io/guide/expo/
  - viem docs: https://viem.sh/docs/getting-started
  - Hermes BigInt support: BigInt is supported in Hermes 0.70+ (React Native 0.70+). Expo SDK 49+ uses Hermes by default. Verify with: `typeof 1n === 'bigint'` in the spike app.

  **Acceptance Criteria**:

  ```bash
  # Agent runs in /tmp/sooth-spike:
  npx expo start --ios
  # Verify: app launches in iOS simulator without crash

  # In-app console (or test file):
  # 1. BigInt: const x = 1000000000000000000n; assert(x.toString() === "1000000000000000000")
  # 2. viem (imports: `import { createPublicClient, http, erc20Abi } from 'viem'` and `import { baseSepolia } from 'viem/chains'`):
  #    const client = createPublicClient({ chain: baseSepolia, transport: http() });
  #    const decimals = await client.readContract({ address: '0xb4f46ed670ed6c4cf422ea61e06961d64a753e9d', abi: erc20Abi, functionName: 'decimals' });
  #    assert(decimals === 18)
  # 3. Privy: user taps "Login with email" → embedded wallet address displayed

  # Document findings in .sisyphus/spike-results.md (committed to repo for Task 3 reference):
  # - BigInt: PASS/FAIL
  # - viem readContract: PASS/FAIL
  # - Privy login: PASS/FAIL
  # - Privy WalletClient access method: [document API]
  # - Privy wagmi adapter available: YES/NO
  ```

  **Commit**: YES (spike-results.md only)
  - Message: `docs: add Expo + Privy + viem spike results`
  - Files: `.sisyphus/spike-results.md`

---

- [x] 2. Extend `@sooth/sdk-core` with ABIs, Contract Functions, Math, and Deployments

  **What to do**:
  - **ABI migration sequence** (must follow this exact order):
    1. COPY all 11 ABI JSON files from `apps/web/src/config/abis/` to `packages/sdk-core/src/abis/`
    2. Create `packages/sdk-core/src/abis/index.ts` exporting all ABIs as typed constants
    3. **Convert JSON ABIs to `.ts` files** exporting `export const XxxABI = [...] as const`. This avoids all JSON-in-ESM complexity (no `resolveJsonModule`, no import assertions, no asset-copy step). Each ABI gets a `.ts` file that `tsc` emits directly to `dist/`. Example: `packages/sdk-core/src/abis/LaunchpadEngine.ts` exports `export const LaunchpadEngineABI = [{...}] as const`.
    4. Verify: `cd packages/sdk-core && pnpm build` passes
    5. Update `apps/web/src/config/abis.ts` to import from `@sooth/sdk-core` instead of `./abis/*.json`
    6. Verify: `cd apps/web && pnpm build` passes
    7. Only THEN delete original JSON files from `apps/web/src/config/abis/`
    8. Verify: both packages still build
  - Move `apps/web/src/config/deployments.json` content to `packages/sdk-core/src/config/deployments.ts` (typed, with chain ID mapping)
  - Extract LMSR math from `apps/web/src/utils/lmsr.ts` to `packages/sdk-core/src/math/lmsr.ts` (pure functions, no React). NOTE: This is **number-based** (uses `Math.exp`, `Math.log`), NOT BigInt. Do NOT convert to BigInt during extraction. This is intentional — LMSR pricing uses floating point for exp/log.
    - **Mobile LMSR usage policy**: Mobile should use LMSR math ONLY for market card price display (YES probability badge). For actual trade quoting, use `AMMEngine.getPositionQuote(market, outcome, deltaShares)` on-chain call (see `apps/web/src/hooks/useAMMQuoteDirect.ts`). This avoids any outcome-mapping confusion between LMSR internal indices and contract encoding.
    - **LMSR outcome mapping note (CRITICAL — read carefully)**:
      - `calculateLMSRCost(qYes, qNo, b)`: pure math, no outcome encoding. Pass YES quantities first, NO second.
      - `getLMSRQuote({currentQYes, currentQNo, b, delta, outcomeIndex})`: **outcomeIndex is INVERTED from contract encoding**. In this function: `outcomeIndex=0` modifies `qYes`, `outcomeIndex=1` modifies `qNo` (see `apps/web/src/utils/lmsr.ts:24-39`). This is the opposite of contract encoding (contract: 0=NO, 1=YES).
      - **For sdk-core export**: Create a wrapper `getQuoteForOutcome(params: { currentQYes: number, currentQNo: number, b: number, delta: number }, contractOutcome: 0 | 1): { cost: number, newPrice: number }` that maps contract encoding (0=NO,1=YES) to LMSR internal index (0=YES,1=NO) internally. This is the REQUIRED approach (not optional). Also re-export the raw `getLMSRQuote` with a `@deprecated` JSDoc tag pointing to `getQuoteForOutcome`.
      - **Mobile should prefer on-chain `getPositionQuote`** for trade quoting (avoids this mapping entirely). LMSR math is only for market card price display where you use `calculateLMSRCost` directly (no outcome mapping needed for probability calculation).
    - **LMSR inputs/units**: `qYes`, `qNo`, and `b` come from `AMMEngine.getMarketState(market)` as WAD BigInts. Convert to `number` via `Number(bigint) / 1e18` before passing to LMSR functions (which use `Math.exp`/`Math.log`). Overflow risk: negligible for typical market parameters (q values stay under 1e12 in practice). The LMSR output (cost/price) is also a plain `number` — multiply by 100 for percentage display.
    - For on-chain quoting, also extract the `getPositionQuote` contract-read pattern from `useAMMQuoteDirect.ts`.
  - Extract market stats math from `apps/web/src/hooks/useMarketStatsMath.ts` to `packages/sdk-core/src/math/marketStats.ts` (pure functions)
  - Create `packages/sdk-core/src/contracts/` with pure contract-read functions:
    - `markets.ts`: `fetchMarkets(client, deployments)` → returns `SdkMarket[]` with this minimal type:
      ```typescript
      interface SdkMarket {
        address: Address;
        question: string; // populated from TruthMarket.question(); web calls this field `name` in OnChainMarket but sdk-core uses `question` as the canonical field name
        creator: Address;
        lpToken: Address;
        isGraduated: boolean;
        isSettled: boolean;
        isFinalized: boolean;
        isDismissed: boolean;
        winningOutcome: number | null; // 0=NO, 1=YES, 2=INVALID, null=not settled
        createdAt: bigint;
        bBase: bigint;
        bCurrent: bigint;
        creatorDeposit: bigint;
        stage: 'bonding' | 'live' | 'settled' | 'finalized' | 'dismissed';
      }
      ```
      This mirrors `OnChainMarket` from `apps/web/src/hooks/useOnChainMarkets.ts:12-25`. Tasks 4 and 6 depend on these fields for market card display and portfolio rendering.
    - `amm.ts`: `fetchAMMQuote(client, ...)`, `fetchAMMPosition(client, ...)`, `fetchMarketState(client, ...)`
    - `tickbook.ts`: `fetchUserOrders(client, ...)`, `buildPlaceOrderArgs(...)`
    - `portfolio.ts`: `fetchUserPositions(client, ...)`, `fetchClaimableAmount(client, ...)`
  - These are **pure async functions** taking a viem `PublicClient` as first argument — no React, no hooks
  - Update `packages/sdk-core/src/index.ts` to export everything
  - Update `apps/web/src/config/abis.ts`: change JSON imports from `./abis/X.json` to re-export from `@sooth/sdk-core`. Keep the `getAbi()` helper and `ERC20_ABI` (parseAbi-based, not in JSON files) in the web app.
  - Update `apps/web/src/hooks/useDeployments.ts`: change import from `../config/deployments.json` to use `@sooth/sdk-core`'s `getDeployment()`. Preserve the `version` field and chain-switching logic.
  - **sdk-core deployments API contract** (implement exactly this):
    ```typescript
    // packages/sdk-core/src/config/deployments.ts
    interface ChainDeployment {
      chainId: number;
      networkName: string; // e.g., "baseSepolia"
      version: string; // e.g., "V11.1" — used by web for localStorage cache-bust
      contracts: {
        LaunchpadEngine: string;
        AMMEngine: string;
        TickBookPoolManager: string;
        TickBookVault: string;
        Collateralizer: string;
        MockUSDC: string;
        ProtocolConfig?: string; // optional — only present on baseSepolia, absent on other networks
        [key: string]: string | undefined; // extensible, all optional except the 6 above
      };
    }
    export function getDeployment(chainId: number): ChainDeployment | undefined; // returns undefined for unsupported chains (caller must handle)
    export function getSupportedChains(): number[];
    export function getVersion(): string; // returns current deployment version
    // NOTE on unsupported chains: web's useDeployments.ts falls back to DEFAULT_CHAIN_ID (84532) when chain is unsupported.
    // sdk-core's getDeployment should NOT embed this fallback — return undefined and let callers decide.
    // Mobile pins to 84532 so this is a non-issue for V1, but the API must be honest about missing data.
    ```
  - Web's `useDeployments.ts` should import `getDeployment` and `getVersion` from sdk-core, keeping its existing `localStorage` version-write logic (`sooth_config_version`) intact. NOTE: `useDeployments.ts` only WRITES the version to localStorage (no comparison or guard logic) — it's a passive stamp, not a cache-bust mechanism.
  - Verify `cd apps/web && pnpm build` still succeeds

  **Must NOT do**:
  - Refactor web hooks to use new contract functions (web keeps its wagmi hooks, just ABIs/types move)
  - Change web app behavior in any way
  - Add React or hook dependencies to sdk-core

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Multi-file extraction across packages with build verification
  - **Skills**: [`fullstack-dev`]
    - `fullstack-dev`: Cross-package extraction spanning contracts and frontend config

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (sequential after spike)
  - **Blocks**: Tasks 3, 4, 5, 6
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `packages/sdk-core/src/index.ts` — Current sdk-core exports (types, utils, errors)
  - `packages/sdk-core/src/types.ts` — Existing type definitions and WAD constant
  - `packages/sdk-core/src/utils.ts` — Existing utility functions (e.g., `computeMarketKey`)
  - `apps/web/src/config/abis/` — All 11 ABI JSON files to move
  - `apps/web/src/config/deployments.json` — Deployment addresses to extract
  - `apps/web/src/utils/lmsr.ts` — LMSR math to extract (number-based: `Math.exp`/`Math.log`, NOT BigInt)
  - `apps/web/src/hooks/useMarketStatsMath.ts` — Market stats calculations
  - `apps/web/src/hooks/useAMMQuoteDirect.ts` — AMM read pattern to extract as pure function
  - `apps/web/src/hooks/useAmmMarketDirect.ts` — Market state read pattern
  - `apps/web/src/hooks/useAMMPositionDirect.ts` — Position read pattern
  - `apps/web/src/hooks/useOnChainMarkets.ts` — Market list fetching pattern
  - `apps/web/src/hooks/useDirectRead.ts` — Shows viem client.readContract pattern used throughout

  **API/Type References**:
  - `apps/web/src/types.ts` — Market, Order, Position types (some may already be in sdk-core)

  **Acceptance Criteria**:

  ```bash
  # Verify sdk-core builds
  cd packages/sdk-core && pnpm build
  # Assert: exit code 0, no TypeScript errors

  # Verify ABIs are exported (sdk-core is ESM, use dynamic import)
  node --input-type=module -e "import { ABIS } from '@sooth/sdk-core'; console.log(Object.keys(ABIS).length)"
  # Assert: outputs 11 (number of ABI exports)
  # NOTE: Task 2 MUST implement and export `ABIS` object from sdk-core index.ts

  # Verify math functions work
  node --input-type=module -e "import { calculateLMSRCost } from '@sooth/sdk-core'; console.log(typeof calculateLMSRCost)"
  # Assert: outputs "function"
  # NOTE: Task 2 MUST implement and export `calculateLMSRCost` from sdk-core index.ts

  # Verify web app still builds
  cd apps/web && pnpm build
  # Assert: exit code 0, no errors

  # Verify deployments are typed
  node --input-type=module -e "import { getDeployment } from '@sooth/sdk-core'; const d = getDeployment(84532); console.log(d?.contracts?.LaunchpadEngine)"
  # Assert: outputs "0x3cfa2113c919c916e8334d245b157de937e76836"
  # NOTE: Task 2 MUST implement and export `getDeployment` function from sdk-core index.ts

  # Verify unsupported chain returns undefined
  node --input-type=module -e "import { getDeployment } from '@sooth/sdk-core'; console.log(getDeployment(99999))"
  # Assert: outputs "undefined"
  ```

  **Symbols that MUST be exported from sdk-core after this task**:
  - `ABIS` — object with all 11 contract ABIs keyed by name
  - `getDeployment(chainId)` — returns typed deployment addresses for a chain
  - `calculateLMSRCost(qYes, qNo, b)` — LMSR cost function
  - `getLMSRQuote(...)` — LMSR trade quote
  - `computeMarketKey(truthMarket, yesToken, noToken)` — already exists
  - `wadToTokenUnits(wad, tokenDecimals)` — parameterized WAD→token conversion
  - `tokenUnitsToWad(units, tokenDecimals)` — parameterized token→WAD conversion
  - All existing exports (types, utils, errors)

  **Commit**: YES
  - Message: `feat(sdk-core): extract ABIs, contract functions, LMSR math, and deployments from web app`
  - Files: `packages/sdk-core/src/**`, `apps/web/src/config/**`, `apps/web/src/utils/lmsr.ts`
  - Pre-commit: `cd packages/sdk-core && pnpm build && cd ../../apps/web && pnpm build`

---

- [x] 3. Expo Project Setup + Privy Auth

  **What to do**:
  - Create `apps/mobile` using `npx create-expo-app apps/mobile --template blank-typescript`
  - Add to pnpm workspace (`pnpm-workspace.yaml`)
  - Install dependencies: `@privy-io/expo`, `viem`, `expo-router`, `expo-secure-store`, `react-native-reanimated`
  - Configure `react-native-reanimated` Babel plugin: add `'react-native-reanimated/plugin'` to `babel.config.js` plugins array (required for Reanimated to work — see https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/getting-started/#step-2-add-reanimated-babel-plugin)
  - Set up environment variable: create `.env` with `EXPO_PUBLIC_PRIVY_APP_ID=<your-app-id>` (loaded automatically by Expo via `process.env.EXPO_PUBLIC_PRIVY_APP_ID`). Obtain app ID from Privy dashboard (https://dashboard.privy.io/). Also create `.env.example` with placeholder value and ensure `.env` is in `.gitignore` (do NOT commit secrets).
  - Add `@sooth/sdk-core` as workspace dependency
  - Configure Expo Router (file-based routing):
    - Ensure `package.json` has `"main": "expo-router/entry"` (required for Expo Router to work)
    - Add `expo-router` config plugin in `app.json`: `"plugins": ["expo-router"]`
    - Install peer deps: `npx expo install react-native-screens react-native-safe-area-context`
    - Create file structure:
      - `app/_layout.tsx` — Root layout with Privy provider
      - `app/(tabs)/_layout.tsx` — Tab navigator (Markets, Trade, Portfolio)
      - `app/(tabs)/index.tsx` — Markets tab (placeholder)
      - `app/(tabs)/trade.tsx` — Trade tab (placeholder)
      - `app/(tabs)/portfolio.tsx` — Portfolio tab (placeholder)
      - `app/login.tsx` — Login screen with Privy
  - Set up Privy provider with Base Sepolia config:
    - App ID from Privy dashboard (env var: `EXPO_PUBLIC_PRIVY_APP_ID`)
    - Configure supported login methods: email, Google, Apple
    - Pin chain to Base Sepolia (84532)
  - Create viem client utility using Privy's embedded wallet:
    - `src/lib/client.ts` — `getPublicClient()` and `getWalletClient(privyWallet)` 
  - Create auth gate: unauthenticated → login screen, authenticated → tabs
  - Lock orientation to portrait: `expo.orientation: "portrait"` in app.json
  - Verify: app launches, user can log in with email, wallet address displayed

  **Must NOT do**:
  - Build real screen content (just placeholders)
  - Use wagmi (unless spike proves Privy Expo has wagmi adapters)
  - Add any trading or market logic
  - Add complex navigation beyond tabs

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: New project setup with Privy integration requires careful configuration
  - **Skills**: [`frontend-dev`]
    - `frontend-dev`: React Native/Expo project setup with auth integration

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (after SDK extraction)
  - **Blocks**: Tasks 4, 5, 6
  - **Blocked By**: Tasks 1, 2

  **References**:

  **Pattern References**:
  - `apps/web/src/main.tsx` — Web app's entry point and provider setup pattern (wagmi + AppKit)
  - `apps/web/src/config/deployments.json` — Deployment config structure (now in sdk-core)
  - `.sisyphus/spike-results.md` — Spike findings on Privy API patterns (from Task 1)

  **External References**:
  - Privy Expo quickstart: https://docs.privy.io/guide/expo/
  - Expo Router: https://docs.expo.dev/router/introduction/
  - Expo file-based routing: https://docs.expo.dev/router/create-pages/

  **Acceptance Criteria**:

  ```bash
  # Verify project builds
  cd apps/mobile && npx expo start --ios
  # Assert: app launches in iOS simulator

  # Verify Privy login works
  # Agent uses simulator:
  # 1. App shows login screen
  # 2. Tap "Continue with Email"
  # 3. Enter test email → receive code → enter code
  # 4. After login: screen shows wallet address (0x...)
  # 5. Tab navigation visible: Markets, Trade, Portfolio

  # Verify sdk-core integration
  # In-app: import { WAD } from '@sooth/sdk-core' works without error

  # Verify viem client
  # In-app: getPublicClient().readContract({ address: MockUSDC, abi: erc20Abi, functionName: 'symbol' }) returns "USDC"
  ```

  **Commit**: YES
  - Message: `feat(mobile): scaffold Expo app with Privy auth and tab navigation`
  - Files: `apps/mobile/**`, `pnpm-workspace.yaml`
  - Pre-commit: `cd apps/mobile && npx expo export --platform ios`

---

- [x] 4. Market Discovery Screen (Stories-Style Cards)

  **What to do**:
  - Build `app/(tabs)/index.tsx` — Market feed screen
  - Create `src/components/MarketCard.tsx` — Full-screen card component:
    - Vibrant gradient background (unique per market, based on question hash)
    - Market question in large, bold text
    - Current YES price as percentage (e.g., "72%"), sourced per market stage:
      - **Bonding (AMM)**: Read `AMMEngine.getMarketState(market)` which returns `(qYes, qNo, yesPrice)` — `yesPrice` is WAD-scaled probability. See `apps/web/src/hooks/useAmmMarketDirect.ts:43-55`.
      - **Graduated (TickBook)**: Derive `marketKey` first: call `Collateralizer.getOutcomeTokens(market)` → `[yesToken, noToken]`, then `computeMarketKey(market, yesToken, noToken)` from `@sooth/sdk-core`. Then read `TickBookPoolManager.getMarketState(marketKey)` which returns `(tickIndex, activeLiqNo, activeLiqYes, probabilityWad)` — use `probabilityWad` (4th return value, WAD-scaled). See `apps/web/src/hooks/useTickBookDirect.ts` (search for `getOutcomeTokens` and `getMarketState`). NOTE: `getMarketInfo` returns `(truthMarket, yesToken, noToken, isActive)` — no probability.
      - **Settled/Finalized**: Derive from `winningOutcome` (1=YES won → 100%, 0=NO won → 0%, 2=INVALID → 50%). See `apps/web/src/hooks/useOnChainMarkets.ts`.
    - Market stage badge (Bonding, Graduated, Settled)
    - Volume / liquidity indicator
    - "Trade" CTA button at bottom
  - Implement vertical swipe navigation between cards (FlatList with `pagingEnabled`)
  - Fetch markets using sdk-core: `fetchMarkets(publicClient, deployment)` 
  - Sort by: most recent first (by market creation block/timestamp)
  - Handle empty state: "No markets yet" card with fun illustration/emoji
  - Handle loading state: skeleton card with shimmer
  - Handle market settled: show outcome badge, change CTA to "View Results"
  - Tapping "Trade" navigates to trade screen with market address param

  **Must NOT do**:
  - Search, filters, or categories
  - Horizontal swipe or grid layout
  - Pull-to-refresh with complex logic (simple pull-to-refetch is OK)
  - Market creation
  - Complex animations beyond card swipe

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Stories-style UI with gradients, animations, and social aesthetic
  - **Skills**: [`frontend-dev`, `frontend-ui-ux`]
    - `frontend-dev`: React Native component building with creative design
    - `frontend-ui-ux`: Instagram Stories-inspired visual design patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 5, 6)
  - **Blocks**: Task 7
  - **Blocked By**: Task 3

  **References**:

  **Pattern References**:
  - `apps/web/src/hooks/useOnChainMarkets.ts` — Market fetching logic (web version)
  - `apps/web/src/pages/Markets.tsx` — Market list display patterns
  - `apps/web/src/components/features/market/MarketCard.tsx` — Existing web market card (adapt for mobile)
  - `packages/sdk-core/src/contracts/markets.ts` — Pure market fetch function (from Task 2)
  - `packages/sdk-core/src/config/deployments.ts` — Base Sepolia addresses (from Task 2)

  **API/Type References**:
  - `packages/sdk-core/src/types.ts` — Market type definitions

  **Acceptance Criteria**:

  ```bash
  # Verify markets load
  # Agent runs app in simulator:
  # 1. After login, Markets tab is active
  # 2. At least 1 market card displayed (full-screen)
  # 3. Card shows: question text, YES price percentage, stage badge
  # 4. Swipe up → next market card animates in
  # 5. Tap "Trade" → navigates (even if trade screen is placeholder)

  # Verify on-chain data matches (use LaunchpadEngine on Base Sepolia)
  MARKETS=$(cast call 0x3cfa2113c919c916e8334d245b157de937e76836 "getMarkets()(address[])" --rpc-url https://sepolia.base.org)
  echo "$MARKETS" | tr ',' '\n' | wc -l
  # Assert: number of cards in app matches count of markets returned

  # Verify empty state
  # (if no markets exist): "No markets yet" message displayed
  ```

  **Commit**: YES
  - Message: `feat(mobile): add Stories-style market discovery with swipe navigation`
  - Files: `apps/mobile/app/(tabs)/index.tsx`, `apps/mobile/src/components/MarketCard.tsx`

---

- [x] 5. Trading Flow Screen (AMM + Market Orders)

  **What to do**:
  - Build `app/(tabs)/trade.tsx` — Trading screen (receives market address as param)
  - Display: market question, current YES/NO prices, user's USDC balance
  - Create `src/components/TradePanel.tsx`:
    - YES/NO toggle (two big buttons, highlighted selection)
    - Shares input (number of outcome shares to buy/sell, matching web pattern which uses shares-based input — see `apps/web/src/components/features/SimpleTradingPanel.tsx:805`)
    - Preset buttons for common share amounts (1, 5, 10, 25 shares)
    - Estimated USDC cost output (from on-chain `AMMEngine.getPositionQuote(market, outcome, deltaShares)` — this is what `useAMMQuoteDirect` wraps; it calls `readContract` not local LMSR math)
    - Price impact indicator
    - "Buy" button (full-width, vibrant color matching outcome)
  - Implement AMM trading flow (bonding-stage markets):
    1. Check USDC allowance: `MockUSDC.allowance(user, LaunchpadEngine)` (see `apps/web/src/components/features/SimpleTradingPanel.tsx:150`). If insufficient for the trade cost:
    2. Prompt approval tx via Privy wallet: `MockUSDC.approve(LaunchpadEngine, maxUint256)` for one-time max approval (avoids repeated approve prompts). The web app uses a large approval amount at line 354-358.
    3. Simulate first: `client.simulateContract({ address: LaunchpadEngine, abi: ABIS.LaunchpadEngine, functionName: 'tradePositions', args: [market, selectedOutcome, deltaShares, limitCost] })`
       - `selectedOutcome`: 0 for NO, 1 for YES (uint8)
       - `deltaShares`: positive BigInt for buys (WAD, e.g., 10n * 10n**18n for 10 shares), negative for sells
       - `limitCost`: slippage-protected max cost (buys) or min proceeds (sells), in WAD. Computed as:
         - **BUY**: `limitCost = (quoteCost * 105n) / 100n` (5% slippage buffer)
         - **SELL**: `limitCost = (quoteCost * 95n) / 100n` (5% slippage buffer)
         - **Fee computation chain** (CRITICAL — `getPositionQuote` returns RAW cost, fee is applied client-side):
         1. Call `AMMEngine.getPositionQuote(market, outcome, deltaShares)` → returns `[costOrProceeds, newPrice]` (raw, NO fee included)
         2. Get `feeRateBps`: Read `LaunchpadEngine.preGradFeeBps()` and `LaunchpadEngine.postGradFeeBps()` (global config values, not per-market). Then select based on graduation status: `currentFeeBps = isGraduated ? postGradFeeBps : preGradFeeBps`. Default fallback: 500 (5%). See `apps/web/src/hooks/useLaunchpadMarketDirect.ts` (search for `currentFeeBps`).
         3. Compute fee: `fee = (costOrProceeds * feeRateBps) / 10000n`
         4. Compute totalCost: BUY → `costOrProceeds + fee`, SELL → `costOrProceeds - fee`
         5. Apply slippage buffer to totalCost: BUY → `(totalCost * 105n) / 100n`, SELL → `(totalCost * 95n) / 100n`
         - See `apps/web/src/hooks/useAMMQuoteDirect.ts` (search for `const fee =` and `const totalCost =`) for exact fee logic
         - See `apps/web/src/components/features/SimpleTradingPanel.tsx` (search for `limitCost`) for slippage buffer formula using the fee-adjusted `quote.cost`
    4. Execute via wallet: `walletClient.writeContract(...)` with same args
    5. Show pending state during tx confirmation
    6. Show success toast with shares received
    7. Refresh balance, price, and position
    - NOTE: The web app calls `LaunchpadEngine.tradePositions()` which internally delegates to AMMEngine. LaunchpadEngine handles fee distribution and spendable-proceeds logic. Both the ABI and address are `LaunchpadEngine` (i.e., `abi: ABIS.LaunchpadEngine`, `address: contracts.LaunchpadEngine`).
  - Implement simplified TickBook market orders (graduated markets only):
    - When market has graduated past AMM, show TickBook flow
    - Get outcome tokens via `Collateralizer.getOutcomeTokens(market)` which returns `[yesToken, noToken]` (see `apps/web/src/hooks/useTickBookDirect.ts:45-55`). NOTE: TruthMarket ABI does NOT expose yesToken/noToken directly.
    - Derive `marketKey` using `computeMarketKey(truthMarket, yesToken, noToken)` from `@sooth/sdk-core` (see `packages/sdk-core/src/utils.ts:73`).
    - Call `TickBookPoolManager.placeOrder(marketKey, outcome, shares, 1, 999, maxCost)` — note first arg is `bytes32 marketKey` (keccak256 of truthMarket+yesToken+noToken), NOT the market address
    - **TickBook `maxCost` semantics** (CRITICAL for shares-based input):
      - `shares` is in WAD (e.g., 10 shares = `10n * 10n**18n`). `maxCost` is in USDC WAD.
      - For market orders sweeping ticks 1-999, the **worst-case cost** is `shares` itself (1 share costs at most 1 USDC at tick 999). So a conservative `maxCost = shares` (1:1 ratio) is always safe.
      - For a tighter estimate: `estimatedCost = (shares * currentPriceWad) / 10n**18n` where `currentPriceWad` comes from `TickBookPoolManager.getMarketState(marketKey)` 4th return value (`probabilityWad`). Then apply buffer: `maxCost = (estimatedCost * 120n) / 100n` (20% buffer for multi-tick sweep slippage).
      - If quote/price is unavailable (e.g., no liquidity): **disable the Buy button** and show "No liquidity available". Do NOT submit with a blind `maxCost`.
      - If actual fill cost exceeds `maxCost`, the contract reverts (no partial fills) — the entire order fails atomically. The user sees a "Transaction failed" error and can retry with a higher amount or smaller order.
      - See `apps/web/src/hooks/usePlaceOrder.ts` (search for `maxCost`) for the web pattern — note the web hook receives `maxCost` as a pre-computed argument from the UI layer.
    - Check vault balance via `TickBookVault.availableUsdcWad(user)` and `TickBookVault.reservedUsdcWad(user)` (see `apps/web/src/hooks/useTickBookVaultDirect.ts:23-29` for exact reads).
    - Check USDC allowance via `MockUSDC.allowance(user, TickBookVault)` (see `apps/web/src/hooks/useTraderVault.ts` for allowance+deposit sequencing).
    - If available balance is insufficient for order, require deposit:
      1. If allowance < needed: `MockUSDC.approve(TickBookVault, amount)`
      2. Deposit: `TickBookVault.depositUsdc(amount)`
      3. Then place order: `TickBookPoolManager.placeOrder(...)`
  - Handle first-time user with 0 USDC: Show "Get testnet USDC" CTA. Use the `mint(address,uint256)` function on MockUSDC at `0xb4f46ed670ed6c4cf422ea61e06961d64a753e9d`. The ABI for this is in `apps/web/src/config/abis.ts:79-82` as `MOCK_ERC20_ABI` (NOT `ERC20_ABI` which lacks `mint`). For sdk-core, add a minimal `MockUsdcABI` export with just `mint`, `approve`, `balanceOf`, `allowance`, `decimals`. Call with `amount = 1000n * 10n**18n` (1000 USDC in WAD). Note: MockUSDC.mint is permissionless on testnet — anyone can mint to themselves.
  - Handle errors: toast with readable message (insufficient balance, slippage, tx reverted)

  **Must NOT do**:
  - Limit orders or range orders
  - Orderbook visualization
  - Price charts or historical data
  - Sell flow for positions user doesn't have
  - Advanced slippage settings

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Complex contract interaction flow with approval + trade + error handling
  - **Skills**: [`fullstack-dev`, `frontend-dev`]
    - `fullstack-dev`: Contract interaction logic spanning SDK and UI
    - `frontend-dev`: Trading UI component building

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 4, 6)
  - **Blocks**: Task 7
  - **Blocked By**: Task 3

  **References**:

  **Pattern References**:
  - `apps/web/src/components/features/SimpleTradingPanel.tsx` — Web AMM trading panel (adapt flow)
  - `apps/web/src/hooks/useAMMQuoteDirect.ts` — Quote fetching pattern
  - `apps/web/src/components/features/SimpleTradingPanel.tsx:530-560` — Actual `tradePositions` call site (address=LaunchpadEngine, abi=ABIS.LaunchpadEngine, functionName='tradePositions'). NOTE: Do NOT reference `useLaunchpadSwap.ts` which is a legacy V7 `depositAndTradeAMM` flow.
  - `apps/web/src/hooks/usePlaceOrder.ts` — TickBook order placement pattern
  - `apps/web/src/hooks/useAvailableBalance.ts` — USDC balance + allowance checking
  - `packages/sdk-core/src/contracts/amm.ts` — Pure AMM functions (from Task 2)
  - `packages/sdk-core/src/math/lmsr.ts` — LMSR cost/price calculations (from Task 2)

  **API/Type References**:
  - `packages/sdk-core/src/abis/AMMEngine.ts` — AMMEngine ABI export (from Task 2, `.ts` not `.json` — see Task 2 step 3)
  - `packages/sdk-core/src/abis/TickBookPoolManager.ts` — TickBook ABI export (from Task 2)
  - `packages/sdk-core/src/abis/LaunchpadEngine.ts` — LaunchpadEngine ABI export (from Task 2)

  **Outcome Encoding Per Contract** (canonical: 0=NO, 1=YES, 2=INVALID):
  - `LaunchpadEngine.tradePositions(market, outcome, deltaShares, limitCost)`: `outcome` is uint8, 0=NO, 1=YES. See `apps/web/src/components/features/SimpleTradingPanel.tsx` where `selectedOutcome` is passed directly.
  - `AMMEngine.getPositionQuote(market, outcome, deltaShares)`: `outcome` is uint8, same encoding. See `apps/web/src/hooks/useAMMQuoteDirect.ts`. Note: ignore any contradictory inline comments in that file; the canonical encoding from `AGENTS.md` and `apps/web/src/types.ts` is authoritative.
  - `TickBookPoolManager.placeOrder(marketKey, outcome, shares, tickLower, tickUpper, maxCost)`: `outcome` is uint8, same encoding. See `apps/web/src/hooks/usePlaceOrder.ts`.

  **Acceptance Criteria**:

  ```bash
  # Verify AMM quote display
  # Agent runs app in simulator:
  # 1. Navigate to trade screen for an active market
  # 2. Select "YES" outcome
  # 3. Enter shares: 10 (outcome shares, not USDC — matches web pattern)
  # 4. Screen shows: estimated USDC cost, price impact
  # 5. "Buy" button is enabled

  # Verify AMM trade execution
  # 1. Tap "Buy" → Privy wallet prompt appears
  # 2. Approve tx → pending spinner
  # 3. Success toast: "Bought X YES shares"
  # 4. Balance refreshes (decreased by trade amount)

  # Verify on-chain (manually copy market address from app UI or getMarkets output)
  # Step 1: Get market list
  cast call 0x3cfa2113c919c916e8334d245b157de937e76836 "getMarkets()(address[])" --rpc-url https://sepolia.base.org
  # Step 2: Copy first market address from output, and user's Privy wallet address from app
  # Step 3: Check position (getPosition returns yesShares,noShares — NO outcome arg)
  cast call 0x1399d385d2861eb046d83ededb7f4ea3aaca2ef5 "getPosition(address,address)(uint256,uint256)" <MARKET_ADDR> <USER_ADDR> --rpc-url https://sepolia.base.org
  # Assert: yesShares > 0 after buying YES

  # Verify approval flow (first-time)
  # 1. With fresh wallet (0 allowance)
  # 2. Tap "Buy" → approval tx prompted first
  # 3. After approval → trade tx prompted
  # 4. Both succeed

  # Verify error handling
  # 1. Set amount higher than balance → "Insufficient balance" message
  # 2. Button disabled when amount is 0

  # Verify TickBook market order (if a graduated market exists on Base Sepolia):
  # 1. Navigate to a graduated market
  # 2. Enter shares amount
  # 3. Tap "Buy" → vault deposit prompted if needed → order tx prompted
  # 4. Success toast
  # 5. On-chain check:
  cast call 0x667c100f8f5667177fce0e9566ffe1403fc7c6f7 "availableUsdcWad(address)(uint256)" <USER_ADDR> --rpc-url https://sepolia.base.org
  # Assert: vault balance changed after deposit
  # NOTE: If no graduated market exists, this sub-flow is deferred to when one becomes available. The AMM flow is the primary Must Have.
  ```

  **Commit**: YES
  - Message: `feat(mobile): add AMM trading and market order execution`
  - Files: `apps/mobile/app/(tabs)/trade.tsx`, `apps/mobile/src/components/TradePanel.tsx`

---

- [x] 6. Portfolio Screen (Positions + Redeem)

  **What to do**:
  - Build `app/(tabs)/portfolio.tsx` — Portfolio screen
  - Display user's wallet address (truncated) and total USDC balance at top
  - List all positions across markets:
    - Market question
    - Outcome (YES/NO)
    - Shares held
    - Current value (shares × current price for active; shares × settlement price for settled)
    - Market stage badge
  - **Redemption gating** (CRITICAL — web gates ALL redeems on `stage === 'finalized'`, NOT `settled`):
    - The web app at `apps/web/src/pages/Portfolio.tsx` only shows "Redeem" buttons when `stage === 'finalized'` (lines 87, 201, 270, 336). A market that is merely `settled` (proposed outcome but not yet finalized) does NOT allow redemption. Mobile must match this behavior.
    - **AMM positions**: Show "Redeem" only when `stage === 'finalized'`. Call `AMMEngine.settlePosition(market)` — address: `contracts.AMMEngine`, ABI: `ABIS.AMMEngine`
    - **TickBook positions**: Show "Redeem" only when `stage === 'finalized'`. Call `TickBookVault.redeemResolved(market)` — address: `contracts.TickBookVault`, inline ABI: `[{ name: 'redeemResolved', ... }]`
    - **LP positions**: Show "Redeem" only when `stage === 'finalized'`. Call `LaunchpadEngine.redeemLP(market, lpBalance)` — address: `contracts.LaunchpadEngine`, ABI: `ABIS.LaunchpadEngine`
    - If called on a non-finalized market, the contract will revert. The UI must prevent this by only enabling the button for `finalized` stage.
    - Shows success toast with USDC received
  - For dismissed markets: "Claim Refund" button (gated on `stage === 'dismissed'`)
    - Call `LaunchpadEngine.claimRefund(market)` — address: `contracts.LaunchpadEngine`, ABI: `ABIS.LaunchpadEngine`
  - Position type detection: the mobile app must distinguish AMM vs TickBook vs LP positions. In the web app, this is done via separate components and data sources:
    - `AMMPositionRow` (line 31): reads AMM positions via `AMMEngine.getPosition(market, user)` returning `(yesShares, noShares)`
    - `TickBookInternalRow` (line 215): reads TickBook fills via `TickBookVault` reads
    - `LPPositionRow` (line 107): reads LP token balance via `LaunchpadEngine.markets(market)` returning LP data
    - `LockedSharesRow` (line 282): reads outcome tokens held in TickBookVault
    - See `apps/web/src/pages/Portfolio.tsx:31-282` for component definitions, and lines `763-959` for rendering/conditional display logic.
    - Each position type uses the correct redeem handler from lines 370-440.
  - Empty state: "No positions yet — start trading!" with link to markets tab
  - Pull-to-refresh to reload positions
  - **RPC batching strategy** (prevents 429 rate limits): Process markets in chunks of 5, with a small delay between chunks. Follow the pattern in `apps/web/src/hooks/useOnChainMarkets.ts:65-72` (CHUNK_SIZE=5, `Promise.all` per chunk). This applies to both market discovery (Task 4) and portfolio position fetching (Task 6).

  **Must NOT do**:
  - P&L calculations or charts
  - Trade history or transaction log
  - Position editing or partial redemption
  - Portfolio analytics or performance metrics

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Portfolio list UI with cards, badges, and action buttons
  - **Skills**: [`frontend-dev`, `fullstack-dev`]
    - `frontend-dev`: React Native list UI with position cards
    - `fullstack-dev`: Contract read calls for positions across multiple markets

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 4, 5)
  - **Blocks**: Task 7
  - **Blocked By**: Task 3

  **References**:

  **Pattern References**:
  - `apps/web/src/pages/Portfolio.tsx` — Web portfolio page (adapt layout and logic)
  - `apps/web/src/hooks/useAMMPositionDirect.ts` — Position fetching
  - `apps/web/src/hooks/useClaimableAmount.ts` — Claimable amount for settled markets
  - `apps/web/src/hooks/useClaimUnlocked.ts` — Claim execution pattern
  - `packages/sdk-core/src/contracts/portfolio.ts` — Pure portfolio functions (from Task 2)

  **API/Type References**:
  - `packages/sdk-core/src/abis/Collateralizer.ts` — Redeem ABI export (from Task 2, `.ts` not `.json`)
  - `packages/sdk-core/src/abis/LaunchpadEngine.ts` — LaunchpadEngine ABI export with `claimRefund` and `redeemLP` (from Task 2)
  - Outcome encoding: 0=NO, 1=YES, 2=INVALID (canonical, from `apps/web/src/types.ts` and `AGENTS.md`)
  - Settlement prices: winning outcome = $1, losing = $0, INVALID = $0.50

  **Acceptance Criteria**:

  ```bash
  # Verify positions display
  # Agent runs app in simulator (after executing a trade in Task 5):
  # 1. Navigate to Portfolio tab
  # 2. Shows wallet address (truncated 0xEfdb...A74F format)
  # 3. Shows USDC balance
  # 4. At least 1 position card displayed
  # 5. Card shows: market question, "YES" or "NO", shares count, current value

  # Verify on-chain data matches (same approach as Task 5)
  # Step 1: Get market list and copy first address
  cast call 0x3cfa2113c919c916e8334d245b157de937e76836 "getMarkets()(address[])" --rpc-url https://sepolia.base.org
  # Step 2: Check position (getPosition returns yesShares,noShares — no outcome arg)
  cast call 0x1399d385d2861eb046d83ededb7f4ea3aaca2ef5 "getPosition(address,address)(uint256,uint256)" <MARKET_ADDR> <USER_ADDR> --rpc-url https://sepolia.base.org
  # Assert: shares displayed in app match on-chain value (divide by 1e18 for human-readable)

  # Verify redeem:
  # Strategy: Check Base Sepolia for finalized markets via:
  cast call 0x3cfa2113c919c916e8334d245b157de937e76836 "getMarkets()(address[])" --rpc-url https://sepolia.base.org
  # For each market, check isFinalized via TruthMarket.isFinalized()
  # If a finalized market with user position exists:
  #   1. Position shows "Redeem" button (only for stage=finalized)
  #   2. Tap "Redeem" → tx prompted → success toast
  #   3. Position removed, USDC balance increased
  # If NO finalized market exists on Base Sepolia at test time:
  #   - Verify the redeem button is NOT shown for active or settled-but-not-finalized markets (negative test)
  #   - Verify the code path exists: component renders redeem button conditionally on `stage === 'finalized'`
  #   - V1 success criteria: "redeem UI gating + tx path implemented" is sufficient.
  #     On-chain execution is a conditional external dependency (requires finalized market to exist).
  #   - Document in .sisyphus/evidence/ which verification was possible

  # Verify empty state
  # (with fresh wallet): "No positions yet" message + CTA to markets
  ```

  **Commit**: YES
  - Message: `feat(mobile): add portfolio screen with positions and redeem`
  - Files: `apps/mobile/app/(tabs)/portfolio.tsx`, `apps/mobile/src/components/PositionCard.tsx`

---

- [x] 7. Stories UI Polish + Edge Cases

  **What to do**:
  - Vibrant gradient system: generate unique gradients per market (hash question → HSL values)
  - Card transitions: smooth vertical swipe with slight parallax on text
  - Trading feedback: subtle haptic on trade confirmation (`expo-haptics`)
  - Loading states: skeleton shimmer on all data-dependent components
  - Error states: friendly error messages with retry buttons, emoji-enhanced
  - Empty states: engaging illustrations/emoji for empty markets and portfolio
  - First-time user experience:
    - 0 USDC: "Get testnet USDC" CTA (MockUSDC faucet if available, or link to faucet)
    - First trade: brief tooltip explaining YES/NO
  - Market settled while viewing: trade UI gracefully transitions to "Market Settled" view with outcome + redeem CTA
  - Transaction pending: spinner overlay with "Confirming on Base..." message
  - Session expiry: Privy re-auth prompt if session expires mid-use
  - BigInt serialization safety: ensure no `JSON.stringify(bigint)` crashes anywhere
  - Keyboard avoidance: amount input pushes content up, buy button remains visible

  **Must NOT do**:
  - Complex animations (no Lottie, no particle effects)
  - Sound effects
  - Onboarding carousel
  - Tutorial overlays beyond brief tooltips

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI polish, animations, haptics, edge case handling
  - **Skills**: [`frontend-dev`, `frontend-ui-ux`]
    - `frontend-dev`: React Native polish and edge case handling
    - `frontend-ui-ux`: Visual design refinement and UX edge cases

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 5 (final, after all screens)
  - **Blocks**: None (final task)
  - **Blocked By**: Tasks 4, 5, 6

  **References**:

  **Pattern References**:
  - `apps/mobile/src/components/MarketCard.tsx` — Card component to polish (from Task 4)
  - `apps/mobile/src/components/TradePanel.tsx` — Trade UI to add feedback (from Task 5)
  - `apps/mobile/src/components/PositionCard.tsx` — Position card to polish (from Task 6)

  **External References**:
  - expo-haptics: https://docs.expo.dev/versions/latest/sdk/haptics/
  - react-native-reanimated: https://docs.swmansion.com/react-native-reanimated/

  **Acceptance Criteria**:

  ```bash
  # Verify gradient variety
  # Agent screenshots 3+ market cards → each has visibly different gradient background

  # Verify swipe animation
  # Agent swipes between cards → transition is smooth (no jank)

  # Verify haptic feedback
  # (Manual check — document that expo-haptics is called on trade success)

  # Verify loading state
  # Agent launches app → skeleton cards visible before data loads

  # Verify error state
  # Agent disables network → error message with retry button shown

  # Verify keyboard avoidance
  # Agent taps amount input on trade screen → keyboard appears → buy button still visible

  # Verify BigInt safety
  # grep -r "JSON.stringify" apps/mobile/src/ → no raw BigInt serialization without replacer
  ```

  **Commit**: YES
  - Message: `feat(mobile): add Stories UI polish, gradients, haptics, and edge cases`
  - Files: `apps/mobile/src/**`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `docs: add Expo + Privy + viem spike results` | `.sisyphus/spike-results.md` | Spike results documented |
| 2 | `feat(sdk-core): extract ABIs, contract functions, LMSR math, and deployments` | `packages/sdk-core/**`, `apps/web/**` | `pnpm build` both packages |
| 3 | `feat(mobile): scaffold Expo app with Privy auth and tab navigation` | `apps/mobile/**`, `pnpm-workspace.yaml` | `npx expo start` succeeds |
| 4 | `feat(mobile): add Stories-style market discovery with swipe navigation` | `apps/mobile/app/(tabs)/index.tsx`, components | Markets display in simulator |
| 5 | `feat(mobile): add AMM trading and market order execution` | `apps/mobile/app/(tabs)/trade.tsx`, components | Trade executes on-chain |
| 6 | `feat(mobile): add portfolio screen with positions and redeem` | `apps/mobile/app/(tabs)/portfolio.tsx`, components | Positions display correctly |
| 7 | `feat(mobile): add Stories UI polish, gradients, haptics, and edge cases` | `apps/mobile/src/**` | All edge cases handled |

---

## Success Criteria

### Final Checklist
- [x] `cd packages/sdk-core && pnpm build` — PASS
- [x] `cd apps/web && pnpm build` — PASS (no regressions)
- [ ] `cd apps/mobile && npx expo start --ios` — launches
- [ ] Privy social login works (email at minimum)
- [ ] Markets display as swipeable full-screen cards
- [ ] AMM buy trade executes successfully on Base Sepolia
- [ ] Market order executes on TickBook for graduated markets
- [ ] Portfolio shows positions with correct values
- [ ] Finalized position can be redeemed (redeem is gated on `stage === 'finalized'`, NOT `settled`). If no finalized market exists on Base Sepolia at test time, verify UI gating + tx path implementation (conditional external dependency).
- [x] No BigInt serialization crashes
- [x] Portrait orientation locked
- [x] All guardrails respected (no limit orders, no LP, no multi-chain, no search)
