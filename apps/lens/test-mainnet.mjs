/**
 * Lens MAINNET: check accounts, onboard, and post
 * Run: node apps/lens/test-mainnet.mjs
 */

import { readFileSync } from "fs";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  PublicClient,
  mainnet,
  evmAddress,
} from "@lens-protocol/client";
import {
  fetchAccountsAvailable,
  createAccountWithUsername,
  post,
  fetchPost,
} from "@lens-protocol/client/actions";
import { handleOperationWith, signMessageWith } from "@lens-protocol/client/viem";
import { StorageClient } from "@lens-chain/storage-client";

// Load .env.local
const envFile = readFileSync("apps/lens/.env.local", "utf-8");
const env = Object.fromEntries(
  envFile
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split("=").map((s) => s.trim()))
);

const PRIVATE_KEY = env.LENS_PRIVATE_KEY;
// Mainnet app - we'll try to discover or use a known one
const MAINNET_APP = env.LENS_MAINNET_APP || null;

const lensMainnet = {
  id: 232,
  name: "Lens Network",
  nativeCurrency: { name: "GHO", symbol: "GHO", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.lens.xyz"] } },
};

async function main() {
  const account = privateKeyToAccount(PRIVATE_KEY);
  console.log(`Wallet: ${account.address}`);
  console.log(`Network: Lens Mainnet (chain 232)\n`);

  const walletClient = createWalletClient({
    account,
    chain: lensMainnet,
    transport: http("https://rpc.lens.xyz"),
  });

  const client = PublicClient.create({
    environment: mainnet,
    origin: "https://sooth.market",
  });

  // Step 1: Check existing accounts
  console.log("--- Step 1: Check existing accounts ---");
  const accts = await fetchAccountsAvailable(client, {
    managedBy: evmAddress(account.address),
  });

  if (accts.isErr()) {
    console.log("Error fetching accounts:", accts.error);
    return;
  }

  if (accts.value.items.length > 0) {
    console.log(`Found ${accts.value.items.length} account(s):`);
    for (const a of accts.value.items) {
      console.log(`  ${a.account.username?.value || "(no username)"} → ${a.account.address}`);
    }

    // Use first account
    const lensAccount = accts.value.items[0].account;
    console.log(`\nUsing: ${lensAccount.username?.value} (${lensAccount.address})`);

    // Login and post
    await loginAndPost(client, walletClient, account, lensAccount.address);
    return;
  }

  console.log("No accounts found on mainnet.\n");

  // Step 2: Create account
  if (!MAINNET_APP) {
    console.log("No LENS_MAINNET_APP set in .env.local.");
    console.log("To create a mainnet account, you need a Lens app address.");
    console.log("Options:");
    console.log("  1. Set LENS_MAINNET_APP in .env.local");
    console.log("  2. Use an existing app (e.g., Hey.xyz app address)");
    console.log("\nLet me try to query some known apps...");

    // Try fetching a well-known app to get its address
    const { fetchApp } = await import("@lens-protocol/client/actions");
    // Can't easily discover apps without an address, so let's suggest manual steps
    console.log("\nTo find app addresses, visit: https://explorer.lens.xyz");
    return;
  }

  console.log(`--- Step 2: Create mainnet account ---`);
  console.log(`App: ${MAINNET_APP}`);

  const login = await client.login({
    onboardingUser: {
      app: MAINNET_APP,
      wallet: account.address,
    },
    signMessage: signMessageWith(walletClient),
  });

  if (login.isErr()) {
    console.log("Login failed:", JSON.stringify(login.error, null, 2));
    return;
  }

  const sessionClient = login.value;
  console.log("[OK] Onboarding session active");

  // Upload metadata
  console.log("\nUploading account metadata...");
  const storageClient = StorageClient.create();
  const metadata = {
    $schema: "https://json-schemas.lens.dev/account/1.0.0.json",
    lens: {
      id: crypto.randomUUID(),
      name: "Sooth Alpha",
      bio: "Prediction markets on Lens Chain",
    },
  };
  const { uri } = await storageClient.uploadAsJson(metadata);
  console.log(`[OK] Metadata: ${uri}`);

  // Create account
  const username = "soothalpha";
  console.log(`\nCreating account '${username}'...`);
  const result = await createAccountWithUsername(sessionClient, {
    username: { localName: username },
    metadataUri: uri,
  });

  if (result.isErr()) {
    console.log("Error:", result.error.message || JSON.stringify(result.error));
    return;
  }

  const txResult = await handleOperationWith(walletClient)(result.value);
  if (txResult.isErr()) {
    console.log("Tx error:", JSON.stringify(txResult.error, null, 2));
    return;
  }

  console.log(`[OK] TX: ${txResult.value}`);
  try {
    await sessionClient.waitForTransaction(txResult.value);
    console.log("[OK] Account created and indexed!");
  } catch (e) {
    console.log("Wait warning:", e.message);
  }

  // Recheck
  const recheck = await fetchAccountsAvailable(client, {
    managedBy: evmAddress(account.address),
  });
  if (recheck.isOk() && recheck.value.items.length > 0) {
    const a = recheck.value.items[0].account;
    console.log(`\nAccount: ${a.username?.value} (${a.address})`);
    console.log(`\nAdd to .env.local:\n  LENS_MAINNET_ACCOUNT=${a.address}`);
  }
}

async function loginAndPost(client, walletClient, wallet, lensAccountAddress) {
  const appAddress = MAINNET_APP;
  if (!appAddress) {
    console.log("\nSkipping post — no LENS_MAINNET_APP set.");
    console.log("Set LENS_MAINNET_APP in .env.local to enable posting.");
    return;
  }

  console.log("\n--- Step 3: Login & Post ---");
  const login = await client.login({
    accountOwner: {
      account: evmAddress(lensAccountAddress),
      app: appAddress,
      owner: wallet.address,
    },
    signMessage: signMessageWith(walletClient),
  });

  if (login.isErr()) {
    console.log("Login failed:", JSON.stringify(login.error, null, 2));
    return;
  }

  const sessionClient = login.value;
  console.log("[OK] Authenticated");

  // Upload post metadata
  console.log("\nUploading post metadata...");
  const storageClient = StorageClient.create();
  const metadata = {
    $schema: "https://json-schemas.lens.dev/posts/text-only/3.0.0.json",
    lens: {
      id: crypto.randomUUID(),
      content: "gm from Sooth Protocol 🔮 Prediction markets coming to Lens Chain.",
      locale: "en",
      mainContentFocus: "TEXT_ONLY",
      tags: ["sooth", "prediction-market", "gm"],
    },
  };

  const { uri } = await storageClient.uploadAsJson(metadata);
  console.log(`[OK] Metadata: ${uri}`);

  // Post
  console.log("\nPosting...");
  const result = await post(sessionClient, { contentUri: uri });

  if (result.isErr()) {
    console.log("Post error:", result.error.message || JSON.stringify(result.error));
    return;
  }

  console.log("Result type:", result.value.__typename);

  const txResult = await handleOperationWith(walletClient)(result.value);
  if (txResult.isErr()) {
    console.log("Tx error:", JSON.stringify(txResult.error, null, 2));
    return;
  }

  console.log(`[OK] TX: ${txResult.value}`);
  try {
    await sessionClient.waitForTransaction(txResult.value);
    console.log("[OK] Post indexed on mainnet!");
  } catch (e) {
    console.log("Wait warning:", e.message);
  }

  console.log(`\nExplorer: https://explorer.lens.xyz/tx/${txResult.value}`);
}

main().catch(console.error);
