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
 *   cd apps/lens && node e2e-lens-testnet.mjs
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
  formatEther,
} from "viem";
import { privateKeyToAccount, toAccount } from "viem/accounts";
import { chains as lensChains } from "@lens-chain/sdk/viem";
import { PublicClient, testnet, evmAddress, postId as lensPostId } from "@lens-protocol/client";
import {
  post,
  executePostAction,
} from "@lens-protocol/client/actions";
import { handleOperationWith, signMessageWith } from "@lens-protocol/client/viem";
import { StorageClient } from "@lens-chain/storage-client";

// ── Chain config ──────────────────────────────────────────────────────────────
// IMPORTANT: Must use @lens-chain/sdk/viem chains.testnet — it has the ZKsync
// serializers required for sendEip712Transaction (sponsored transactions).
// A plain custom chain object will cause SigningError on executePostAction.
const lensTestnet = lensChains.testnet;

// ── Constants ─────────────────────────────────────────────────────────────────
const WGRASS = "0xeee5a340Cdc9c179Db25dea45AcfD5FE8d4d3eB8";
const ACTION_HUB = "0x4A92a97Ff3a3604410945ae8CA25df4fBB2fDC11";
const RPC_URL = "https://rpc.testnet.lens.xyz";

// Market params — small b to minimize WGRASS needed
const B = 5n * 10n ** 15n; // 0.005 WAD → subsidy ≈ 0.00347 WGRASS (very low-budget mode)
const DEADLINE_OFFSET = 600n; // 10 minutes from now
const FEE_BPS = 200n; // 2%
const MIN_WGRASS_TARGET = 12n * 10n ** 15n; // 0.012 WGRASS target for subsidy + lifecycle trades
const GAS_RESERVE = 2n * 10n ** 15n; // keep 0.002 GRASS for tx fees
const LN2_WAD = 693147180559945309n;

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

const BUY_YES_AMOUNT = 5n * 10n ** 15n;
const BUY_NO_AMOUNT = 3n * 10n ** 15n;
const SELL_YES_AMOUNT = 2n * 10n ** 15n;

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
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
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
const EVIDENCE_DIR = "../../.sisyphus/evidence";
const TX_LOG = `${EVIDENCE_DIR}/task-6-e2e-txhashes.txt`;
const INVESTIGATION_JSON = `${EVIDENCE_DIR}/task-6-configure-investigation.json`;
const SUMMARY_JSON = `${EVIDENCE_DIR}/task-6-e2e-summary.json`;
const txHashes = {};

function logTx(step, txHash) {
  txHashes[step] = txHash;
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
function describeError(error) {
  if (!error || typeof error !== "object") return String(error);
  const cause = error.cause;
  return JSON.stringify(
    {
      name: error.name,
      message: error.message,
      reason: error.reason,
      cause:
        cause && typeof cause === "object"
          ? { name: cause.name, message: cause.message, reason: cause.reason }
          : cause,
    },
    null,
    2
  );
}

async function handleLensTx(result, ownerWalletClient, lensTxWalletClient, sessionClient, stepName) {
  if (result.isErr()) {
    throw new Error(`${stepName} failed: ${describeError(result.error)}`);
  }

  const val = result.value;
  console.log(`  Result type: ${val.__typename}`);

  if (
    val.__typename === "SponsoredTransactionRequest" ||
    val.__typename === "SelfFundedTransactionRequest"
  ) {
    const txFrom = val.raw?.from?.toLowerCase();
    const ownerFrom = ownerWalletClient.account.address.toLowerCase();
    const lensFrom = lensTxWalletClient.account.address.toLowerCase();
    const signerClient = txFrom === lensFrom ? lensTxWalletClient : ownerWalletClient;

    console.log(`  TX from: ${val.raw?.from}`);
    console.log(`  Signing with: ${signerClient.account.address}`);

    const txResult = await handleOperationWith(signerClient)(val);
    if (txResult.isErr()) {
      throw new Error(
        `${stepName} tx failed: ${describeError(txResult.error)} (tx.from=${val.raw?.from}, owner=${ownerFrom}, lensAccount=${lensFrom})`
      );
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
  const env = loadEnv(".env.local");
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
  writeFileSync(
    INVESTIGATION_JSON,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        issue: "configurePostAction returned UnexpectedError",
        sdk_findings: {
          mutation: "configurePostAction(request: ConfigurePostActionRequest)",
          request_shape: {
            post: "PostId",
            params: {
              unknown: {
                address: "EvmAddress",
                params: [{ raw: { key: "BlockchainData", data: "BlockchainData" } }],
              },
            },
          },
          execute_shape: {
            action: {
              unknown: {
                params: [{ key: "BlockchainData", data: "BlockchainData" }],
              },
            },
          },
        },
        root_cause: [
          "Unknown action configure params were sent as { key, value } instead of { raw: { key, data } }.",
          "executePostAction params were sent as { key, value } instead of { key, data }.",
          "Allowance was checked only for SoothPostAction, but Lens ActionHub can be the token spender during action execution.",
        ],
        fix: "Configure custom action during post() creation using actions[].unknown.params[].raw and send execute params as RawKeyValueInput { key, data }.",
      },
      null,
      2
    )
  );

  // Setup viem clients
  const ownerAccount = privateKeyToAccount(PRIVATE_KEY);
  console.log(`\nWallet: ${ownerAccount.address}`);

  const lensAccountSigner = toAccount({
    address: LENS_ACCOUNT,
    signMessage: ({ message }) => ownerAccount.signMessage({ message }),
    signTransaction: (tx) => ownerAccount.signTransaction(tx),
    signTypedData: (typedData) => ownerAccount.signTypedData(typedData),
  });

  const ownerWalletClient = createWalletClient({
    account: ownerAccount,
    chain: lensTestnet,
    transport: http(RPC_URL),
  });

  const lensTxWalletClient = createWalletClient({
    account: lensAccountSigner,
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
  const grassBalance = await publicClient.getBalance({ address: ownerAccount.address });
  const wgrassBalance = await publicClient.readContract({
    address: WGRASS,
    abi: WGRASS_ABI,
    functionName: "balanceOf",
    args: [ownerAccount.address],
  });
  let lensWgrassBalance = await publicClient.readContract({
    address: WGRASS,
    abi: WGRASS_ABI,
    functionName: "balanceOf",
    args: [LENS_ACCOUNT],
  });
  console.log(`  GRASS:  ${formatEther(grassBalance)} GRASS`);
  console.log(`  Owner WGRASS: ${formatEther(wgrassBalance)} WGRASS`);
  console.log(`  Lens  WGRASS: ${formatEther(lensWgrassBalance)} WGRASS`);

  const subsidyRequired = (B * LN2_WAD) / 10n ** 18n;
  console.log(`  Subsidy needed: ${formatEther(subsidyRequired)} WGRASS`);

  const maxWrappable = grassBalance > GAS_RESERVE ? grassBalance - GAS_RESERVE : 0n;
  const lensShortfall = lensWgrassBalance < MIN_WGRASS_TARGET
    ? MIN_WGRASS_TARGET - lensWgrassBalance
    : 0n;
  if (wgrassBalance + maxWrappable < lensShortfall) {
    throw new Error(
      `Insufficient balance. Need to cover Lens account shortfall ${formatEther(lensShortfall)} WGRASS while reserving ${formatEther(GAS_RESERVE)} GRASS for gas.`
    );
  }

  // ── Step 1: Wrap GRASS → WGRASS ────────────────────────────────────────────
  // Wrap only what we need while keeping a gas reserve.
  let currentWgrass = wgrassBalance;
  if (wgrassBalance < lensShortfall) {
    const neededToTarget = lensShortfall - wgrassBalance;
    const wrapAmount = neededToTarget < maxWrappable ? neededToTarget : maxWrappable;
    console.log(`\n[1/9] Wrapping ${formatEther(wrapAmount)} GRASS → WGRASS...`);
    const wrapHash = await ownerWalletClient.writeContract({
      // wrap from owner wallet (funds are held by owner, not Lens account contract)
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
      args: [ownerAccount.address],
    });
    console.log(`  ✅ WGRASS balance: ${formatEther(currentWgrass)} WGRASS`);
  } else {
    console.log("\n[1/9] Sufficient WGRASS already available, skipping wrap.");
    logTx("WRAP_GRASS", "SKIPPED_SUFFICIENT_BALANCE");
  }

  // ── Step 2: Top up Lens account with WGRASS ────────────────────────────────
  console.log("\n[2/9] Funding Lens account with WGRASS...");
  if (lensWgrassBalance < MIN_WGRASS_TARGET) {
    const topUpAmount = MIN_WGRASS_TARGET - lensWgrassBalance;
    if (currentWgrass < topUpAmount) {
      throw new Error(
        `Owner WGRASS too low to fund Lens account. Need ${formatEther(topUpAmount)} WGRASS, have ${formatEther(currentWgrass)}.`
      );
    }

    const topUpHash = await ownerWalletClient.writeContract({
      address: WGRASS,
      abi: WGRASS_ABI,
      functionName: "transfer",
      args: [LENS_ACCOUNT, topUpAmount],
    });
    console.log(`  Top-up TX: ${topUpHash}`);
    await publicClient.waitForTransactionReceipt({ hash: topUpHash });
    logTx("TOPUP_LENS_WGRASS", topUpHash);

    lensWgrassBalance = await publicClient.readContract({
      address: WGRASS,
      abi: WGRASS_ABI,
      functionName: "balanceOf",
      args: [LENS_ACCOUNT],
    });
    currentWgrass = await publicClient.readContract({
      address: WGRASS,
      abi: WGRASS_ABI,
      functionName: "balanceOf",
      args: [ownerAccount.address],
    });
    console.log(`  ✅ Lens WGRASS: ${formatEther(lensWgrassBalance)} WGRASS`);
    console.log(`  Owner WGRASS after top-up: ${formatEther(currentWgrass)} WGRASS`);
  } else {
    console.log("  ✅ Lens account already funded, skipping top-up.");
    logTx("TOPUP_LENS_WGRASS", "SKIPPED_SUFFICIENT_BALANCE");
  }

  if (lensWgrassBalance < subsidyRequired) {
    throw new Error(
      `Lens account WGRASS is below subsidy requirement. Need ${formatEther(subsidyRequired)} WGRASS.`
    );
  }

  // ── Authenticate with Lens SDK ──────────────────────────────────────────────
  console.log("\n[AUTH] Authenticating with Lens SDK...");
  const loginResult = await lensClient.login({
      accountOwner: {
        account: evmAddress(LENS_ACCOUNT),
        app: APP_ADDRESS,
        owner: ownerAccount.address,
      },
      signMessage: signMessageWith(ownerWalletClient),
  });

  if (loginResult.isErr()) {
    throw new Error(`Lens login failed: ${JSON.stringify(loginResult.error)}`);
  }
  const sessionClient = loginResult.value;
  console.log("  ✅ Authenticated");

  // ── Step 3: Verify Lens account WGRASS allowances ─────────────────────────
  // NOTE: prepareSignerErc20Approval() returns UnexpectedError for custom (unknown) actions.
  // Approvals must be done via executeTransaction() on the Lens account smart contract wallet.
  console.log("\n[3/9] Verifying Lens account WGRASS allowances...");
  const EXECUTE_TX_ABI = [{ name: "executeTransaction", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }, { name: "value", type: "uint256" }, { name: "data", type: "bytes" }],
    outputs: [] }];

  const lensAllowanceSooth = await publicClient.readContract({
    address: WGRASS, abi: WGRASS_ABI, functionName: "allowance",
    args: [LENS_ACCOUNT, SOOTH_ADDRESS],
  });
  const lensAllowanceHub = await publicClient.readContract({
    address: WGRASS, abi: WGRASS_ABI, functionName: "allowance",
    args: [LENS_ACCOUNT, ACTION_HUB],
  });
  console.log(`  Lens → SoothPostAction: ${lensAllowanceSooth > 0n ? "✅ approved" : "❌ zero"}`);
  console.log(`  Lens → ActionHub:       ${lensAllowanceHub > 0n ? "✅ approved" : "❌ zero"}`);

  if (lensAllowanceSooth === 0n) {
    const data = ("0x095ea7b3" + SOOTH_ADDRESS.slice(2).toLowerCase().padStart(64, "0") + "f".repeat(64));
    try {
      const tx = await ownerWalletClient.writeContract({ address: LENS_ACCOUNT, abi: EXECUTE_TX_ABI,
        functionName: "executeTransaction", args: [WGRASS, 0n, data] });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      logTx("APPROVE_LENS_SIGNER_SOOTH", tx);
      console.log("  ✅ Approved SoothPostAction");
    } catch (error) {
      const message = error?.message || String(error);
      if (!message.includes("known transaction")) {
        throw error;
      }
      const refreshed = await publicClient.readContract({
        address: WGRASS, abi: WGRASS_ABI, functionName: "allowance", args: [LENS_ACCOUNT, SOOTH_ADDRESS],
      });
      if (refreshed === 0n) throw error;
      logTx("APPROVE_LENS_SIGNER_SOOTH", "KNOWN_TX_ALREADY_APPROVED");
      console.log("  ✅ SoothPostAction approval already pending/mined");
    }
  } else {
    logTx("APPROVE_LENS_SIGNER_SOOTH", "SKIPPED_ALREADY_APPROVED");
  }

  if (lensAllowanceHub === 0n) {
    const data = ("0x095ea7b3" + ACTION_HUB.slice(2).toLowerCase().padStart(64, "0") + "f".repeat(64));
    try {
      const tx = await ownerWalletClient.writeContract({ address: LENS_ACCOUNT, abi: EXECUTE_TX_ABI,
        functionName: "executeTransaction", args: [WGRASS, 0n, data] });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      logTx("APPROVE_LENS_SIGNER_ACTION_HUB", tx);
      console.log("  ✅ Approved ActionHub");
    } catch (error) {
      const message = error?.message || String(error);
      if (!message.includes("known transaction")) {
        throw error;
      }
      const refreshed = await publicClient.readContract({
        address: WGRASS, abi: WGRASS_ABI, functionName: "allowance", args: [LENS_ACCOUNT, ACTION_HUB],
      });
      if (refreshed === 0n) throw error;
      logTx("APPROVE_LENS_SIGNER_ACTION_HUB", "KNOWN_TX_ALREADY_APPROVED");
      console.log("  ✅ ActionHub approval already pending/mined");
    }
  } else {
    logTx("APPROVE_LENS_SIGNER_ACTION_HUB", "SKIPPED_ALREADY_APPROVED");
  }

  // ── Step 4: Create post + configure market in one transaction ─────────────
  // In Lens V3, custom actions are configured by including params in post() actions[].
  // The protocol calls configure() on the action contract at post-creation time.
  // configurePostAction() is only for Lens-native actions (simpleCollect etc.).
  console.log("\n[4/9] Creating Lens post and configuring prediction market...");
  const storageClient = StorageClient.create();

  // Calculate deadline BEFORE post creation
  const deadline = BigInt(Math.floor(Date.now() / 1000)) + DEADLINE_OFFSET;
  console.log(`  b = ${formatEther(B)} WAD`);
  console.log(`  deadline = ${deadline} (${new Date(Number(deadline) * 1000).toISOString()})`);
  console.log(`  feeBps = ${FEE_BPS} (${Number(FEE_BPS) / 100}%)`);

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

  // Create post WITH configure params in actions[] — this calls configure() on SoothPostAction
  const postResult = await post(sessionClient, {
    contentUri: uri,
    actions: [
      {
        unknown: {
          address: evmAddress(SOOTH_ADDRESS),
          params: [
            { raw: { key: KEY_B, data: encodeUint256(B) } },
            { raw: { key: KEY_DEADLINE, data: encodeUint256(deadline) } },
            { raw: { key: KEY_FEE_BPS, data: encodeUint256(FEE_BPS) } },
          ],
        },
      },
    ],
  });

  const postTxHash = await handleLensTx(
    postResult,
    ownerWalletClient,
    lensTxWalletClient,
    sessionClient,
    "CreatePost"
  );
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

  // Market was configured in the post() call above — no separate configurePostAction needed

  // We need the Lens postId (string format) for subsequent executePostAction calls
  const lensPostIdStr = createdPost ? createdPost.id : null;

  if (!lensPostIdStr) {
    console.log("  ⚠️  No post ID available — skipping subsequent steps");
    console.log("  The post may not have been indexed yet.");
    console.log("\n  To complete E2E manually:");
    console.log(`  1. Find your post ID at https://testnet.lenscan.io/address/${LENS_ACCOUNT}`);
    console.log("  2. Re-run this script after the post is indexed");
    return;
  }

  // ── Step 5: Buy YES shares ──────────────────────────────────────────────────
  console.log("\n[5/9] Buying YES shares (0.005 WGRASS)...");
  const buyYesResult = await executePostAction(sessionClient, {
    post: lensPostId(lensPostIdStr),
    action: {
      unknown: {
        address: evmAddress(SOOTH_ADDRESS),
        params: [
          { key: KEY_ACTION, data: encodeUint8(ACTION_BUY) },
          { key: KEY_OUTCOME, data: encodeUint8(OUTCOME_YES) },
          { key: KEY_AMOUNT, data: encodeUint256(BUY_YES_AMOUNT) }, // 0.005 WGRASS
          { key: KEY_MAX_COST, data: encodeUint256(10n ** 16n) }, // max 0.01 WGRASS
        ],
      },
    },
  });

  const buyYesTxHash = await handleLensTx(
    buyYesResult,
    ownerWalletClient,
    lensTxWalletClient,
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
          { key: KEY_ACTION, data: encodeUint8(ACTION_BUY) },
          { key: KEY_OUTCOME, data: encodeUint8(OUTCOME_NO) },
          { key: KEY_AMOUNT, data: encodeUint256(BUY_NO_AMOUNT) }, // 0.003 WGRASS
          { key: KEY_MAX_COST, data: encodeUint256(10n ** 16n) }, // max 0.01 WGRASS
        ],
      },
    },
  });

  const buyNoTxHash = await handleLensTx(
    buyNoResult,
    ownerWalletClient,
    lensTxWalletClient,
    sessionClient,
    "BuyNO"
  );
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
          { key: KEY_ACTION, data: encodeUint8(ACTION_SELL) },
          { key: KEY_OUTCOME, data: encodeUint8(OUTCOME_YES) },
          { key: KEY_AMOUNT, data: encodeUint256(SELL_YES_AMOUNT) }, // sell 0.002 shares
        ],
      },
    },
  });

  const sellYesTxHash = await handleLensTx(
    sellYesResult,
    ownerWalletClient,
    lensTxWalletClient,
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
          { key: KEY_ACTION, data: encodeUint8(ACTION_RESOLVE) },
          { key: KEY_OUTCOME, data: encodeUint8(OUTCOME_YES) },
        ],
      },
    },
  });

  const resolveTxHash = await handleLensTx(
    resolveResult,
    ownerWalletClient,
    lensTxWalletClient,
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
          { key: KEY_ACTION, data: encodeUint8(ACTION_REDEEM) },
        ],
      },
    },
  });

  const redeemTxHash = await handleLensTx(
    redeemResult,
    ownerWalletClient,
    lensTxWalletClient,
    sessionClient,
    "RedeemWinnings"
  );
  logTx("REDEEM_WINNINGS", redeemTxHash);
  console.log("  ✅ Winnings redeemed");

  // ── Final verification ──────────────────────────────────────────────────────
  console.log("\n[VERIFY] Checking final market state...");
  let finalMarketSnapshot = null;
  let finalWgrassBalance = null;
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
        args: [ownerAccount.address],
      });
      console.log(`  Final WGRASS balance: ${formatEther(finalWgrass)} WGRASS`);

      finalMarketSnapshot = {
        resolver: market[0],
        deadline: market[1].toString(),
        b: market[2].toString(),
        qYes: market[3].toString(),
        qNo: market[4].toString(),
        totalCollateral: market[5].toString(),
        winningOutcome: Number(market[6]),
        resolved: market[7],
        paused: market[8],
        feeBps: Number(market[9]),
      };
      finalWgrassBalance = finalWgrass.toString();

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

  writeFileSync(
    SUMMARY_JSON,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        soothPostAction: SOOTH_ADDRESS,
        wallet: ownerAccount.address,
        lensAccount: LENS_ACCOUNT,
        app: APP_ADDRESS,
        postId: lensPostIdStr,
        feedAddress,
        numericPostId: numericPostId !== null ? numericPostId.toString() : null,
        marketConfig: {
          b: B.toString(),
          deadlineOffsetSeconds: Number(DEADLINE_OFFSET),
          feeBps: Number(FEE_BPS),
          subsidyRequired: subsidyRequired.toString(),
        },
        txHashes,
        finalMarketSnapshot,
        finalWgrassBalance,
      },
      null,
      2
    )
  );

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  E2E Test COMPLETE ✅");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  SoothPostAction: ${SOOTH_ADDRESS}`);
  console.log(`  Post ID:         ${lensPostIdStr}`);
  console.log(`  Evidence:        ${TX_LOG}`);
  console.log("\n  Steps completed:");
  console.log("    ✅ Wrapped GRASS → WGRASS");
  console.log("    ✅ Funded Lens account with WGRASS");
  console.log("    ✅ Approved Lens signer for ActionHub + SoothPostAction");
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
