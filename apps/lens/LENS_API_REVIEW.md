# Lens Protocol API Technical Review

**Date:** 2026-02-14  
**Reviewer:** nuts-analyst  
**Purpose:** Technical review for building prediction market integration on Lens Protocol

---

## Executive Summary

Lens Protocol v3 is a decentralized social protocol built on Lens Chain (ZKsync L2, chainId 232 mainnet / 37111 testnet). It provides primitives for Accounts, Feeds, Posts, Graphs, Groups, Apps, and on-chain Actions. The protocol uses:
- **Gas Tokens:** GHO (mainnet) / GRASS (testnet)
- **RPC:** https://rpc.lens.xyz (mainnet), https://rpc.testnet.lens.xyz (testnet)
- **API:** https://api.lens.xyz/graphql (mainnet), https://api.testnet.lens.xyz/graphql (testnet)
- **Storage:** Grove (lens:// URIs for metadata/media)

**Key for Prediction Markets:**
- Posts can represent markets (with metadata schema)
- Comments can represent commits/positions
- Post Actions can implement resolution logic (on-chain contracts triggered on posts)
- Sponsorships enable gasless transactions
- Rules system for permissioning (who can post, comment, quote)

---

## 1. Network Information

### Mainnet (Lens Chain)
| Parameter | Value |
|-----------|-------|
| Chain ID | `232` |
| Network Name | Lens Chain Mainnet |
| RPC URL | `https://rpc.lens.xyz` |
| WebSocket | `wss://rpc.lens.xyz/ws` |
| Currency Symbol | GHO |
| Block Explorer | https://explorer.lens.xyz |
| API Endpoint | https://api.lens.xyz/graphql |

### Testnet (Sepolia)
| Parameter | Value |
|-----------|-------|
| Chain ID | `37111` |
| Network Name | Lens Chain Testnet |
| RPC URL | `https://rpc.testnet.lens.xyz` |
| WebSocket | `wss://rpc.testnet.lens.xyz/ws` |
| Currency Symbol | GRASS |
| Block Explorer | https://explorer.testnet.lens.xyz |
| API Endpoint | https://api.testnet.lens.xyz/graphql |

### Test App Addresses
For quick experimentation:
- **Mainnet:** `0x8A5Cc31180c37078e1EbA2A23c861Acf351a97cE`
- **Testnet:** `0xC75A89145d765c396fd75CbD16380Eb184Bd2ca7`

---

## 2. Authentication

### Authentication Roles
- **Account Owner:** End-user who owns a Lens Account
- **Account Manager:** Delegated manager with specific permissions
- **Onboarding User:** User without an account (limited to onboarding features)
- **Builder:** Developer role for app configuration/management

### Authentication Flow
1. **Generate Challenge**
   ```graphql
   mutation {
     challenge(request: {
       accountOwner: {
         app: "<app-address>",
         account: "<account-address>",
         owner: "<owner-address>"
       }
     }) {
       id
       text
     }
   }
   ```

2. **Sign Challenge** (SIWE message)
   ```typescript
   const signature = await signer.signMessage({ message: challenge.text });
   ```

3. **Acquire Tokens**
   ```graphql
   mutation {
     authenticate(request: {
       id: "<challenge-id>",
       signature: "<signature>"
     }) {
       accessToken  # 10 min validity
       refreshToken # 7 days validity
       idToken      # 10 min validity
     }
   }
   ```

### SDK Authentication
```typescript
import { PublicClient, mainnet } from "@lens-protocol/client";
import { signMessageWith } from "@lens-protocol/client/viem";

const client = PublicClient.create({
  environment: mainnet,
  origin: "https://myapp.xyz"
});

const authenticated = await client.login({
  accountOwner: {
    account: "0x1234…",
    app: "0x5678…",
    owner: signer.address
  },
  signMessage: signMessageWith(walletClient)
});

const sessionClient = authenticated.value; // Use for authenticated requests
```

### Token Usage
- **Access Token:** Required in `Authorization: Bearer <token>` or `x-access-token: <token>` header
- **Refresh Token:** Used to obtain new token triplet via `refresh` mutation
- **ID Token:** For backend identity verification (contains claims: sub, iss, aud, iat, exp, sid, act, role, sponsored)

---

## 3. Accounts

### Creating an Account
```typescript
import { createAccount } from "@lens-protocol/client/actions";
import { account } from "@lens-protocol/metadata";
import { StorageClient } from "@lens-chain/storage-client";

// 1. Create metadata
const metadata = account({
  name: "Alice",
  bio: "Prediction market trader",
  picture: "lens://af5225b…"
});

// 2. Upload to Grove
const { uri } = await storageClient.uploadAsJson(metadata);

// 3. Create account
const result = await createAccount(sessionClient, {
  username: {
    localName: "alice",
    // namespace: "0x…" for custom namespace
  },
  metadataUri: uri
});

// 4. Handle transaction
await result.andThen(handleOperationWith(walletClient));
```

### Fetching Accounts
```typescript
import { fetchAccount, evmAddress } from "@lens-protocol/client/actions";

// By address
const account = await fetchAccount(client, {
  address: evmAddress("0x1234…")
});

// By username
const account = await fetchAccount(client, {
  username: { localName: "alice", namespace: "lens" }
});
```

### Account Fields
```typescript
{
  address: EvmAddress,
  username: { value: "lens/alice", localName: "alice", namespace: "lens" },
  metadata: {
    name: "Alice",
    bio: "…",
    picture: "lens://…",
    coverPicture: "lens://…"
  },
  operations: {
    canFollow: ValidationResult,
    canUnfollow: ValidationResult,
    // …
  },
  actions: [
    { __typename: "TippingAccountAction", address: "0x…" },
    { __typename: "UnknownAccountAction", address: "0x…", metadata: {…} }
  ],
  owner: "0x…",
  // …
}
```

### Account Managers
Delegated permissions for managing accounts:
```typescript
import { addAccountManager } from "@lens-protocol/client/actions";

await addAccountManager(sessionClient, {
  manager: evmAddress("0x5678…"),
  permissions: {
    canExecuteTransactions: true,
    canTransferTokens: false,
    canTransferNative: false,
    canSetMetadataUri: true
  }
});
```

---

## 4. Feeds & Posts

### Post Creation Flow
1. **Create Post Metadata**
   ```typescript
   import { textOnly, image, article } from "@lens-protocol/metadata";
   
   const metadata = textOnly({
     content: "Will ETH be above $3000 by EOY 2026?"
   });
   
   // Or for markets with images/details:
   const metadata = article({
     title: "ETH Price Prediction Market",
     content: `
       ## Market Details
       Resolution: December 31, 2026 23:59 UTC
       Oracle: Chainlink ETH/USD
       ...
     `,
     tags: ["prediction-market", "eth", "price"]
   });
   ```

2. **Upload Metadata**
   ```typescript
   const { uri } = await storageClient.uploadAsJson(metadata);
   // Returns: lens://4f91ca…
   ```

3. **Create Post**
   ```typescript
   import { post, uri } from "@lens-protocol/client/actions";
   
   const result = await post(sessionClient, {
     contentUri: uri("lens://4f91ca…"),
     // Optional: post rules
     rules: {
       required: [{
         followersOnlyRule: {
           graph: evmAddress("0x…"),
           quotesRestricted: false,
           repliesRestricted: false,
           repostRestricted: false
         }
       }]
     }
   });
   ```

### Comments (for Position Commits)
```typescript
import { postId } from "@lens-protocol/client";

// Check if commenting is allowed
if (post.operations.canComment.__typename === "PostOperationValidationPassed") {
  const result = await post(sessionClient, {
    contentUri: uri("lens://…"),
    commentOn: {
      post: postId("42") // Market post ID
    }
  });
}
```

### Quotes
```typescript
const result = await post(sessionClient, {
  contentUri: uri("lens://…"),
  quoteOf: {
    post: postId("42")
  },
  rules: {
    // Quotes can have their own rules
    required: [/* … */]
  }
});
```

### Fetching Posts
```typescript
import { fetchPost, fetchPosts } from "@lens-protocol/client/actions";

// Single post
const post = await fetchPost(client, { post: postId("42") });

// Multiple posts
const result = await fetchPosts(client, {
  filter: {
    authors: [evmAddress("0x…")],
    metadata: {
      mainContentFocus: [MainContentFocus.Article],
      tags: { oneOf: ["prediction-market"] }
    }
  }
});

// Post structure
{
  id: "42",
  author: Account,
  timestamp: DateTime,
  app: App,
  metadata: PostMetadata,
  feed: Feed,
  root: Post | null,      // Root post if this is comment/quote
  quoteOf: Post | null,   // Quoted post
  commentOn: Post | null, // Parent comment
  stats: {
    comments: 42,
    quotes: 10,
    reposts: 5,
    reactions: 100,
    bookmarks: 20,
    // …
  },
  operations: {
    canComment: ValidationResult,
    canQuote: ValidationResult,
    canRepost: ValidationResult,
    // …
  }
}
```

### Post Metadata Standards (v3)
Available schema types:
- **TextOnly:** Pure text posts
- **Article:** Long-form content (blogs, market descriptions)
- **Image:** Image-focused posts
- **Video:** Video-focused posts
- **Audio:** Audio content
- **Event:** Physical/virtual events
- **Link:** Shared links
- **CheckingIn:** Location sharing
- **LiveStream:** Live stream events
- **Mint:** NFT minting links
- **Space:** Social spaces
- **Story:** Story-format media
- **3D:** 3D assets
- **Transaction:** On-chain transactions
- **ShortVideo:** Short video content

JSON Schema URLs: `https://json-schemas.lens.dev/posts/<type>/3.0.0.json`

---

## 5. Post Actions

Post Actions are on-chain contracts that execute logic when triggered on a post. **Critical for prediction markets:** resolution, payouts, oracles.

### How Post Actions Work
1. **ActionHub:** Central entry point for all actions
2. **IPostAction Interface:**
   ```solidity
   interface IPostAction {
     function configure(address originalMsgSender, uint256 postId, KeyValue[] calldata params) external returns (bytes memory);
     function execute(address originalMsgSender, uint256 postId, KeyValue[] calldata params) external returns (bytes memory);
     function setDisabled(address originalMsgSender, uint256 postId, bool isDisabled, KeyValue[] calldata params) external returns (bytes memory);
   }
   ```

### Post Action Lifecycle
1. **Configure:** Initialize action state for a post
2. **Execute:** Trigger action logic (anyone can call, permissions defined in contract)
3. **Disable/Enable:** Turn action on/off for a post

### Example: Market Resolution Action
```solidity
contract MarketResolutionAction is BasePostAction {
    mapping(uint256 => Resolution) private _resolutions;
    
    struct Resolution {
        address oracle;
        uint256 resolutionTime;
        bytes32 outcome;
        bool resolved;
    }
    
    function _configure(
        address originalMsgSender,
        uint256 postId,
        KeyValue[] calldata params
    ) internal override returns (bytes memory) {
        // Only post author can configure
        require(originalMsgSender == IFeed(msg.sender).getPost(postId).author);
        
        address oracle;
        uint256 resolutionTime;
        
        for (uint256 i = 0; i < params.length; i++) {
            if (params[i].key == keccak256("lens.param.oracle")) {
                oracle = abi.decode(params[i].value, (address));
            } else if (params[i].key == keccak256("lens.param.resolutionTime")) {
                resolutionTime = abi.decode(params[i].value, (uint256));
            }
        }
        
        _resolutions[postId] = Resolution({
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
        Resolution storage res = _resolutions[postId];
        require(!res.resolved, "Already resolved");
        require(block.timestamp >= res.resolutionTime, "Too early");
        require(originalMsgSender == res.oracle, "Only oracle");
        
        bytes32 outcome;
        for (uint256 i = 0; i < params.length; i++) {
            if (params[i].key == keccak256("lens.param.outcome")) {
                outcome = abi.decode(params[i].value, (bytes32));
            }
        }
        
        res.outcome = outcome;
        res.resolved = true;
        
        // Emit event, trigger payouts, etc.
        return abi.encode(outcome);
    }
}
```

### Configuring Post Actions
```typescript
import { configurePostAction, blockchainData } from "@lens-protocol/client/actions";

const result = await configurePostAction(sessionClient, {
  post: postId("42"),
  action: {
    unknown: {
      address: evmAddress("0x1234…"), // Your action contract
      params: [{
        raw: {
          key: blockchainData(keccak256("lens.param.oracle")),
          data: blockchainData(abiEncode(["address"], [oracleAddress]))
        }
      }]
    }
  }
});
```

### Executing Post Actions
```typescript
import { executePostAction } from "@lens-protocol/client/actions";

const result = await executePostAction(sessionClient, {
  post: postId("42"),
  action: {
    unknown: {
      address: evmAddress("0x1234…"),
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

---

## 6. Apps

Apps are on-chain entities that manage feeds, sponsorships, and user experiences.

### Creating an App
```typescript
import { createApp } from "@lens-protocol/client/actions";

const result = await createApp(sessionClient, {
  metadataUri: uri("lens://…"),
  defaultFeedAddress: evmAddress("0x…"), // Optional
});
```

### App Metadata
```typescript
import { app } from "@lens-protocol/metadata";

const metadata = app({
  name: "Prediction Markets",
  logo: "lens://…",
  description: "Decentralized prediction markets on Lens",
  url: "https://markets.example.com",
  platforms: ["web", "mobile"],
  termsOfService: "https://markets.example.com/terms",
  privacyPolicy: "https://markets.example.com/privacy"
});
```

### Authorization Workflows
Apps can implement custom authorization flows for account access:
1. User connects wallet
2. App requests account access
3. User signs authorization
4. App receives delegated permissions (Account Manager role)

---

## 7. Groups

Groups are on-chain communities with membership management.

### Creating a Group
```typescript
import { createGroup } from "@lens-protocol/client/actions";

const result = await createGroup(sessionClient, {
  metadataUri: uri("lens://…"),
  rules: {
    required: [/* membership rules */]
  }
});
```

### Joining Groups
```typescript
import { joinGroup } from "@lens-protocol/client/actions";

const result = await joinGroup(sessionClient, {
  group: evmAddress("0x…")
});
```

### Group Features
- Membership rules (token gating, NFT ownership, custom contracts)
- Member management (approve/ban)
- Group-specific feeds
- Governance capabilities

---

## 8. Graphs (Follow/Unfollow)

### Custom Graphs
Create custom social graphs beyond the default follow system:
```typescript
import { createGraph } from "@lens-protocol/client/actions";

const result = await createGraph(sessionClient, {
  metadataUri: uri("lens://…"),
  rules: {
    required: [/* follow rules */]
  }
});
```

### Following
```typescript
import { follow } from "@lens-protocol/client/actions";

// Check if allowed
if (account.operations.canFollow.__typename === "FollowOperationValidationPassed") {
  const result = await follow(sessionClient, {
    account: evmAddress("0x…"),
    graph: evmAddress("0x…") // Optional: specific graph
  });
}
```

### Follow Rules
Examples:
- Token-gated follows (require specific ERC20 balance)
- NFT-gated follows
- Paid follows (charge fee)
- Approval-required follows

---

## 9. Usernames & Namespaces

### Global Namespace
Default namespace: `lens/`
- Free usernames available
- Example: `lens/alice`

### Custom Namespaces
Create branded namespaces:
```typescript
import { createUsername } from "@lens-protocol/client/actions";

const result = await createUsername(sessionClient, {
  localName: "alice",
  namespace: evmAddress("0x…") // Custom namespace contract
});
```

### Namespace Rules
- Token gating
- Fee requirements
- Approval workflows
- Reserved names

---

## 10. Sponsorships (Gasless Transactions)

Enable gasless transactions for users via App sponsorships.

### How Sponsorships Work
1. App configures sponsorship pool (deposits GHO/GRASS)
2. Users perform actions without gas
3. App's sponsorship pool covers transaction costs

### Transaction Types
```typescript
// When creating posts/follows/etc., result may be:
{
  __typename: "SponsoredTransactionRequest",
  // App sponsors the transaction
  // User signs, app pays gas
}

{
  __typename: "SelfFundedTransactionRequest",
  // User pays own gas
  // Standard transaction flow
}
```

### Configuring Sponsorships
```typescript
import { manageSponsorships } from "@lens-protocol/client/actions";

const result = await manageSponsorships(sessionClient, {
  app: evmAddress("0x…"),
  // Enable for specific actions
  sponsoredActions: {
    post: true,
    comment: true,
    follow: true,
    // …
  }
});
```

---

## 11. Storage (Grove)

Grove is Lens's decentralized storage layer for metadata and media.

### Lens URI Format
```
lens://<storage_key>
```
Example: `lens://af5225b6262e03be6bfacf31aa416ea5e00ebb05e802d0573222a92f8d0677f5`

### Uploading Files
```typescript
import { StorageClient } from "@lens-chain/storage-client";

const storageClient = new StorageClient({ environment: "testnet" });

// Single file
const { uri } = await storageClient.uploadFile(file);

// JSON metadata
const { uri } = await storageClient.uploadAsJson(metadata);

// Folder with index
const { folder, files } = await storageClient.uploadFolder(fileList, {
  index: (resources) => account({
    name: "Alice",
    picture: resources[0].uri
  })
});
```

### Access Control
```typescript
import { lensAccountOnly, walletOnly, genericAcl } from "@lens-chain/storage-client";

// Lens Account only
const acl = lensAccountOnly("0x1234…", chains.testnet.id);

// Wallet only
const acl = walletOnly("0x1234…", chains.testnet.id);

// Custom contract call
const acl = genericAcl(chains.testnet.id)
  .withContractAddress("0x…")
  .withFunctionSig("isAuthorized(address)")
  .withParams([RECOVERED_ADDRESS_PARAM_MARKER])
  .build();

// Upload with ACL
const { uri } = await storageClient.uploadFile(file, { acl });
```

### Editing/Deleting
```typescript
// Edit (requires signature from authorized address)
await storageClient.editFile("lens://…", newFile, walletClient, { acl });

// Delete (requires signature from authorized address)
await storageClient.delete("lens://…", walletClient);
```

### Resolving URIs
```typescript
const url = storageClient.resolve("lens://af5225b…");
// Returns: https://api.grove.storage/af5225b…
```

---

## 12. Rules System

Rules are on-chain contracts that enforce conditions for actions.

### Rule Types
1. **Feed Rules:** Who can post to a feed
2. **Post Rules:** Who can interact with a post (comment/quote/repost)
3. **Graph Rules:** Who can follow/unfollow
4. **Namespace Rules:** Who can create usernames
5. **Group Rules:** Who can join groups

### Built-in Rules
- **FollowersOnlyRule:** Restrict to followers of a graph
- **TokenGateRule:** Require ERC20/ERC721 ownership
- **ChargeRule:** Require payment
- **ApprovalRule:** Require manual approval

### Custom Rules
Implement `IRule` interface:
```solidity
interface IRule {
  function configure(address actor, bytes calldata config) external returns (bytes memory);
  function verify(address actor, bytes calldata config) external view returns (bool);
}
```

---

## 13. SDK Methods Overview

### TypeScript Client
```typescript
import { PublicClient, mainnet } from "@lens-protocol/client";
import { fetchPosts, post, follow } from "@lens-protocol/client/actions";

const client = PublicClient.create({ environment: mainnet });

// Unauthenticated
const posts = await fetchPosts(client, {/* … */});

// Authenticated
const sessionClient = await client.login({/* … */});
await post(sessionClient, {/* … */});
```

### React Hooks
```typescript
import { usePosts, usePost, useFollow } from "@lens-protocol/react";

function Component() {
  const { data, loading } = usePosts({ filter: {/* … */} });
  const { execute } = useFollow();
  
  // …
}
```

### GraphQL API
```graphql
# Direct API access
query {
  posts(request: { pageSize: TEN }) {
    items {
      id
      author { username { value } }
      metadata { ... on TextOnlyMetadata { content } }
    }
  }
}
```

---

## 14. Prediction Market Integration Strategy

### Posts as Markets
1. **Market Creation**
   ```typescript
   const marketMetadata = article({
     title: "ETH > $3000 by EOY 2026?",
     content: `
       ## Resolution Criteria
       - Source: Chainlink ETH/USD oracle
       - Resolution Time: 2026-12-31 23:59 UTC
       - Outcome: YES if price >= $3000, NO otherwise
       
       ## Market Maker
       CPMM with 0.3% fees
     `,
     tags: ["prediction-market", "eth", "price", "2026"],
     attributes: [
       { key: "market_type", value: "binary" },
       { key: "resolution_oracle", value: "chainlink" },
       { key: "oracle_address", value: "0x…" }
     ]
   });
   
   const { uri } = await storageClient.uploadAsJson(marketMetadata);
   const result = await post(sessionClient, { 
     contentUri: uri,
     // Configure market resolution action
   });
   ```

2. **Configure Resolution Action**
   ```typescript
   await configurePostAction(sessionClient, {
     post: marketPostId,
     action: {
       unknown: {
         address: MARKET_RESOLUTION_CONTRACT,
         params: [
           { raw: { key: oracleKey, data: encodeOracle() } },
           { raw: { key: resolutionTimeKey, data: encodeTime() } }
         ]
       }
     }
   });
   ```

### Comments as Positions
```typescript
// User commits to position
const commitMetadata = textOnly({
  content: `Position: YES, Amount: 100 USDC, Entry Price: 0.65`,
  attributes: [
    { key: "position_type", value: "YES" },
    { key: "amount", value: "100" },
    { key: "token", value: "0xUSDC…" },
    { key: "entry_price", value: "0.65" }
  ]
});

await post(sessionClient, {
  contentUri: await upload(commitMetadata),
  commentOn: { post: marketPostId }
});
```

### Post Actions for Resolution
```solidity
// Triggered when market resolves
function _execute(
    address originalMsgSender,
    uint256 postId,
    KeyValue[] calldata params
) internal override returns (bytes memory) {
    // 1. Verify oracle signature
    // 2. Record outcome
    // 3. Trigger payout logic (could interact with separate market contract)
    // 4. Emit events for indexing
    
    bytes32 outcome = verifyAndResolve(params);
    triggerPayouts(postId, outcome);
    
    return abi.encode(outcome);
}
```

### Indexing Strategy
1. Index post metadata via API
2. Filter for `prediction-market` tag
3. Parse metadata attributes for market parameters
4. Track comments for position history
5. Monitor Post Action execution for resolutions

---

## 15. Limitations & Gotchas

### Protocol Limitations
1. **Cross-feed interactions:** Comments and quotes currently limited to same feed
2. **Rules complexity:** Unknown rules require ad-hoc implementation
3. **Storage immutability:** Default lens:// URIs are immutable unless ACL configured
4. **Account abstraction:** Lens Chain uses ZKsync, requires specific wallet support

### Performance Considerations
1. **GraphQL query depth:** Use fragments carefully to avoid overfetching
2. **Pagination:** Always implement proper cursor-based pagination
3. **Metadata uploads:** Can be slow for large files, use progressive upload UX
4. **Transaction finality:** ZKsync L2 finality ~15 seconds

### Security Gotchas
1. **Post Actions:** Must inherit `BasePostAction` and restrict to ActionHub
2. **Access Tokens:** 10-minute expiry, implement refresh flow
3. **Server API Keys:** Never expose in client code
4. **Metadata validation:** Always validate metadata against JSON schemas
5. **Oracle trust:** Resolution actions depend on oracle security

### Development Tips
1. **Use TypeScript SDK:** Much easier than raw GraphQL
2. **Test on testnet first:** GRASS tokens available from faucets
3. **Custom fragments:** Define early to avoid refactoring
4. **Error handling:** SDK uses `Result<T, E>` pattern, handle both paths
5. **Sponsorships:** Configure early to improve UX

---

## 16. Key API Operations

### Authentication
- `challenge` → `authenticate` → get tokens
- `refresh` → renew tokens
- `revokeAuthentication` → logout

### Accounts
- `createAccount` → onboard users
- `account` / `accounts` / `accountsAvailable` → fetch
- `addAccountManager` / `removeAccountManager` → delegation
- `setAccountMetadata` → update profile

### Posts & Feeds
- `post` → create post/comment/quote
- `posts` / `post` → fetch
- `editPost` / `deletePost` → manage
- `repost` → share
- `timeline` / `timelineHighlights` → personalized feeds

### Actions
- `configurePostAction` / `executePostAction` → post actions
- `configureAccountAction` / `executeAccountAction` → account actions

### Social Graph
- `follow` / `unfollow` → relationships
- `createGraph` → custom graphs
- `followers` / `following` → query

### Groups
- `createGroup` / `joinGroup` / `leaveGroup`
- `group` / `groups` / `groupMembers`

### Apps
- `createApp` / `updateApp`
- `app` / `apps`

### Usernames
- `createUsername` / `assignUsername`
- `canCreateUsername` → validation

### Sponsorships
- `fundSponsorship` / `withdrawSponsorship`
- `sponsorshipAllowance` → query

---

## 17. Relevant for Prediction Markets

### Must-Use Features
1. **Posts with Article metadata:** Market descriptions with structured data
2. **Post Actions:** On-chain resolution and payout logic
3. **Comments:** Position tracking and commit history
4. **Tags & attributes:** Market categorization and filtering
5. **Sponsorships:** Enable gasless market participation

### Nice-to-Have Features
1. **Groups:** Create trader communities
2. **Custom Graphs:** Follow specific market creators
3. **Post Rules:** Restrict who can participate in markets
4. **Reactions:** Quick sentiment signals
5. **Notifications:** Alert on market events

### Not Immediately Relevant
1. **Video/Audio metadata:** Unless markets on event outcomes
2. **Live streams:** Could be used for market commentary
3. **Account Actions (tipping):** Could enable trader incentives
4. **3D assets:** Likely not needed

---

## 18. Code Examples

### Complete Market Creation Flow
```typescript
import { PublicClient, mainnet } from "@lens-protocol/client";
import { post, configurePostAction } from "@lens-protocol/client/actions";
import { article } from "@lens-protocol/metadata";
import { StorageClient } from "@lens-chain/storage-client";
import { signMessageWith } from "@lens-protocol/client/viem";

// 1. Setup clients
const client = PublicClient.create({ environment: mainnet });
const storageClient = new StorageClient({ environment: "production" });

// 2. Authenticate
const sessionClient = await client.login({
  accountOwner: {
    account: "0xMARKET_CREATOR…",
    app: "0xPREDICTION_MARKETS_APP…",
    owner: walletClient.account.address
  },
  signMessage: signMessageWith(walletClient)
});

// 3. Create market metadata
const marketMetadata = article({
  title: "Will ETH be above $3000 by EOY 2026?",
  content: `
    ## Resolution Criteria
    - Oracle: Chainlink ETH/USD (0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419)
    - Resolution Time: December 31, 2026 23:59:59 UTC
    - YES outcome: Price >= $3000.00
    - NO outcome: Price < $3000.00
    
    ## Market Parameters
    - Type: Binary prediction market
    - Initial liquidity: 10,000 USDC
    - Trading fee: 0.3%
  `,
  tags: ["prediction-market", "ethereum", "price", "2026"],
  attributes: [
    { key: "market_type", value: "binary" },
    { key: "oracle_type", value: "chainlink" },
    { key: "oracle_address", value: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419" },
    { key: "resolution_timestamp", value: "1735689599" },
    { key: "yes_threshold", value: "3000" }
  ]
});

// 4. Upload metadata
const { uri } = await storageClient.uploadAsJson(marketMetadata);

// 5. Create post (market)
const postResult = await post(sessionClient, {
  contentUri: uri("lens://…")
});

const hash = await postResult
  .andThen(handleOperationWith(walletClient))
  .andThen(sessionClient.waitForTransaction);

// 6. Get post ID from transaction
const marketPostId = await getPostIdFromHash(hash);

// 7. Configure resolution action
await configurePostAction(sessionClient, {
  post: postId(marketPostId),
  action: {
    unknown: {
      address: evmAddress("0xMARKET_RESOLUTION_CONTRACT…"),
      params: [{
        raw: {
          key: blockchainData(keccak256("lens.param.oracle")),
          data: blockchainData(
            abiEncode(["address"], ["0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419"])
          )
        }
      }, {
        raw: {
          key: blockchainData(keccak256("lens.param.resolutionTime")),
          data: blockchainData(
            abiEncode(["uint256"], [1735689599])
          )
        }
      }]
    }
  }
}).andThen(handleOperationWith(walletClient));

console.log(`Market created with post ID: ${marketPostId}`);
```

---

## Summary

Lens Protocol v3 provides a robust foundation for building decentralized prediction markets:

**Strengths:**
- Native on-chain actions for trustless resolution
- Rich metadata system for market descriptions
- Built-in social primitives (comments for positions, follows for traders)
- Sponsorships for UX (gasless trades)
- Decentralized storage (Grove)
- Active development and strong ecosystem

**Considerations:**
- Requires ZKsync-compatible wallets
- Cross-feed limitations for comments/quotes
- Custom rule development for complex market permissions
- Indexing infrastructure needed for market discovery

**Next Steps:**
1. Deploy test market on testnet (chainId 37111)
2. Implement market resolution contract (IPostAction)
3. Build indexer for market discovery (filter posts by tags)
4. Design position commitment flow (comments with metadata)
5. Integrate sponsorships for seamless UX

**Resources:**
- SDK: https://github.com/lens-protocol/lens-sdk
- API Examples: https://github.com/lens-protocol/api-examples
- Contracts: https://github.com/lens-protocol/lens-v3
- Docs: https://docs.lens.xyz

---

**End of Technical Review**
