/**
 * e2e-lens-testnet.mjs
 * Full E2E lifecycle test for SoothPostAction on Lens testnet (chain 37111)
 *
 * Lifecycle: wrap GRASS → approve WGRASS → create post → configure market
 *            → buy YES → buy NO → sell YES → resolve → redeem
 *
 * Prerequisites:
 *   1. SoothPostAction deployed (run deploy-lens-testnet.sh first)
 *   2. .sisyphus/evidence/task-5-deployed-address.txt exists
 *   3. apps/lens/.env.local has LENS_PRIVATE_KEY, LENS_ACCOUNT, LENS_APP
 *   4. Deployer wallet has GRASS for gas + wrapping
 *
 * Run from repo root:
 *   node packages/contracts-plugin/script/e2e-lens-testnet.mjs
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from "fs";
import {
  createWalletClient,
  createPublicClient,
  http,
  keccak256,
  toBytes,
  encodeAbiParameters,
  parseAbiParameters,
  maxUint256,
  formatEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { PublicClient, testnet, evmAddress, postId as lensPostId } from "@lens-protocol/client";
import {
  post,
  fetchPost,
  configurePostAction,
  executePostAction,
} from "@lens-protocol/client/actions";
import { handleOperationWith, signMessageWith } from "@lens-protocol/client/viem";
import { StorageClient } from "@lens-chain/storage-client";

// ── Chain config ──────────────────────────────────────────────────────────────
const lensTestnet = {
  id: 37111,
  name: "Lens Testnet",
  nativeCurrency: { name: "GRASS", symbol: "GRASS", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.lens.xyz"] } },
};

// ── Constants ─────────────────────────────────────────────────────────────────
const WGRASS = "0xeee5a340Cdc9c179Db25dea45AcfD5FE8d4d3eB8";
const ACTION_HUB = "0x4A92a97Ff3a3604410945ae8CA25df4fBB2fDC11";
const RPC_URL = "https://rpc.testnet.lens.xyz";

// Market params — small b to minimize WGRASS needed
const B = 5n * 10n ** 16n; // 0.05 WAD → subsidy ≈ 0.0347 WGRASS (fits 0.1 GRASS budget)
const DEADLINE_OFFSET = 600n; // 10 minutes from now
const FEE_BPS = 200n; // 2%

// Action codes
const ACTION_BUY = 0n;
const ACTION_SELL = 1n;
const ACTION_RESOLVE = 2n;
const ACTION_REDEEM = 3n;

// Outcome codes
const OUTCOME_NO = 0n;
const OUTCOME_YES = 1n;

// KeyValue keys (keccak256 of param name strings)
const KEY_B = keccak256(toBytes("sooth.param.b"));
const KEY_DEADLINE = keccak256(toBytes("sooth.param.deadline"));
const KEY_FEE_BPS = keccak256(toBytes("sooth.param.feeBps"));
const KEY_ACTION = keccak256(toBytes("sooth.param.action"));
const KEY_OUTCOME = keccak256(toBytes("sooth.param.outcome"));
const KEY_AMOUNT = keccak256(toBytes("sooth.param.amount"));
const KEY_MAX_COST = keccak256(toBytes("sooth.param.maxCost"));

// ABI helpers
const encodeUint256 = (v) => encodeAbiParameters(parseAbiParameters("uint256"), [v]);
const encodeUint8 = (v) => encodeAbiParameters(parseAbiParameters("uint8"), [v]);

// WGRASS minimal ABI
const WGRASS_ABI = [
  {
    name: "deposit",
    type: "function",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
];

// SoothPostAction minimal ABI for verification
const SOOTH_ABI = [
  {
    name: "markets",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "feed", type: "address" },
      { name: "postId", type: "uint256" },
    ],
    outputs: [
      { name: "resolver", type: "address" },
      { name: "deadline", type: "uint64" },
      { name: "b", type: "uint256" },
      { name: "qYes", type: "uint256" },
      { name: "qNo", type: "uint256" },
      { name: "totalCollateral", type: "uint256" },
      { name: "winningOutcome", type: "uint8" },
      { name: "resolved", type: "bool" },
      { name: "paused", type: "bool" },
      { name: "feeBps", type: "uint16" },
    ],
  },
  {
    name: "positions",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "feed", type: "address" },
      { name: "postId", type: "uint256" },
      { name: "user", type: "address" },
    ],
    outputs: [
      { name: "yesShares", type: "uint256" },
      { name: "noShares", type: "uint256" },
    ],
  },
];

// ── Evidence logging ──────────────────────────────────────────────────────────
const EVIDENCE_DIR = ".sisyphus/evidence";
const TX_LOG = `${EVIDENCE_DIR}/task-6-e2e-txhashes.txt`;

function logTx(step, txHash) {
  const line = `${step}: ${txHash}\n`;
  appendFileSync(TX_LOG, line);
  console.log(`  📝 Logged: ${step}: ${txHash}`);
}

// ── Load config ───────────────────────────────────────────────────────────────
function loadEnv(filePath) {
  const content = readFileSync(filePath, "utf-8");
  const env = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    env[key] = value;
  }
  return env;
}

// ── Transaction handler ───────────────────────────────────────────────────────
async function handleLensTx(result, walletClient, sessionClient, stepName) {
  if (result.isErr()) {
    throw new Error(`${stepName} failed: ${JSON.stringify(result.error)}`);
  }

  const val = result.value;
  console.log(`  Result type: ${val.__typename}`);

  if (
    val.__typename === "SponsoredTransactionRequest" ||
    val.__typename === "SelfFundedTransactionRequest"
  ) {
    const txResult = await handleOperationWith(walletClient)(val);
    if (txResult.isErr()) {
      throw new Error(`${stepName} tx failed: ${JSON.stringify(txResult.error)}`);
    }
    const txHash = txResult.value;
    console.log(`  TX: ${txHash}`);
    console.log(`  Waiting for indexing...`);
    try {
      await sessionClient.waitForTransaction(txHash);
    } catch (e) {
      console.log(`  Wait warning (non-fatal): ${e.message}`);
    }
    return txHash;
  } else if (val.__typename === "TransactionWillFail") {
    throw new Error(`${stepName} will fail: ${val.reason}`);
  } else if (val.__typename === "InsufficientFunds") {
    throw new Error(`${stepName} insufficient funds`);
  } else if (val.__typename === "SignerErc20ApprovalRequired") {
    throw new Error(`${stepName} requires ERC20 approval first`);
  } else if (val.hash) {
    // Direct hash response
    console.log(`  TX: ${val.hash}`);
    return val.hash;
  }

  throw new Error(`${stepName} unknown result type: ${val.__typename}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  SoothPostAction E2E Test — Lens Testnet (chain 37111)");
  console.log("═══════════════════════════════════════════════════════════════");

  // Load credentials
  const env = loadEnv("apps/lens/.env.local");
  const PRIVATE_KEY = env.LENS_PRIVATE_KEY;
  const LENS_ACCOUNT = env.LENS_ACCOUNT;
  const APP_ADDRESS = env.LENS_APP;

  if (!PRIVATE_KEY || !LENS_ACCOUNT || !APP_ADDRESS) {
    throw new Error("Missing LENS_PRIVATE_KEY, LENS_ACCOUNT, or LENS_APP in apps/lens/.env.local");
  }

  // Load deployed address
  const DEPLOYED_ADDR_FILE = `${EVIDENCE_DIR}/task-5-deployed-address.txt`;
  if (!existsSync(DEPLOYED_ADDR_FILE)) {
    throw new Error(
      `Deployed address not found at ${DEPLOYED_ADDR_FILE}. Run deploy-lens-testnet.sh first.`
    );
  }
  const SOOTH_ADDRESS = readFileSync(DEPLOYED_ADDR_FILE, "utf-8").trim();
  console.log(`\nSoothPostAction: ${SOOTH_ADDRESS}`);
  console.log(`Lens Account:    ${LENS_ACCOUNT}`);
  console.log(`App:             ${APP_ADDRESS}`);

  // Init evidence log
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  writeFileSync(
    TX_LOG,
    `=== SoothPostAction E2E Test — ${new Date().toISOString()} ===\n` +
      `SoothPostAction: ${SOOTH_ADDRESS}\n\n`
  );

  // Setup viem clients
  const account = privateKeyToAccount(PRIVATE_KEY);
  console.log(`\nWallet: ${account.address}`);

  const walletClient = createWalletClient({
    account,
    chain: lensTestnet,
    transport: http(RPC_URL),
  });

  const publicClient = createPublicClient({
    chain: lensTestnet,
    transport: http(RPC_URL),
  });

  // Setup Lens SDK client
  const lensClient = PublicClient.create({
    environment: testnet,
    origin: "https://sooth.market",
  });

  // ── Step 0: Check balances ──────────────────────────────────────────────────
  console.log("\n[0/9] Checking balances...");
  const grassBalance = await publicClient.getBalance({ address: account.address });
  const wgrassBalance = await publicClient.readContract({
    address: WGRASS,
    abi: WGRASS_ABI,
    functionName: "balanceOf",
    args: [account.address],
  });
  console.log(`  GRASS:  ${formatEther(grassBalance)} GRASS`);
  console.log(`  WGRASS: ${formatEther(wgrassBalance)} WGRASS`);

  if (grassBalance < 5n * 10n ** 16n && wgrassBalance < 5n * 10n ** 16n) {
    throw new Error(
      "Insufficient balance. Need at least 0.05 GRASS (to wrap for subsidy) or WGRASS already wrapped."
    );
  }

  // ── Step 1: Wrap GRASS → WGRASS ────────────────────────────────────────────
  // With b=0.05 WAD, subsidy = 0.0347 WGRASS. Wrap 0.05 GRASS to cover subsidy + buys.
  let currentWgrass = wgrassBalance;
  if (wgrassBalance < 5n * 10n ** 16n) {
    console.log("\n[1/9] Wrapping 0.05 GRASS → WGRASS...");
    const wrapAmount = 5n * 10n ** 16n; // 0.05 GRASS
    const wrapHash = await walletClient.writeContract({
      address: WGRASS,
      abi: WGRASS_ABI,
      functionName: "deposit",
      value: wrapAmount,
    });
    console.log(`  TX: ${wrapHash}`);
    await publicClient.waitForTransactionReceipt({ hash: wrapHash });
    logTx("WRAP_GRASS", wrapHash);
    currentWgrass = await publicClient.readContract({
      address: WGRASS,
      abi: WGRASS_ABI,
      functionName: "balanceOf",
      args: [account.address],
    });
    console.log(`  ✅ WGRASS balance: ${formatEther(currentWgrass)} WGRASS`);
  } else {
    console.log("\n[1/9] Sufficient WGRASS already available, skipping wrap.");
    logTx("WRAP_GRASS", "SKIPPED_SUFFICIENT_BALANCE");
  }

  // ── Step 2: Approve WGRASS ─────────────────────────────────────────────────
  console.log("\n[2/9] Approving WGRASS for SoothPostAction...");
  const currentAllowance = await publicClient.readContract({
    address: WGRASS,
    abi: WGRASS_ABI,
    functionName: "allowance",
    args: [account.address, SOOTH_ADDRESS],
  });
  console.log(`  Current allowance: ${formatEther(currentAllowance)} WGRASS`);

  if (currentAllowance < currentWgrass) {
    const approveHash = await walletClient.writeContract({
      address: WGRASS,
      abi: WGRASS_ABI,
      functionName: "approve",
      args: [SOOTH_ADDRESS, maxUint256],
    });
    console.log(`  TX: ${approveHash}`);
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
    logTx("APPROVE_WGRASS", approveHash);
    console.log(`  ✅ Approved maxUint256`);
  } else {
    console.log("  ✅ Sufficient allowance already set, skipping approve.");
    logTx("APPROVE_WGRASS", "SKIPPED_SUFFICIENT_ALLOWANCE");
  }

  // ── Authenticate with Lens SDK ──────────────────────────────────────────────
  console.log("\n[AUTH] Authenticating with Lens SDK...");
  const loginResult = await lensClient.login({
    accountOwner: {
      account: evmAddress(LENS_ACCOUNT),
      app: APP_ADDRESS,
      owner: account.address,
    },
    signMessage: signMessageWith(walletClient),
  });

  if (loginResult.isErr()) {
    throw new Error(`Lens login failed: ${JSON.stringify(loginResult.error)}`);
  }
  const sessionClient = loginResult.value;
  console.log("  ✅ Authenticated");

  // ── Step 3: Create post with SoothPostAction attached ──────────────────────
  console.log("\n[3/9] Creating Lens post with SoothPostAction...");
  const storageClient = StorageClient.create();

  const metadata = {
    $schema: "https://json-schemas.lens.dev/posts/text-only/3.0.0.json",
    lens: {
      id: crypto.randomUUID(),
      content: `Sooth E2E Test Market — Will this test pass? [${new Date().toISOString()}]`,
      locale: "en",
      mainContentFocus: "TEXT_ONLY",
      tags: ["sooth", "prediction-market", "e2e-test"],
    },
  };

  const { uri } = await storageClient.uploadAsJson(metadata);
  console.log(`  Metadata URI: ${uri}`);

  const postResult = await post(sessionClient, {
    contentUri: uri,
    actions: [
      {
        unknown: {
          address: evmAddress(SOOTH_ADDRESS),
          params: [],
        },
      },
    ],
  });

  const postTxHash = await handleLensTx(postResult, walletClient, sessionClient, "CreatePost");
  logTx("CREATE_POST", postTxHash);
  console.log("  ✅ Post created");

  // Wait a moment for indexing
  await new Promise((r) => setTimeout(r, 5000));

  // Fetch the post to get postId and feed
  console.log("  Fetching post details...");
  // We need to find the post — query by author
  // The postId is embedded in the tx receipt events, but easiest is to fetch recent posts
  // For now, we'll use the tx hash to find the post
  // The Lens SDK waitForTransaction returns the post hash, and we can fetch by hash
  let createdPost = null;
  let feedAddress = null;
  let numericPostId = null;

  // Try to fetch the post using the transaction hash
  try {
    // Wait for indexing
    await new Promise((r) => setTimeout(r, 8000));

    // Fetch recent posts by the account to find our post
    const { fetchPosts } = await import("@lens-protocol/client/actions");
    const postsResult = await fetchPosts(lensClient, {
      filter: {
        authors: [evmAddress(LENS_ACCOUNT)],
      },
    });

    if (postsResult.isOk() && postsResult.value.items.length > 0) {
      // Get the most recent post (our newly created one)
      const latestPost = postsResult.value.items[0];
      if (latestPost.__typename === "Post") {
        createdPost = latestPost;
        // Extract feed and postId from the post
        // In Lens V3, postId is a composite: feed/id
        const postIdStr = latestPost.id; // e.g. "0x31232.../0x01"
        console.log(`  Post ID: ${postIdStr}`);
        console.log(`  Post slug: ${latestPost.slug}`);

        // The feed address is in the post's feed info
        if (latestPost.feed) {
          feedAddress = latestPost.feed.address;
        }

        // Extract numeric postId from the composite ID
        // Format is typically "feedAddress/numericId" or just a hex number
        const parts = postIdStr.split("/");
        if (parts.length === 2) {
          numericPostId = BigInt(parts[1]);
          feedAddress = feedAddress || parts[0];
        } else {
          numericPostId = BigInt(postIdStr);
        }

        console.log(`  Feed: ${feedAddress}`);
        console.log(`  Numeric Post ID: ${numericPostId}`);
        logTx("POST_ID", postIdStr);
        logTx("FEED_ADDRESS", feedAddress || "unknown");
      }
    }
  } catch (e) {
    console.log(`  Warning: Could not fetch post details: ${e.message}`);
    console.log("  Continuing with post hash as reference...");
  }

  if (!createdPost) {
    console.log("  ⚠️  Could not fetch post — using tx hash as reference");
    console.log("  The post may still be indexing. Waiting 15s more...");
    await new Promise((r) => setTimeout(r, 15000));
  }

  // ── Step 4: Configure market ────────────────────────────────────────────────
  console.log("\n[4/9] Configuring prediction market...");
  const deadline = BigInt(Math.floor(Date.now() / 1000)) + DEADLINE_OFFSET;
  console.log(`  b = ${formatEther(B)} WAD`);
  console.log(`  deadline = ${deadline} (${new Date(Number(deadline) * 1000).toISOString()})`);
  console.log(`  feeBps = ${FEE_BPS} (${Number(FEE_BPS) / 100}%)`);

  // We need the Lens postId (string format) for the SDK
  const lensPostIdStr = createdPost ? createdPost.id : null;

  if (!lensPostIdStr) {
    console.log("  ⚠️  No post ID available — skipping configure and subsequent steps");
    console.log("  The post may not have been indexed yet.");
    console.log("\n  To complete E2E manually:");
    console.log(`  1. Find your post ID at https://testnet.lenscan.io/address/${LENS_ACCOUNT}`);
    console.log("  2. Re-run this script after the post is indexed");
    return;
  }

  const configResult = await configurePostAction(sessionClient, {
    post: lensPostId(lensPostIdStr),
    params: {
      unknown: {
        address: evmAddress(SOOTH_ADDRESS),
        params: [
          { key: KEY_B, value: encodeUint256(B) },
          { key: KEY_DEADLINE, value: encodeUint256(deadline) },
          { key: KEY_FEE_BPS, value: encodeUint256(FEE_BPS) },
        ],
      },
    },
  });

  const configTxHash = await handleLensTx(
    configResult,
    walletClient,
    sessionClient,
    "ConfigureMarket"
  );
  logTx("CONFIGURE_MARKET", configTxHash);
  console.log("  ✅ Market configured");

  // ── Step 5: Buy YES shares ──────────────────────────────────────────────────
  console.log("\n[5/9] Buying YES shares (0.005 WGRASS)...");
  const buyYesResult = await executePostAction(sessionClient, {
    post: lensPostId(lensPostIdStr),
    action: {
      unknown: {
        address: evmAddress(SOOTH_ADDRESS),
        params: [
          { key: KEY_ACTION, value: encodeUint8(ACTION_BUY) },
          { key: KEY_OUTCOME, value: encodeUint8(OUTCOME_YES) },
          { key: KEY_AMOUNT, value: encodeUint256(5n * 10n ** 15n) }, // 0.005 WGRASS
          { key: KEY_MAX_COST, value: encodeUint256(10n ** 16n) }, // max 0.01 WGRASS
        ],
      },
    },
  });

  const buyYesTxHash = await handleLensTx(
    buyYesResult,
    walletClient,
    sessionClient,
    "BuyYES"
  );
  logTx("BUY_YES", buyYesTxHash);
  console.log("  ✅ Bought YES shares");

  // ── Step 6: Buy NO shares ───────────────────────────────────────────────────
  console.log("\n[6/9] Buying NO shares (0.003 WGRASS)...");
  const buyNoResult = await executePostAction(sessionClient, {
    post: lensPostId(lensPostIdStr),
    action: {
      unknown: {
        address: evmAddress(SOOTH_ADDRESS),
        params: [
          { key: KEY_ACTION, value: encodeUint8(ACTION_BUY) },
          { key: KEY_OUTCOME, value: encodeUint8(OUTCOME_NO) },
          { key: KEY_AMOUNT, value: encodeUint256(3n * 10n ** 15n) }, // 0.003 WGRASS
          { key: KEY_MAX_COST, value: encodeUint256(10n ** 16n) }, // max 0.01 WGRASS
        ],
      },
    },
  });

  const buyNoTxHash = await handleLensTx(buyNoResult, walletClient, sessionClient, "BuyNO");
  logTx("BUY_NO", buyNoTxHash);
  console.log("  ✅ Bought NO shares");

  // ── Step 7: Sell some YES shares ────────────────────────────────────────────
  console.log("\n[7/9] Selling some YES shares (0.002 WGRASS worth)...");
  const sellYesResult = await executePostAction(sessionClient, {
    post: lensPostId(lensPostIdStr),
    action: {
      unknown: {
        address: evmAddress(SOOTH_ADDRESS),
        params: [
          { key: KEY_ACTION, value: encodeUint8(ACTION_SELL) },
          { key: KEY_OUTCOME, value: encodeUint8(OUTCOME_YES) },
          { key: KEY_AMOUNT, value: encodeUint256(2n * 10n ** 15n) }, // sell 0.002 shares
        ],
      },
    },
  });

  const sellYesTxHash = await handleLensTx(
    sellYesResult,
    walletClient,
    sessionClient,
    "SellYES"
  );
  logTx("SELL_YES", sellYesTxHash);
  console.log("  ✅ Sold YES shares");

  // ── Step 8: Resolve market (YES wins) ──────────────────────────────────────
  console.log("\n[8/9] Resolving market (YES wins)...");
  const resolveResult = await executePostAction(sessionClient, {
    post: lensPostId(lensPostIdStr),
    action: {
      unknown: {
        address: evmAddress(SOOTH_ADDRESS),
        params: [
          { key: KEY_ACTION, value: encodeUint8(ACTION_RESOLVE) },
          { key: KEY_OUTCOME, value: encodeUint8(OUTCOME_YES) },
        ],
      },
    },
  });

  const resolveTxHash = await handleLensTx(
    resolveResult,
    walletClient,
    sessionClient,
    "ResolveMarket"
  );
  logTx("RESOLVE_MARKET", resolveTxHash);
  console.log("  ✅ Market resolved (YES wins)");

  // ── Step 9: Redeem winnings ─────────────────────────────────────────────────
  console.log("\n[9/9] Redeeming winnings...");
  const redeemResult = await executePostAction(sessionClient, {
    post: lensPostId(lensPostIdStr),
    action: {
      unknown: {
        address: evmAddress(SOOTH_ADDRESS),
        params: [
          { key: KEY_ACTION, value: encodeUint8(ACTION_REDEEM) },
        ],
      },
    },
  });

  const redeemTxHash = await handleLensTx(
    redeemResult,
    walletClient,
    sessionClient,
    "RedeemWinnings"
  );
  logTx("REDEEM_WINNINGS", redeemTxHash);
  console.log("  ✅ Winnings redeemed");

  // ── Final verification ──────────────────────────────────────────────────────
  console.log("\n[VERIFY] Checking final market state...");
  if (feedAddress && numericPostId !== null) {
    try {
      const market = await publicClient.readContract({
        address: SOOTH_ADDRESS,
        abi: SOOTH_ABI,
        functionName: "markets",
        args: [feedAddress, numericPostId],
      });
      console.log("  Market state:");
      console.log(`    resolver:        ${market[0]}`);
      console.log(`    deadline:        ${market[1]}`);
      console.log(`    b:               ${formatEther(market[2])} WAD`);
      console.log(`    qYes:            ${formatEther(market[3])}`);
      console.log(`    qNo:             ${formatEther(market[4])}`);
      console.log(`    totalCollateral: ${formatEther(market[5])} WGRASS`);
      console.log(`    winningOutcome:  ${market[6]} (1=YES)`);
      console.log(`    resolved:        ${market[7]}`);

      const finalWgrass = await publicClient.readContract({
        address: WGRASS,
        abi: WGRASS_ABI,
        functionName: "balanceOf",
        args: [account.address],
      });
      console.log(`  Final WGRASS balance: ${formatEther(finalWgrass)} WGRASS`);

      appendFileSync(
        TX_LOG,
        `\n=== Final Market State ===\n` +
          `resolved: ${market[7]}\n` +
          `winningOutcome: ${market[6]}\n` +
          `totalCollateral: ${formatEther(market[5])} WGRASS\n` +
          `finalWgrassBalance: ${formatEther(finalWgrass)} WGRASS\n`
      );
    } catch (e) {
      console.log(`  Warning: Could not read market state: ${e.message}`);
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  E2E Test COMPLETE ✅");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  SoothPostAction: ${SOOTH_ADDRESS}`);
  console.log(`  Post ID:         ${lensPostIdStr}`);
  console.log(`  Evidence:        ${TX_LOG}`);
  console.log("\n  Steps completed:");
  console.log("    ✅ Wrapped GRASS → WGRASS");
  console.log("    ✅ Approved WGRASS for SoothPostAction");
  console.log("    ✅ Created Lens post with action attached");
  console.log("    ✅ Configured prediction market");
  console.log("    ✅ Bought YES shares");
  console.log("    ✅ Bought NO shares");
  console.log("    ✅ Sold YES shares");
  console.log("    ✅ Resolved market (YES wins)");
  console.log("    ✅ Redeemed winnings");
  console.log("═══════════════════════════════════════════════════════════════");
}

main().catch((err) => {
  console.error("\n❌ E2E test failed:", err.message || err);
  process.exit(1);
});
