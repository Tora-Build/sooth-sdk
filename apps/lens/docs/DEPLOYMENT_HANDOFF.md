# Sooth on Lens — Deployment Handoff

*v2.0 — 2026-02-26 (rewritten to match v2.0 solution spec)*

> **v2.0 change**: The v1.0 handoff described deploying the monolithic `SoothPostAction`.
> The corrected architecture deploys the **full Sooth Core protocol** to Lens Chain,
> plus a thin `SoothLensAdapter` that translates Lens Post Action calls into core contract calls.
> See `SOOTH_LENS_SOLUTION_SPEC.md` v2.0 for the full rationale.

---

## Current State

### Retired (v1.0 — monolithic, does not match architecture)

| Item | Status | Notes |
|------|--------|-------|
| `SoothPostAction.sol` (510 lines) | Deployed on testnet | **RETIRE** — reimplements LMSR in one contract instead of delegating to core |
| Testnet deployment `0x7ADC…f84` | Live on chain 37111 | No longer the target architecture. Leave in place, do not build on it. |
| 22 unit tests | Passing | Tests cover the monolithic contract, not the adapter pattern |

### To Do (v2.0 — core + thin adapter)

| Item | Status |
|------|--------|
| Sooth Core compiles under zksolc | **Not verified** — critical blocker |
| Sooth Core deployed to Lens testnet (37111) | Not done |
| `SoothLensAdapter.sol` written | Not done (~150 lines) |
| `SoothLensAdapter` deployed to Lens testnet | Not done |
| Adapter registered in registry (`nodes.json`) | Not done |
| E2E test: post → configure → buy → sell → resolve → redeem | Not done |
| Sooth Core deployed to Lens mainnet (232) | Not done |

---

## Blocker: ZKsync Compiler

Lens Chain is a ZKsync ZK Stack L2. **Standard Foundry cannot deploy to it.** The bytecode format is different — Lens Chain runs zkEVM, not standard EVM.

### Toolchain Setup

1. **Install `foundry-zksync`** (Matter Labs fork of Foundry):
   ```bash
   git clone git@github.com:matter-labs/foundry-zksync.git
   cd foundry-zksync && ./install-foundry-zksync
   ```

2. **`zksolc` v1.5.12** — installed automatically by foundry-zksync:
   ```bash
   zksolc --version  # should be 1.5.12
   ```

3. **Add ZKsync profile to `packages/contracts-core/foundry.toml`**:
   ```toml
   [profile.zksync]
   src = "src"
   out = "out-zksync"
   evm_version = "paris"

   [profile.zksync.zksync]
   zksolc = "1.5.12"
   bytecode_hash = "none"
   optimizer = true
   optimizer_mode = '1'
   codegen = 'yul'
   ```

4. **Also add to `packages/contracts-plugin/foundry.toml`** (for the adapter):
   ```toml
   [profile.zksync]
   src = "src"
   out = "out-zksync"
   evm_version = "paris"

   [profile.zksync.zksync]
   zksolc = "1.5.12"
   bytecode_hash = "none"
   optimizer = true
   optimizer_mode = '1'
   codegen = 'yul'
   ```

### ZKsync Compatibility Risks

| Concern | Package | Risk Level |
|---------|---------|------------|
| PRBMath `exp()`/`ln()` assembly under zksolc | contracts-core (LMSRMath) | **High** — must verify |
| `SafeERC20.safeTransfer` (no `.transfer()`) | contracts-core | Safe |
| `CREATE2` in LaunchpadEngine (TruthMarket deploy) | contracts-core | **Medium** — zkEVM CREATE2 differs |
| Inline assembly in core contracts | contracts-core | **Medium** — audit all `assembly` blocks |
| Contract size limits (65,535 instructions per contract) | contracts-core | **Medium** — LaunchpadEngine is large |
| Solidity 0.8.30 vs Lens v3's 0.8.28 | contracts-plugin | Low — may need to pin |
| EVM version must be `paris` | both | Must set in profile |

**The critical first step**: Build the entire core under zksolc.
```bash
cd packages/contracts-core
FOUNDRY_PROFILE=zksync forge build --zksync
```

If this fails, investigate which contract/library is incompatible and whether an adapter or workaround exists.

---

## Deployment Sequence

### Step 1: Verify ZKsync Build (Core)

```bash
cd packages/contracts-core
FOUNDRY_PROFILE=zksync forge build --zksync

# If this fails on PRBMath/LMSRMath, check:
#   1. Assembly blocks incompatible with zksolc
#   2. Contract size exceeds zkEVM limits
#   3. Solidity version conflicts
```

### Step 2: Verify ZKsync Build (Adapter)

```bash
cd packages/contracts-plugin
FOUNDRY_PROFILE=zksync forge build --zksync
```

### Step 3: Get Testnet Gas

Visit a faucet, get GRASS to the deployer wallet:

| Faucet | URL | Notes |
|--------|-----|-------|
| Lenscan | https://testnet.lenscan.io/faucet | Google sign-in, once per 24h |
| Alchemy | https://www.alchemy.com/faucets/lens-sepolia | Standard Alchemy faucet |
| thirdweb | https://thirdweb.com/lens-network-sepolia-testnet | Click "Get 0.01 GRASS" |

### Step 4: Deploy Sooth Core to Lens Testnet

Deploy contracts in dependency order. WGRASS is already deployed (native wrapped token).

```bash
RPC=https://rpc.testnet.lens.xyz
CHAIN=37111
PK=$LENS_PRIVATE_KEY
WGRASS=0xeee5a340Cdc9c179Db25dea45AcfD5FE8d4d3eB8
DEPLOYER=$DEPLOYER_ADDRESS

# 1. ProtocolConfig
forge create src/ProtocolConfig.sol:ProtocolConfig \
  --rpc-url $RPC --chain $CHAIN --private-key $PK --zksync \
  --constructor-args $DEPLOYER

# 2. AMMEngine
forge create src/AMMEngine.sol:AMMEngine \
  --rpc-url $RPC --chain $CHAIN --private-key $PK --zksync \
  --constructor-args $WGRASS $PROTOCOL_CONFIG

# 3. Collateralizer
forge create src/Collateralizer.sol:Collateralizer \
  --rpc-url $RPC --chain $CHAIN --private-key $PK --zksync \
  --constructor-args $WGRASS

# 4. SoothBook
forge create src/SoothBook.sol:SoothBook \
  --rpc-url $RPC --chain $CHAIN --private-key $PK --zksync \
  --constructor-args $WGRASS $COLLATERALIZER $PROTOCOL_CONFIG

# 5. LaunchpadEngine (depends on all above)
forge create src/LaunchpadEngine.sol:LaunchpadEngine \
  --rpc-url $RPC --chain $CHAIN --private-key $PK --zksync \
  --constructor-args $WGRASS $AMM_ENGINE $COLLATERALIZER $SOOTHBOOK $PROTOCOL_CONFIG

# 6. Post-deploy wiring
# Set LaunchpadEngine as registrar on SoothBook
cast send $SOOTHBOOK "setRegistrar(address)" $LAUNCHPAD_ENGINE \
  --rpc-url $RPC --private-key $PK
```

> **Note**: Constructor args above are illustrative. Check the actual constructor signatures
> in `packages/contracts-core/src/` before deploying. They may differ slightly from
> the Base Sepolia / Monad deployment scripts.

### Step 5: Verify Core Deployment

```bash
# Run the standard verification script
cd packages/contracts-core
./script/verify-deployment.sh --chain 37111

# Manual spot checks
cast call $LAUNCHPAD_ENGINE "getMarketCount()(uint256)" --rpc-url $RPC
cast call $AMM_ENGINE "getLiquidity(address)(uint256)" $SOME_MARKET --rpc-url $RPC
cast code $LAUNCHPAD_ENGINE --rpc-url $RPC | head -c 20  # has bytecode?
```

### Step 6: Register in nodes.json

Add a new entry to `packages/registry/nodes.json`:

```json
{
  "id": "<generate-8-char-hex>",
  "chainId": 37111,
  "contracts": {
    "launchpadEngine": "<address>",
    "soothBook": "<address>",
    "ammEngine": "<address>",
    "collateralizer": "<address>",
    "usdc": "0xeee5a340Cdc9c179Db25dea45AcfD5FE8d4d3eB8",
    "protocolConfig": "<address>"
  },
  "deployedAt": "<ISO timestamp>",
  "deployedBy": "<deployer address>",
  "startBlock": <block number>,
  "indexed": false
}
```

Also add the chain definition to `nodes.json` `chains`:

```json
"37111": {
  "name": "Lens Testnet",
  "nativeCurrency": { "name": "GRASS", "symbol": "GRASS", "decimals": 18 },
  "rpcUrls": ["https://rpc.testnet.lens.xyz"],
  "explorer": { "name": "Lens Explorer", "url": "https://explorer.testnet.lens.xyz" },
  "multicall3": "<check if deployed on Lens testnet>",
  "testnet": true
}
```

> **Note**: The `usdc` field maps to WGRASS on Lens testnet / WGHO on mainnet.
> The field name is a legacy convention from Base Sepolia. Both are 18 decimals,
> so no WAD-to-USDC conversion is needed (SCALAR = 1).

### Step 7: Deploy SoothLensAdapter

```bash
# The adapter lives in contracts-plugin
cd packages/contracts-plugin

forge create src/lens/SoothLensAdapter.sol:SoothLensAdapter \
  --rpc-url $RPC --chain $CHAIN --private-key $PK --zksync \
  --constructor-args \
    $LAUNCHPAD_ENGINE \
    $COLLATERALIZER \
    $WGRASS \
    0x4A92a97Ff3a3604410945ae8CA25df4fBB2fDC11 \
    $DEPLOYER
```

### Step 8: E2E Test on Testnet

Full lifecycle through the Lens adapter:

1. **Wrap GRASS → WGRASS**
   ```bash
   cast send $WGRASS --value 1ether --rpc-url $RPC --private-key $PK
   # WGRASS uses standard WETH deposit (send ETH/GRASS to contract)
   ```

2. **Approve WGRASS for ActionHub**
   ```bash
   cast send $WGRASS "approve(address,uint256)" \
     0x4A92a97Ff3a3604410945ae8CA25df4fBB2fDC11 \
     $(cast max-uint) \
     --rpc-url $RPC --private-key $PK
   ```

3. **Create market** — Lens `post()` with SoothLensAdapter as the action.
   Adapter calls `LaunchpadEngine.createMarket()`.
   Verify: `marketOf[feed][postId]` returns a TruthMarket address.

4. **Buy YES** — `executePostAction(BUY, YES, 10e18, maxCost)`.
   Adapter calls `LaunchpadEngine.tradePositions(market, 1, +10e18, maxCost)`.
   Verify: `AMMEngine.getPosition(market, user)` shows yesShares.

5. **Sell YES** — `executePostAction(SELL, YES, 5e18, minProceeds)`.
   Adapter calls `LaunchpadEngine.tradePositions(market, 1, -5e18, minProceeds)`.
   Verify: position reduced, proceeds locked in AMMEngine (24h lock-on-sell).

6. **Resolve** — `executePostAction(RESOLVE, YES)`.
   Adapter calls `TruthMarket.settle(1, tStar)`.
   Verify: `TruthMarket.isSettled()` returns true.

7. **Finalize** — call `TruthMarket.finalize()` (may need to be direct, not via adapter).
   Verify: `TruthMarket.isFinalized()` returns true.

8. **Redeem** — `executePostAction(REDEEM)`.
   Adapter calls `Collateralizer.redeem(market, amount)`.
   Verify: WGRASS transferred to user, outcome tokens burned.

### Step 9: Deploy to Mainnet

Repeat Steps 4–8 with mainnet values:

| Param | Testnet | Mainnet |
|-------|---------|---------|
| RPC | `https://rpc.testnet.lens.xyz` | `https://rpc.lens.xyz` |
| Chain ID | `37111` | `232` |
| Collateral | WGRASS `0xeee5…eB8` | WGHO `0x6bDc…e2F` |
| ActionHub | `0x4A92…c11` | `0xc6D5…802` |
| Global Feed | `0x3123…871` | `0xcB5E…580` |
| Gas token | GRASS | GHO |

---

## Lens Infrastructure Addresses

### Testnet (Chain 37111)

| Contract | Address | Notes |
|----------|---------|-------|
| ActionHub | `0x4A92a97Ff3a3604410945ae8CA25df4fBB2fDC11` | Proxy, same interface as mainnet |
| WGRASS | `0xeee5a340Cdc9c179Db25dea45AcfD5FE8d4d3eB8` | Wrapped GRASS, 18 decimals |
| Global Feed | `0x31232Cb7dE0dce17949ffA58E9E38EEeB367C871` | Default feed for posts |
| Gas token | GRASS | Native token, 18 decimals |

### Mainnet (Chain 232)

| Contract | Address | Notes |
|----------|---------|-------|
| ActionHub | `0xc6D57Ee750Ef2ee017a9E985A0C4198bEd16A802` | |
| WGHO | `0x6bDc36E20D267Ff0dd6097799f82e78907105e2F` | 18 decimals |
| Global Feed | `0xcB5E109FFC0E15565082d78E68dDDf2573703580` | |
| Gas token | GHO | Native token, 18 decimals |

### Sooth Core on Lens Testnet (to be filled after deployment)

| Contract | Address | Notes |
|----------|---------|-------|
| LaunchpadEngine | *TBD* | |
| AMMEngine | *TBD* | |
| Collateralizer | *TBD* | |
| SoothBook | *TBD* | |
| ProtocolConfig | *TBD* | |
| SoothLensAdapter | *TBD* | IPostAction → core delegation |

### Retired

| Contract | Address | Notes |
|----------|---------|-------|
| SoothPostAction (v1.0 monolithic) | `0x7ADCc784b192Ea376820aAa28E358f156E458f84` | **Retired** — does not match architecture. Do not build on. |

---

## Gasless Model

Lens Protocol interactions are **gasless for users** via ZKsync native account abstraction + Lens Sponsorships (paymasters).

| Action | User Pays Gas? | User Pays WGHO? |
|--------|---------------|-----------------|
| Deploy contracts | **YES** (deployer pays GRASS/GHO) | No |
| Create market (`post()` + `configure()`) | No (sponsored) | **YES** (creator deposit: `b × ln(2)`) |
| Buy shares (`executePostAction()`) | No (sponsored) | **YES** (trade cost) |
| Sell shares | No (sponsored) | No (proceeds locked 24h, then withdrawable) |
| Resolve market | No (sponsored) | No |
| Redeem winnings | No (sponsored) | No (receives WGHO) |
| ERC20 approve (WGHO → ActionHub) | No (sponsored via SDK) | No value transfer |

On testnet, Lens provides a **global sponsorship fallback**. On mainnet, the Sooth app must fund a sponsorship pool.

---

## Collateral Note: WGHO vs USDC

| Chain | Collateral | Decimals | SCALAR (WAD / token) |
|-------|-----------|----------|---------------------|
| Base Sepolia | USDC (MockUSDC) | 18 (mock) | 1 |
| Monad Testnet | USDC (MockUSDC) | 6 (standard) | 1e12 |
| **Lens Testnet** | **WGRASS** | **18** | **1** |
| **Lens Mainnet** | **WGHO** | **18** | **1** |

WGHO/WGRASS are 18 decimals, same as WAD. This means **no `_wadToUsdc()` / `_usdcToWad()` conversion is needed** at transfer boundaries. The core protocol's internal WAD math aligns directly with the token decimals.

Verify that the core contracts handle SCALAR=1 correctly — some code paths may assume USDC's 6 decimals.

---

## File Locations

| File | Purpose |
|------|---------|
| `packages/contracts-core/src/` | Full Sooth Core (LaunchpadEngine, AMMEngine, Collateralizer, SoothBook, etc.) |
| `packages/contracts-plugin/src/lens/IPostAction.sol` | Lens V3 Post Action interface |
| `packages/contracts-plugin/src/lens/SoothPostAction.sol` | **RETIRED** — monolithic contract, does not match v2.0 architecture |
| `packages/contracts-plugin/src/lens/SoothLensAdapter.sol` | **TO BUILD** — thin adapter (~150 lines) |
| `packages/registry/nodes.json` | Deployment registry (add Lens chain entry after deployment) |
| `apps/lens/docs/SOOTH_LENS_SOLUTION_SPEC.md` | v2.0 solution design + user flows |
| `apps/lens/docs/LENS_PREDICTION_MARKETS.md` | Research notes (Orb reverse engineering) |
| `apps/lens/docs/LENS_API_REVIEW.md` | Lens V3 API review |

---

## Open Questions

1. **Does the full Sooth Core compile under zksolc?** The monolithic SoothPostAction compiled, but the core is much larger. PRBMath, CREATE2 (for TruthMarket deployment), and larger contract sizes are risk areas.

2. **CREATE2 behavior on zkEVM**: LaunchpadEngine deploys TruthMarket instances via CREATE2. ZKsync's CREATE2 works differently (uses `create2Account` under the hood). May need to use `IContractDeployer` system contract instead of raw CREATE2.

3. **Contract size limits**: zkEVM has a 65,535 bytecode instruction limit per contract. LaunchpadEngine is the largest core contract — verify it fits.

4. **Solidity version**: Core uses 0.8.30, Lens v3 uses 0.8.28. May need to pin to 0.8.28 for zksolc compatibility.

5. **Contract verification**: Testnet explorer verification URL is `https://api-explorer-verify.staging.lens.zksync.dev/contract_verification`. Need to test with multi-file projects.

6. **WGRASS wrapping**: On testnet, users need WGRASS. GRASS comes from faucets, wrapping requires `WGRASS.deposit{value: amount}()`. Verified — WGRASS is a standard WETH-style contract ("Wrapped Grass", 18 decimals).

7. **Multicall3 on Lens**: The frontend uses multicall for batch reads. Check if Multicall3 is deployed on Lens testnet/mainnet at the canonical address (`0xcA11bde05977b3631167028862bE2a173976CA11`).

8. **Adapter WGHO flow**: The adapter receives calls from ActionHub (msg.sender = ActionHub). It needs to transfer WGHO from the user to the core contracts. Since `originalMsgSender` is the user but the adapter is the caller, the approval chain is: User approves ActionHub → ActionHub calls adapter → adapter calls core. Need to verify the core contracts accept WGHO transfers where `msg.sender` is the adapter, not the user. May need the adapter to pull WGHO from the user (via ActionHub forwarding) and then approve/transfer to core.

---

*Next steps: `FOUNDRY_PROFILE=zksync forge build --zksync` in `packages/contracts-core/`. If it passes, proceed to deployment. If it fails, triage compiler issues before anything else.*
