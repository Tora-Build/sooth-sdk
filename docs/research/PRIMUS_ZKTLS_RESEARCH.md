# Primus Labs zkTLS SDK Research for Sooth Protocol Integration

**Date:** 2026-02-08  
**Purpose:** Evaluate Primus Labs' two zkTLS SDKs for adding a cryptographic "prove" step between Sooth prediction market resolution and settlement.

---

## Executive Summary

Primus Labs offers two SDKs for zkTLS attestation. Both can prove that an API response (e.g., CoinGecko price) is authentic via TLS session verification, then verify on-chain. **Recommendation: Use `zktls-core-sdk` (Enterprise SDK)** for Sooth — it's simpler, supports more chains natively, doesn't require on-chain task submission before attestation, and has a cleaner API.

---

## SDK Comparison

| Feature | `network-core-sdk` | `zktls-core-sdk` (Enterprise) |
|---|---|---|
| **Package** | `@primuslabs/network-core-sdk` | `@primuslabs/zktls-core-sdk` |
| **Auth** | Wallet (private key + chainId) | AppID + AppSecret (from dev.primuslabs.xyz) |
| **Attestor Network** | Decentralized (Primus Network) | Primus-operated team nodes |
| **On-chain Task Submission** | Required before attestation | Not required |
| **Native Chain** | Base (Sepolia/Mainnet) | Multi-chain (Base, Arbitrum, Linea, BNB, Scroll, Taiko, Starknet, SUI, Monad) |
| **Verification Contract** | Network's own contract | Deployed Primus contracts on 15+ chains |
| **API Complexity** | Higher (init→submitTask→attest→verifyAndPoll) | Lower (init→generateRequest→startAttestation→verify) |
| **Verification Modes** | proxytls, mpctls | proxytls, mpctls |
| **Data Ops** | REVEAL_STRING, SHA256, SHA256_EX, conditions (>, <, =, >=, <=) | REVEAL_STRING, SHA256, conditions (>, <, =, >=, <=) |
| **HTML Parsing** | Yes (XPath) | JSON only (JSONPath) |
| **DVC (zkVM)** | Yes (getAllJsonResponse) | Not documented |

---

## 1. `network-core-sdk` — Decentralized Network SDK

### How It Works

1. **Init** with wallet signer + chainId (Base Sepolia 84532 or Base Mainnet 8453)
2. **Submit task** on-chain → returns `taskId`, `taskTxHash`, `taskAttestors`
3. **Attest** — SDK performs zkTLS protocol with assigned attestor(s), sends API request through TLS proxy/MPC
4. **Verify & poll** — attestor submits result on-chain, SDK polls for completion

### Code Example: CoinGecko Price Attestation

```typescript
import { PrimusNetwork } from '@primuslabs/network-core-sdk';
import { ethers } from 'ethers';

const primusNetwork = new PrimusNetwork();
const provider = new ethers.providers.JsonRpcProvider('https://sepolia.base.org');
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

await primusNetwork.init(wallet, 84532); // Base Sepolia

// Step 1: Submit task on-chain
const submitResult = await primusNetwork.submitTask({ address: wallet.address });
// Returns: { taskId, taskTxHash, taskAttestors }

// Step 2: Define request & response parsing
const requests = [{
  url: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
  method: 'GET',
  header: {},
  body: '',
}];

const responseResolves = [[{
  keyName: 'btcPrice',
  parseType: 'json',
  parsePath: '$.bitcoin.usd',
  op: 'REVEAL_STRING', // or 'SHA256' for privacy
}]];

// Step 3: Attest
const attestResult = await primusNetwork.attest({
  address: wallet.address,
  ...submitResult,
  requests,
  responseResolves,
});

// Step 4: Verify on-chain (poll)
const taskResult = await primusNetwork.verifyAndPollTaskResult({
  taskId: attestResult[0].taskId,
  reportTxHash: attestResult[0].reportTxHash,
});
```

### Limitations
- **Base only** for on-chain task management
- Requires on-chain tx _before_ attestation (gas cost for task submission)
- 180s timeout observed in tests
- Wallet/signer required (not just API keys)

---

## 2. `zktls-core-sdk` — Enterprise Core SDK

### How It Works

1. **Init** with AppID + AppSecret (from dev.primuslabs.xyz)
2. **Generate request params** — define URL, method, response parsing
3. **Start attestation** — SDK handles TLS session, attestor signing
4. **Verify locally** — `verifyAttestation()` checks attestor signature
5. **Submit to chain** — pass attestation struct to your Solidity contract

### Code Example: CoinGecko Price Attestation

```typescript
import { PrimusCoreTLS } from '@primuslabs/zktls-core-sdk';

const zkTLS = new PrimusCoreTLS();
await zkTLS.init('YOUR_APP_ID', 'YOUR_APP_SECRET');

const request = {
  url: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
  method: 'GET',
  header: {},
  body: '',
};

const responseResolves = [{
  keyName: 'btcPrice',
  parseType: 'json',
  parsePath: '$.bitcoin.usd',
  // op: 'SHA256' for hashed result
  // op: '>' with value: '50000' for condition check
}];

const generateRequest = zkTLS.generateRequestParams(request, responseResolves);
generateRequest.setAttMode({ algorithmType: 'proxytls' });

const attestation = await zkTLS.startAttestation(generateRequest);
// attestation contains: recipient, request, responseResolve, data, attConditions, timestamp, attestors, signatures

const isValid = zkTLS.verifyAttestation(attestation);
if (isValid) {
  // Submit attestation to smart contract for on-chain verification
}
```

### Limitations
- Relies on Primus-operated attestor nodes (centralization trade-off)
- Requires registration at dev.primuslabs.xyz for AppID/AppSecret
- No documented DVC/zkVM integration

---

## 3. Attestation Structure (Both SDKs)

The on-chain `Attestation` struct is identical for both:

```solidity
struct Attestation {
    address recipient;              // User's wallet address
    AttNetworkRequest request;      // {url, header, method, body}
    AttNetworkResponseResolve[] reponseResolve;  // [{keyName, parseType, parsePath}]
    string data;                    // Actual response data (JSON string)
    string attConditions;           // Conditions applied (JSON string)
    uint64 timestamp;               // When attestation was created
    string additionParams;          // Extra metadata
    Attestor[] attestors;           // [{attestorAddr, url}]
    bytes[] signatures;             // Attestor signatures
}
```

**Key fields for Sooth:**
- `data` — contains the actual API response values (e.g., `{"btcPrice":"95432.50"}`)
- `timestamp` — when the TLS session occurred (for freshness checks)
- `request.url` — proves which API endpoint was called
- `attConditions` — if using condition mode, contains the comparison result

---

## 4. On-Chain Verification

### Solidity Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IPrimusZKTLS, Attestation } from "@primuslabs/zktls-contracts/src/IPrimusZKTLS.sol";

contract SoothResolver {
    address public primusAddress;
    
    constructor(address _primusAddress) {
        primusAddress = _primusAddress;
    }
    
    function resolveMarket(
        uint256 marketId,
        Attestation calldata attestation,
        bytes32 expectedDataHash
    ) external {
        // 1. Verify attestation signature via Primus contract
        IPrimusZKTLS(primusAddress).verifyAttestation(attestation);
        
        // 2. Verify the URL matches expected oracle source
        // require(keccak256(bytes(attestation.request.url)) == expectedUrlHash);
        
        // 3. Verify freshness
        require(attestation.timestamp > block.timestamp - 1 hours, "Stale attestation");
        
        // 4. Extract and use data for market resolution
        // Parse attestation.data for the resolved value
        // e.g., compare price against market threshold
    }
}
```

### Deployed Primus Verification Contracts

**Relevant for Sooth (Base):**
| Network | Address |
|---|---|
| Base Mainnet | `0xCE7cefB3B5A7eB44B59F60327A53c9Ce53B0afdE` |
| Base Sepolia | `0xCE7cefB3B5A7eB44B59F60327A53c9Ce53B0afdE` |

**Other supported mainnets:** Linea, BNB Chain, Arbitrum, Scroll, Taiko, Camp  
**Testnets:** Sepolia, Holesky, BNB Testnet, Monad, Pharos, Sophon, Unichain Sepolia  
**Non-EVM:** Starknet (Sepolia), SUI (mainnet + testnet)

### Gas Costs
- Not explicitly documented
- `verifyAttestation` is a `view` function (no state change) — gas only spent when called within a state-changing transaction
- Primary cost: ECDSA signature verification + string hashing — estimated **50-100k gas** per attestation verification
- `network-core-sdk` has additional gas for task submission tx on Base

---

## 5. Verification Modes & Data Operations

### Verification Modes
| Mode | Description | Trust Model |
|---|---|---|
| **proxytls** | TLS proxy between client and server; attestor sees encrypted traffic, verifies TLS handshake | Attestor as trusted proxy |
| **mpctls** | MPC-based TLS; client and attestor jointly compute TLS session | Stronger — no single party sees full session |

**Recommendation for Sooth:** Start with `proxytls` (default, faster), consider `mpctls` for higher-value markets.

### Data Operations
| Op | Output | Use Case |
|---|---|---|
| `REVEAL_STRING` (default) | Plaintext value in `data` field | Price feeds, TVL values |
| `SHA256` | Hash of value | Privacy-preserving proofs |
| `>`, `>=`, `<`, `<=`, `=` | Boolean (true/false) | Threshold checks ("price > 100000") |

**For Sooth:** `REVEAL_STRING` is ideal — we need the actual value on-chain for resolution. `SHA256` useful if we want to commit-reveal pattern.

---

## 6. Integration Architecture for Sooth

### Proposed Flow

```
Market Resolution Request
        │
        ▼
┌─────────────────────┐
│  Sooth Resolver Bot  │  (off-chain, Node.js)
│                     │
│  1. Determine which │
│     API to call     │
│  2. Call Primus SDK │
│     (zktls-core-sdk)│
│  3. Get attestation │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Sooth Smart Contract│  (on-chain, Base)
│                     │
│  4. verifyAttestation│
│     via Primus      │
│  5. Parse data      │
│  6. Resolve market  │
│  7. Enable settlement│
└─────────────────────┘
```

### Setup Requirements
1. Register at [dev.primuslabs.xyz](https://dev.primuslabs.xyz) → get AppID + AppSecret
2. Install: `npm install @primuslabs/zktls-core-sdk`
3. Install contracts: `npm install @primuslabs/zktls-contracts` (or `forge install primus-labs/zktls-contracts`)
4. Import Primus contract address for Base: `0xCE7cefB3B5A7eB44B59F60327A53c9Ce53B0afdE`

---

## 7. Recommendation

### Use `zktls-core-sdk` (Enterprise SDK)

**Reasons:**
1. **Simpler API** — 3 steps vs 4, no on-chain task pre-submission
2. **Multi-chain support** — Already deployed on Base, Arbitrum, Linea, etc.
3. **Lower gas** — No task submission tx; only verification on resolution
4. **Better for server-side** — AppID/AppSecret auth fits a resolver bot pattern
5. **Same attestation struct** — On-chain verification is identical regardless of SDK

**Trade-off:** Centralized attestor nodes (Primus-operated). For a prediction market, this is acceptable if:
- Attestors are reputable (Primus Labs backing)
- Multiple attestors sign each attestation
- The alternative (fully decentralized network) adds complexity without meaningful security gain for public API data

**When to consider `network-core-sdk`:**
- If Sooth needs fully decentralized proving with no trusted attestor
- If integrating with zkVM for complex computations on attested data
- If operating exclusively on Base

### Next Steps
1. Register on dev.primuslabs.xyz, get credentials
2. Prototype: attest a CoinGecko price call with `zktls-core-sdk`
3. Deploy `SoothResolver` contract on Base Sepolia with Primus verification
4. Test end-to-end: attestation → on-chain verification → market resolution
5. Measure gas costs and latency empirically
