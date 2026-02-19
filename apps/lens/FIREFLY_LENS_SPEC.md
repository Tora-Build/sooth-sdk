# Sooth × Firefly — Prediction Market Plugin Spec

*v0.2 — Feb 14, 2026 (updated with Lens API review findings)*

## 1. Overview

A Firefly plugin that brings prediction markets natively to the Lens social graph. Markets are Lens posts. Commits are comments. Resolution uses on-chain Post Actions. Everything on Lens Chain (L2, ZKsync-based, secured by Ethereum).

**Key insight**: Firefly's data layer IS Lens. No separate API — all reads/writes go through Lens Protocol directly.

**Relationship**: Yan Suji — founder of both Firefly and Lens Protocol. Direct line to the protocol creator.

## 2. Architecture

```
┌──────────────────────────────────────────────────────┐
│                    Firefly App                        │
│  ┌──────────────────────────────────────────────┐    │
│  │           Sooth Plugin (frontend)             │    │
│  │  • Market creation UI                         │    │
│  │  • Feed view (active/resolved markets)        │    │
│  │  • Commit interface (YES/NO + confidence)     │    │
│  │  • Leaderboard                                │    │
│  └──────────────┬───────────────────────────────┘    │
└─────────────────┼────────────────────────────────────┘
                  │
     ┌────────────▼────────────────┐
     │     Lens Protocol (V3)      │
     │  • Posts = Markets          │
     │  • Comments = Commits       │
     │  • Post Actions = Resolve   │
     │  • Feed = Market feed       │
     │  • Rules = Access control   │
     │  • Sponsorships = Gasless   │
     └────────────┬────────────────┘
                  │
     ┌────────────▼────────────────┐
     │   Sooth Contracts           │
     │   (Lens Chain, chainId 232) │
     │  • MarketResolutionAction   │
     │    (BasePostAction)         │
     │  • TruthMarket              │
     │  • Settlement (GHO/USDC)    │
     └─────────────────────────────┘
```

## 3. Network Info

| Parameter | Mainnet | Testnet |
|-----------|---------|---------|
| Chain ID | `232` | `37111` |
| Gas Token | GHO (~$527M supply) | GRASS |
| RPC | `https://rpc.lens.xyz` | `https://rpc.testnet.lens.xyz` |
| WebSocket | `wss://rpc.lens.xyz/ws` | `wss://rpc.testnet.lens.xyz/ws` |
| Explorer | explorer.lens.xyz | explorer.testnet.lens.xyz |
| API | `https://api.lens.xyz/graphql` | `https://api.testnet.lens.xyz/graphql` |
| Test App | — | `0xC75A89145d765c396fd75CbD16380Eb184Bd2ca7` |

**Stack**: ZKsync L2 → Ethereum security. EVM-compatible (Solidity via Foundry ZKsync fork). Native account abstraction, USD gas fees.

## 4. Lens Primitive Mapping

| Sooth Concept | Lens Primitive | SDK Method | Details |
|---------------|---------------|------------|---------|
| Market | **Post** (Article metadata) | `post()` | Structured attributes: question, deadline, oracle, threshold |
| Commit | **Comment** on market post | `post({ commentOn })` | Attributes: position, confidence, stake, reasoning |
| Resolution | **Post Action** (BasePostAction) | `executePostAction()` | On-chain contract: verify oracle, record outcome, trigger payouts |
| Configure market | **Post Action config** | `configurePostAction()` | Set oracle address, resolution time, threshold |
| Market feed | **Custom Feed** | `fetchPosts()` filter by app + tags | All markets in one feed, filtered by `prediction-market` tag |
| Reputation | **Graph** rules | `follow()` / custom graph | Follow-weighted credibility scores |
| Market creator | **Account** | `fetchAccount()` | Lens account = predictor identity |
| Access control | **Feed Rules / Post Rules** | Rules contracts | Who can create markets, who can commit |
| Gasless UX | **Sponsorships** | Automatic | App funds pool, users trade for free |
| Identity | **DID** via api.web3.bio | REST API | Cross-platform: ENS ↔ Lens ↔ Farcaster |
| Storage | **Grove** (lens:// URIs) | `StorageClient` | Decentralized metadata, no IPFS needed |

## 5. Data Model

### 5.1 Market Post (Article Metadata)

```typescript
import { article } from "@lens-protocol/metadata";

const marketMetadata = article({
  title: "Will BTC exceed $100K by March 2026?",
  content: `
    ## Resolution Criteria
    - Source: Chainlink BTC/USD oracle
    - Resolution Time: March 1, 2026 00:00 UTC
    - YES: Price >= $100,000
    - NO: Price < $100,000
    
    ## Market Parameters
    - Type: Binary
    - Initial liquidity: 1,000 GHO
    - Trading fee: 0.3%
  `,
  tags: ["prediction-market", "bitcoin", "price", "2026"],
  attributes: [
    { key: "market_type", value: "binary" },
    { key: "oracle_type", value: "chainlink" },
    { key: "oracle_address", value: "0x..." },
    { key: "resolution_timestamp", value: "1740787200" },
    { key: "yes_threshold", value: "100000" },
    { key: "settlement_token", value: "GHO" },
    { key: "min_stake", value: "1.00" }
  ]
});

// Upload to Grove
const { uri } = await storageClient.uploadAsJson(marketMetadata);

// Create post
const result = await post(sessionClient, {
  contentUri: uri("lens://...")
});
```

### 5.2 Commit Comment (TextOnly Metadata)

```typescript
import { textOnly } from "@lens-protocol/metadata";

const commitMetadata = textOnly({
  content: "YES — BTC momentum strong, ETF inflows accelerating",
  tags: ["sooth-commit"],
  attributes: [
    { key: "position", value: "YES" },
    { key: "confidence", value: "75" },
    { key: "stake", value: "10.00" },
    { key: "token", value: "GHO" }
  ]
});

// Post as comment on market
await post(sessionClient, {
  contentUri: await upload(commitMetadata),
  commentOn: { post: marketPostId }
});
```

### 5.3 Resolution via Post Action

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BasePostAction} from "@lens-protocol/core/actions/BasePostAction";
import {KeyValue} from "@lens-protocol/core/types/Types.sol";

contract SoothMarketResolve is BasePostAction {
    struct Market {
        address oracle;
        uint256 resolutionTime;
        bytes32 outcome;
        bool resolved;
    }
    
    mapping(uint256 => Market) public markets;
    
    function _configure(
        address originalMsgSender,
        uint256 postId,
        KeyValue[] calldata params
    ) internal override returns (bytes memory) {
        // Decode oracle address + resolution time from params
        address oracle;
        uint256 resolutionTime;
        
        for (uint256 i = 0; i < params.length; i++) {
            if (params[i].key == keccak256("lens.param.oracle")) {
                oracle = abi.decode(params[i].value, (address));
            } else if (params[i].key == keccak256("lens.param.resolutionTime")) {
                resolutionTime = abi.decode(params[i].value, (uint256));
            }
        }
        
        markets[postId] = Market({
            oracle: oracle,
            resolutionTime: resolutionTime,
            outcome: bytes32(0),
            resolved: false
        });
        
        return "";
    }
    
    function _execute(
        address originalMsgSender,
        uint256 postId,
        KeyValue[] calldata params
    ) internal override returns (bytes memory) {
        Market storage m = markets[postId];
        require(!m.resolved, "Already resolved");
        require(block.timestamp >= m.resolutionTime, "Too early");
        require(originalMsgSender == m.oracle, "Only oracle");
        
        bytes32 outcome;
        for (uint256 i = 0; i < params.length; i++) {
            if (params[i].key == keccak256("lens.param.outcome")) {
                outcome = abi.decode(params[i].value, (bytes32));
            }
        }
        
        m.outcome = outcome;
        m.resolved = true;
        
        return abi.encode(outcome);
    }
}
```

### 5.4 SDK Flow — Configure + Execute Resolution

```typescript
import { configurePostAction, executePostAction } from "@lens-protocol/client/actions";

// When creating market — configure the resolution action
await configurePostAction(sessionClient, {
  post: marketPostId,
  action: {
    unknown: {
      address: evmAddress(SOOTH_RESOLVE_CONTRACT),
      params: [{
        raw: {
          key: blockchainData(keccak256("lens.param.oracle")),
          data: blockchainData(abiEncode(["address"], [oracleAddress]))
        }
      }, {
        raw: {
          key: blockchainData(keccak256("lens.param.resolutionTime")),
          data: blockchainData(abiEncode(["uint256"], [deadline]))
        }
      }]
    }
  }
});

// At deadline — oracle executes resolution
await executePostAction(sessionClient, {
  post: marketPostId,
  action: {
    unknown: {
      address: evmAddress(SOOTH_RESOLVE_CONTRACT),
      params: [{
        raw: {
          key: blockchainData(keccak256("lens.param.outcome")),
          data: blockchainData(abiEncode(["bytes32"], [outcomeHash]))
        }
      }]
    }
  }
});
```

## 6. Authentication Flow

```typescript
import { PublicClient, mainnet } from "@lens-protocol/client";
import { signMessageWith } from "@lens-protocol/client/viem";

// 1. Create public client
const client = PublicClient.create({
  environment: mainnet,
  origin: "https://sooth.market"
});

// 2. Login (SIWE challenge → sign → tokens)
const sessionClient = await client.login({
  accountOwner: {
    account: evmAddress("0x..."),    // Lens account
    app: evmAddress(SOOTH_APP),       // Sooth's registered Lens App
    owner: walletClient.account.address
  },
  signMessage: signMessageWith(walletClient)
}).unwrap();

// Tokens: accessToken (10min), refreshToken (7d), idToken (10min)
// SDK handles refresh automatically
```

## 7. Smart Contracts (Lens Chain)

### 7.1 Deployment

Lens Chain is ZKsync-based. Requires **Foundry ZKsync fork**:

```bash
git clone git@github.com:matter-labs/foundry-zksync.git
cd foundry-zksync && ./install-foundry-zksync

# Compile
FOUNDRY_PROFILE=zksync forge build --zksync

# Deploy to testnet
FOUNDRY_PROFILE=zksync forge create src/SoothMarketResolve.sol:SoothMarketResolve \
  --rpc-url https://rpc.testnet.lens.xyz \
  --chain 37111 \
  --account myKeystore \
  --zksync
```

### 7.2 Contracts to Deploy

| Contract | Type | Purpose |
|----------|------|---------|
| `SoothMarketResolve` | BasePostAction | Resolution logic — oracle submits outcome |
| `SoothMarketFactory` | Contract | Creates TruthMarket instances per post |
| `TruthMarket` | Contract | Holds stakes, distributes payouts |
| `SoothApp` | Lens App | Registered app — owns feed, manages sponsorships |

### 7.3 Key Differences from EVM

- ZKsync L2 — some EVM opcodes differ (`extcodesize`, `CREATE2`)
- Account abstraction is native (all accounts are smart contracts)
- Gas paid in GHO (not ETH)
- ~15s finality
- Need Foundry ZKsync fork (not regular Foundry)

## 8. Plugin Capabilities

### 8.1 Pull (Read)

| Capability | Lens SDK | Notes |
|-----------|----------|-------|
| List active markets | `fetchPosts({ filter: { metadata: { tags: { oneOf: ["prediction-market"] } } } })` | Filter by app + tag |
| Market detail | `fetchPost({ post: postId("42") })` | Includes stats (comments, reactions) |
| Commits on market | `fetchPosts({ filter: { commentOn: postId("42") } })` | All comments = all commits |
| Search markets | `fetchPosts({ filter: { metadata: { mainContentFocus: [Article] } } })` | By keyword/tag |
| Leaderboard | Aggregate commit accuracy per account | Custom indexing needed |
| User profile | `fetchAccount()` + commit history | Predictor stats |

### 8.2 Push (Write)

| Capability | Lens SDK | Notes |
|-----------|----------|-------|
| Create market | `post()` with Article metadata | Includes market params in attributes |
| Configure resolution | `configurePostAction()` | Sets oracle + deadline |
| Commit prediction | `post({ commentOn })` | Comment with position metadata |
| Resolve market | `executePostAction()` | Oracle triggers settlement |
| Boost market | `repost()` | Signal interesting market |

### 8.3 Oracle Resolution Paths

1. **Creator resolve** — market creator calls `executePostAction` with outcome + evidence
2. **SoothSayer oracle** — SoothSayer agent (Lens account) acts as trusted oracle
3. **Social consensus** — stake-weighted vote from commit participants
4. **Automated** — Contract reads Chainlink/RedStone oracle at deadline
5. **Future**: Brevis zkTLS for trustless Web2 API attestation

## 9. Gasless UX (Sponsorships)

```typescript
// Sooth App funds sponsorship pool
await fundSponsorship(sessionClient, {
  app: evmAddress(SOOTH_APP),
  amount: "1000" // GHO
});

// Users get gasless:
// - Market creation
// - Commits (comments)
// - Resolution triggers
// SDK automatically uses sponsored transactions when available
```

When a user action returns `SponsoredTransactionRequest`, the app pays gas. Falls back to `SelfFundedTransactionRequest` if pool empty.

## 10. Storage (Grove)

All metadata stored via Grove — Lens's decentralized storage:

```typescript
import { StorageClient } from "@lens-chain/storage-client";

const storageClient = new StorageClient({ environment: "production" });

// Upload market metadata → lens://af5225b...
const { uri } = await storageClient.uploadAsJson(marketMetadata);

// Resolve URI → https://api.grove.storage/af5225b...
const url = storageClient.resolve(uri);
```

No IPFS, no Arweave, no separate storage infra needed.

## 11. Tech Stack

| Layer | Technology |
|-------|-----------|
| Contracts | Solidity (Foundry ZKsync fork) → Lens Chain |
| Protocol SDK | `@lens-protocol/client` (TypeScript) |
| React hooks | `@lens-protocol/react` |
| Chain SDK | `@lens-chain/sdk` (viem/ethers support) |
| Storage | `@lens-chain/storage-client` (Grove) |
| DID | api.web3.bio (free, rate-limited) |
| Frontend | React (Firefly plugin or standalone) |
| Wallet | ConnectKit + wagmi + `@lens-chain/sdk/viem` |
| Indexing | Lens GraphQL API + optional The Graph subgraph |
| Oracles | Chainlink + RedStone (both available on Lens Chain) |

## 12. MVP Phases

### Phase 1: Read-Only Feed (1 week)
- [ ] Register Sooth as Lens App (on-chain)
- [ ] Create Sooth prediction Feed
- [ ] Query markets by tag/app via GraphQL
- [ ] Display in Firefly (plugin or embedded)

### Phase 2: Market Creation + Commits (1-2 weeks)
- [ ] Post creation with Article metadata + market attributes
- [ ] Comment creation with commit attributes
- [ ] Basic market detail view
- [ ] Grove storage for all metadata

### Phase 3: On-Chain Settlement (1-2 weeks)
- [ ] Deploy SoothMarketResolve (BasePostAction) to Lens Chain testnet
- [ ] Deploy TruthMarket factory
- [ ] configurePostAction on market creation
- [ ] Creator resolution flow (executePostAction)
- [ ] Stake + payout in GHO

### Phase 4: Oracle + Leaderboard (1 week)
- [ ] SoothSayer as Lens account oracle
- [ ] Automated Chainlink resolution
- [ ] Social consensus resolution
- [ ] Leaderboard (accuracy tracking)
- [ ] Sponsorships for gasless UX

## 13. Limitations & Gotchas

| Issue | Impact | Mitigation |
|-------|--------|------------|
| Cross-feed comments not supported | All markets + commits must live in same Sooth Feed | Design around single-feed architecture |
| Post Actions must inherit BasePostAction | Can't use arbitrary contracts | Wrapper pattern — action delegates to TruthMarket |
| Access tokens expire in 10 min | Need refresh logic | SDK handles automatically |
| ZKsync wallet differences | Some wallet quirks | Use `@lens-chain/sdk` signers |
| Foundry ZKsync fork (alpha) | `--gas-report`, `--verify` may not work | Manual verification on explorer |
| GHO liquidity on Lens Chain | May be thin initially | Support bridged USDC as alternative |

## 14. Open Questions (for Suji)

1. **Firefly plugin format** — Lens App + custom frontend, or Firefly-specific extension?
2. **Settlement currency** — GHO (native, ~$527M supply) or bridged USDC?
3. **Post Actions** — live on mainnet? Any review/approval process?
4. **Custom Feed creation** — can a Lens App create/own a Feed?
5. **Sponsorship limits** — max sponsorship per action? Rate limits?
6. **Firefly featuring** — can Sooth Feed be surfaced in Firefly's main UI?
7. **Oracles on Lens Chain** — Chainlink/RedStone deployed? Which feeds?

## 15. Strategic Advantages

| Factor | Lens/Firefly | TON/Telegram | Moltbook |
|--------|-------------|--------------|----------|
| Data layer | On-chain, composable | Centralized bot API | Centralized API |
| Identity | Portable Lens Account + DID | Telegram user ID | Moltbook username |
| Contracts | EVM Solidity (existing code) | Tact (full rewrite) | N/A (virtual only) |
| Social graph | Open, queryable on-chain | Closed | Open API |
| Settlement | GHO/USDC on-chain | Toncoin/USDT | Virtual points |
| Resolution | Post Actions (on-chain) | Bot commands | Manual |
| Gasless UX | Sponsorships (native) | Free bot API | N/A |
| Cross-platform | Farcaster, Hey, Orb, etc. | Telegram only | Moltbook only |
| Developer access | Free (founder relationship) | Free tier limited | Free API |

---

*v0.2 — Updated with Lens API review findings, concrete SDK examples, contract code, and network details.*
*Docs: `~/clawd/docs/LENS_API_REVIEW.md` (full technical review)*
