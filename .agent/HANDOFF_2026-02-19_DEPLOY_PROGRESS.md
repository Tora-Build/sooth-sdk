# Handoff: Deployment Progress (V12 SoothBook)
**Date**: 2026-02-19
**Scope**: Deployment tooling hardening + deployment state verification for Monad Testnet and Base Sepolia.

---

## What Was Completed

### 0. Smart Contract Upgrade (Critical)
- **Contract**: `/Users/danieltang/GitHub/sooth-alpha/packages/contracts-core/src/SoothBook.sol`
- **Upgrade intent**: Prevent gas blowups on deep order sweeps while preserving matching correctness.
- **Key behavior in upgraded SoothBook**:
  - `MAX_MATCHES_PER_TX = 128` hard cap on maker-order matches per taker transaction.
  - `_match(...)` now returns `(remaining, maxMatchesHit)` and stops once cap is reached.
  - `_buy(...)` applies IOC behavior when `maxMatchesHit == true`:
    - unfilled remainder is **not** placed as resting order,
    - unfilled collateral is returned to taker,
    - prevents accidental long traversal and tx gas overrun.
  - Fill events carry `surplus` and V2 maker order IDs (`OrderFilledV2`) for better post-trade accounting.
- **Why this matters**:
  - Directly addresses prior over-gas failures on large sweeps (`buyYes`/`buyNo` crossing many maker orders).
  - Makes execution bounded by number of matches instead of potentially unbounded book traversal.
- **Validation evidence**:
  - Unit coverage in `/Users/danieltang/GitHub/sooth-alpha/packages/contracts-testing/test/unit/SoothBook.t.sol` includes cap/IOC behavior checks (e.g., capped-fill scenario with remainder refund).

### 1. Deployment Tooling Hardened (`contracts-core`)
- Updated `/Users/danieltang/GitHub/sooth-alpha/packages/contracts-core/script/deploy-multichain.ts`:
  - Added explicit transaction propagation checks before waiting for receipts.
  - Added robust receipt polling with dropped-transaction detection.
  - Added fee bump retries (`+25%` per retry attempt) while reusing nonce.
  - Added post-deploy bytecode visibility checks (`waitForContractCode`) to handle RPC propagation lag.
- Updated `/Users/danieltang/GitHub/sooth-alpha/packages/contracts-core/script/chainConfigs.ts`:
  - Base Sepolia RPC now supports env-driven candidate list via `BASE_SEPOLIA_RPC_URL` (comma-separated).

### 2. Verification Script Upgraded
- Reworked `/Users/danieltang/GitHub/sooth-alpha/packages/contracts-core/script/verify-deployment.sh` to V12 topology checks:
  - Validates configured addresses and on-chain bytecode.
  - Validates key links (`LaunchpadEngine`, `AMMEngine`, `Collateralizer`, `SoothBook`, ownership).
  - Verifies SoothBook market-key registration status.
  - Supports network defaults and RPC override (`RPC_URL`).

### 3. Monad Testnet Deployment Artifacts Synced
- Updated `/Users/danieltang/GitHub/sooth-alpha/packages/contracts-core/deployments/monadTestnet.json` to `V12.0`:
  - MockUSDC: `0x01843713106f85749335472ccb8b477804ac235f`
  - ProtocolConfig: `0xd02f94185e6561c48810cab151803c12919f7eea`
  - Collateralizer: `0xeb664daf2c4beb41b9f1f5ad1fb822730bb62b03`
  - AMMEngine: `0x28b799febd74b92d8ff17745ad432bfa86799fc8`
  - SoothBook: `0x94818c56b904371bf100acf723a7619dfc2c2ec0`
  - LaunchpadEngine: `0x6fd82b76045af934354a2033fde5cb64772ae615`
  - 3 market keys recorded.
- Confirmed `/Users/danieltang/GitHub/sooth-alpha/apps/web/src/config/deployments.json` monadTestnet block is aligned with the same addresses/keys.

---

## Verification Results (Executed)

### Monad Testnet
Command:
```bash
NETWORK=monadTestnet bash packages/contracts-core/script/verify-deployment.sh
```
Result:
- ✅ Contract code + topology links all pass.
- ⚠️ 3/3 configured market keys are currently reported as "not registered in SoothBook yet".
- Overall: `Verification passed with 3 warning(s)`.

### Base Sepolia
Command:
```bash
NETWORK=baseSepolia bash packages/contracts-core/script/verify-deployment.sh
```
Result:
- ✅ Contract code + topology links all pass.
- ✅ 1 market key active and registered in SoothBook.
- ⚠️ 2 market keys reported as "not registered in SoothBook yet".
- Overall: `Verification passed with 2 warning(s)`.

---

## Current Deployment State

- **Tooling**: Ready for unstable RPC conditions (retry/propagation/visibility handling added).
- **Monad V12 addresses**: Recorded and synced to frontend config.
- **Verification baseline**: Passing on both Monad/Base for core topology.
- **Open deployment follow-up**: Some configured market keys are not yet active in SoothBook (warning only, not hard failure).

---

## Next Operator Steps

1. If using private RPC, run verification with explicit endpoint:
```bash
RPC_URL=<private_rpc> NETWORK=monadTestnet bash packages/contracts-core/script/verify-deployment.sh
```

2. Investigate/confirm each warning market key lifecycle:
- Determine if key is expected pre-registration (e.g., Launchpad market exists but SoothBook not initialized yet).
- Trigger expected initialization flow where needed, then re-run verification.

3. Before handoff completion, persist final addresses/version if changed:
- `/Users/danieltang/GitHub/sooth-alpha/packages/contracts-core/deployments/monadTestnet.json`
- `/Users/danieltang/GitHub/sooth-alpha/apps/web/src/config/deployments.json`
