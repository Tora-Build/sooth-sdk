# SoothPostAction Deployment — Handoff

*2026-02-20*

---

## Current State

| Item | Status |
|------|--------|
| `SoothPostAction.sol` | Written (~510 lines), `packages/contracts-plugin/src/lens/` |
| `IPostAction.sol` | Written, same directory |
| Unit tests | 22 tests, all passing (`packages/contracts-plugin/test/lens/`) |
| Standard Foundry build | Passes (`forge build` in contracts-plugin) |
| ZKsync build | ✅ **Done** — `FOUNDRY_PROFILE=zksync forge build --zksync` passes |
| Testnet deployment | ✅ **Done** — `0x7ADCc784b192Ea376820aAa28E358f156E458f84` (chain 37111) |
| E2E lifecycle test | ✅ **Done** — Full create/buy/sell/resolve/redeem verified on-chain (2026-02-20) |
| Mainnet deployment | Not done |

---

## Blocker: ZKsync Compiler

Lens Chain is a ZKsync ZK Stack L2. **Standard Foundry cannot deploy to it.** The bytecode format is different — Lens Chain runs zkEVM, not standard EVM.

### What's Needed

1. **Install `foundry-zksync`** (Matter Labs fork of Foundry):
   ```bash
   git clone git@github.com:matter-labs/foundry-zksync.git
   cd foundry-zksync && ./install-foundry-zksync
   ```

2. **`zksolc` v1.5.12** — installed automatically by foundry-zksync, or manually:
   ```bash
   # foundry-zksync manages this, but verify:
   zksolc --version  # should be 1.5.12
   ```

3. **Add ZKsync profile to `packages/contracts-plugin/foundry.toml`**:
   ```toml
   [profile.default.zksync]
   zksolc = "1.5.12"
   bytecode_hash = "none"
   optimizer = true
   optimizer_mode = '1'
   codegen = 'yul'
   ```

4. **Build with ZKsync flag**:
   ```bash
   cd packages/contracts-plugin
   forge build --zksync
   ```

5. **Deploy with ZKsync flag**:
   ```bash
   forge create src/lens/SoothPostAction.sol:SoothPostAction \
     --rpc-url https://rpc.testnet.lens.xyz \
     --chain 37111 \
     --private-key $LENS_PRIVATE_KEY \
     --zksync \
     --constructor-args $WGRASS $ACTION_HUB $OWNER
   ```

### ZKsync Compatibility Risks

| Concern | Our Status |
|---------|------------|
| No `.transfer()` / `.send()` | Safe — we use `SafeERC20.safeTransfer` |
| No inline assembly `create`/`create2` | Safe — not used |
| No `extcodesize` checks | Safe — not used |
| Contract size < 65,535 instructions | Likely safe (~510 lines) |
| PRBMath (exp/ln) under zksolc | **Unknown** — must verify compiles |
| EVM version must be `paris` | Must set in profile |
| Solidity 0.8.30 vs 0.8.28 | Lens v3 uses 0.8.28, we use 0.8.30 — may need downgrade |

**The real test**: `forge build --zksync`. If LMSRMath + PRBMath compile under zksolc, we're clear. If not, we may need to adapt the math library.

---

## Testnet Addresses (Chain 37111)

| Contract | Address | Notes |
|----------|---------|-------|
| **SoothPostAction** | **`0x7ADCc784b192Ea376820aAa28E358f156E458f84`** | **Deployed 2026-02-20, tx: `0x49355be45fc999ba4f0c78ceab0eb774e4ad47a4d9b1b7c9e209ca14bb5068ef`** |
| ActionHub | `0x4A92a97Ff3a3604410945ae8CA25df4fBB2fDC11` | Proxy, same interface as mainnet |
| WGRASS | `0xeee5a340Cdc9c179Db25dea45AcfD5FE8d4d3eB8` | Wrapped GRASS, 18 decimals (testnet equivalent of WGHO) |
| Global Feed | `0x31232Cb7dE0dce17949ffA58E9E38EEeB367C871` | Default feed for posts |
| Gas token | GRASS | Native token, 18 decimals |

## Mainnet Addresses (Chain 232)

| Contract | Address | Notes |
|----------|---------|-------|
| ActionHub | `0xc6D57Ee750Ef2ee017a9E985A0C4198bEd16A802` | |
| WGHO | `0x6bDc36E20D267Ff0dd6097799f82e78907105e2F` | 18 decimals |
| Global Feed | `0xcB5E109FFC0E15565082d78E68dDDf2573703580` | |
| Gas token | GHO | Native token, 18 decimals |

---

## Constructor Args

```solidity
constructor(address _wgho, address _actionHub, address _owner)
```

| Param | Testnet Value | Mainnet Value |
|-------|---------------|---------------|
| `_wgho` | `0xeee5a340Cdc9c179Db25dea45AcfD5FE8d4d3eB8` (WGRASS) | `0x6bDc36E20D267Ff0dd6097799f82e78907105e2F` (WGHO) |
| `_actionHub` | `0x4A92a97Ff3a3604410945ae8CA25df4fBB2fDC11` | `0xc6D57Ee750Ef2ee017a9E985A0C4198bEd16A802` |
| `_owner` | Deployer address | Sooth multisig or deployer |

---

## Gasless Model

Lens Protocol interactions are **gasless for users** via ZKsync native account abstraction + Lens Sponsorships (paymasters).

| Action | User Pays Gas? | User Pays WGHO? |
|--------|---------------|-----------------|
| Deploy contract | **YES** (deployer pays GRASS/GHO) | No |
| Create market (`post()` + `configure()`) | No (sponsored) | **YES** (creator subsidy: `b × ln(2)`) |
| Buy shares (`executePostAction()`) | No (sponsored) | **YES** (trade cost) |
| Sell shares | No (sponsored) | No (receives WGHO) |
| Resolve market | No (sponsored) | No |
| Redeem winnings | No (sponsored) | No (receives WGHO) |
| ERC20 approve (WGHO → ActionHub) | No (sponsored via SDK) | No value transfer |

On testnet, Lens provides a **global sponsorship fallback** — all protocol interactions are sponsored without app-level configuration.

On mainnet, the Sooth app must fund a sponsorship pool:
```typescript
await fundSponsorship(sessionClient, {
  app: evmAddress(SOOTH_APP),
  amount: "500" // GHO
});
```

---

## Faucets (Testnet GRASS)

| Faucet | URL | Notes |
|--------|-----|-------|
| Lenscan | https://testnet.lenscan.io/faucet | Google sign-in, once per 24h |
| Alchemy | https://www.alchemy.com/faucets/lens-sepolia | Standard Alchemy faucet |
| thirdweb | https://thirdweb.com/lens-network-sepolia-testnet | Click "Get 0.01 GRASS" |

---

## Deployment Sequence

### Step 1: ZKsync Toolchain Setup
```bash
# Install foundry-zksync
git clone git@github.com:matter-labs/foundry-zksync.git
cd foundry-zksync && ./install-foundry-zksync

# Verify
forge --version  # should show foundry-zksync
```

### Step 2: Verify ZKsync Build
```bash
cd packages/contracts-plugin
forge build --zksync
# If this fails on PRBMath, investigate compiler settings
```

### Step 3: Get Testnet Gas
- Visit a faucet above, get GRASS to deployer wallet

### Step 4: Deploy to Testnet
```bash
forge create src/lens/SoothPostAction.sol:SoothPostAction \
  --rpc-url https://rpc.testnet.lens.xyz \
  --chain 37111 \
  --private-key $LENS_PRIVATE_KEY \
  --zksync \
  --constructor-args \
    0xeee5a340Cdc9c179Db25dea45AcfD5FE8d4d3eB8 \
    0x4A92a97Ff3a3604410945ae8CA25df4fBB2fDC11 \
    $DEPLOYER_ADDRESS
```

### Step 5: E2E Test on Testnet
1. Create a Lens post with SoothPostAction attached
2. `configure()` — verify market created, WGRASS subsidy transferred
3. `execute(BUY)` — buy YES shares, verify price moves
4. `execute(SELL)` — sell shares back
5. `execute(RESOLVE)` — resolve as YES
6. `execute(REDEEM)` — redeem winning shares for WGRASS

### Step 6: Deploy to Mainnet
Same as Step 4 but with mainnet addresses and `--rpc-url https://rpc.lens.xyz`.

---

## File Locations

| File | Purpose |
|------|---------|
| `packages/contracts-plugin/src/lens/SoothPostAction.sol` | Main contract (~510 lines) |
| `packages/contracts-plugin/src/lens/IPostAction.sol` | Lens V3 Post Action interface |
| `packages/contracts-plugin/test/lens/SoothPostAction.t.sol` | 22 unit tests |
| `packages/contracts-plugin/foundry.toml` | Foundry config (needs ZKsync profile) |
| `packages/contracts-core/src/libraries/LMSRMath.sol` | LMSR math library (shared) |
| `apps/lens/docs/SOOTH_LENS_SOLUTION_SPEC.md` | Full solution design + user flows |
| `apps/lens/docs/LENS_PREDICTION_MARKETS.md` | Research notes (Orb reverse engineering) |
| `apps/lens/docs/LENS_API_REVIEW.md` | Lens V3 API review |

---

## Open Questions

1. **Does PRBMath compile under zksolc?** — The `exp()` and `ln()` functions in LMSRMath use PRBMath which may have assembly that zksolc handles differently. Must test with `forge build --zksync`.

2. **Solidity version**: We use 0.8.30, Lens v3 uses 0.8.28. May need to pin to 0.8.28 for zksolc compatibility.

3. **Contract verification**: Testnet explorer verification URL is `https://api-explorer-verify.staging.lens.zksync.dev/contract_verification`. Need to test.

4. **ActionHub registration**: After deploying SoothPostAction, how does it get "registered" with the ActionHub? Lens v3 Post Actions are attached per-post via the `post()` call's `actions` array — no global registration needed. But verify this on testnet.

5. **WGRASS acquisition**: On testnet, users need WGRASS to trade. GRASS comes from faucets, but wrapping GRASS → WGRASS requires calling `WGRASS.deposit{value: amount}()`. Need to verify the WGRASS contract has standard WETH-style deposit/withdraw.

---

*Next session: Install foundry-zksync, attempt `forge build --zksync`, resolve any compiler issues, then deploy.*
