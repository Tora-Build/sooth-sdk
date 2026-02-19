/**
 * Lens testnet onboarding: create account with metadata
 * Run: node apps/lens/test-onboard.mjs
 */

import { readFileSync } from "fs";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { PublicClient, testnet, evmAddress } from "@lens-protocol/client";
import {
  fetchAccountsAvailable,
  createAccountWithUsername,
} from "@lens-protocol/client/actions";
import { handleOperationWith, signMessageWith } from "@lens-protocol/client/viem";
import { StorageClient } from "@lens-chain/storage-client";
import { chains } from "@lens-chain/sdk/viem";

// Load .env.local
const envFile = readFileSync("apps/lens/.env.local", "utf-8");
const env = Object.fromEntries(
  envFile
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split("=").map((s) => s.trim()))
);

const PRIVATE_KEY = env.LENS_PRIVATE_KEY;
const APP_ADDRESS = env.LENS_APP;

const lensTestnet = {
  id: 37111,
  name: "Lens Testnet",
  nativeCurrency: { name: "GRASS", symbol: "GRASS", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.lens.xyz"] } },
};

async function main() {
  const account = privateKeyToAccount(PRIVATE_KEY);
  console.log(`Wallet: ${account.address}`);

  const walletClient = createWalletClient({
    account,
    chain: lensTestnet,
    transport: http("https://rpc.testnet.lens.xyz"),
  });

  const client = PublicClient.create({
    environment: testnet,
    origin: "https://sooth.market",
  });

  // Check existing accounts
  console.log("\nChecking existing accounts...");
  const accts = await fetchAccountsAvailable(client, {
    managedBy: evmAddress(account.address),
  });

  if (accts.isOk() && accts.value.items.length > 0) {
    for (const a of accts.value.items) {
      console.log(`  Found: ${a.account.username?.value} (${a.account.address})`);
    }
    console.log(`\nLENS_ACCOUNT=${accts.value.items[0].account.address}`);
    return;
  }
  console.log("No accounts found.");

  // Onboarding login
  console.log("\nOnboarding login...");
  const login = await client.login({
    onboardingUser: {
      app: APP_ADDRESS,
      wallet: account.address,
    },
    signMessage: signMessageWith(walletClient),
  });

  if (login.isErr()) {
    console.log(`Login failed:`, JSON.stringify(login.error, null, 2));
    return;
  }

  const sessionClient = login.value;
  console.log("[OK] Session active");

  // Upload account metadata to Grove
  console.log("\nUploading account metadata to Grove...");
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
  console.log(`[OK] Metadata uploaded: ${uri}`);

  // Create account with metadata URI
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

  console.log("Result type:", result.value.__typename || typeof result.value);

  // Handle the tx (sponsor or self-fund)
  const txResult = await handleOperationWith(walletClient)(result.value);

  if (txResult.isErr()) {
    console.log("Tx error:", JSON.stringify(txResult.error, null, 2));
    return;
  }

  console.log(`[OK] TX submitted: ${txResult.value}`);
  console.log("Waiting for indexing...");

  try {
    await sessionClient.waitForTransaction(txResult.value);
    console.log("[OK] Indexed!");
  } catch (e) {
    console.log("Wait error (may still succeed):", e.message);
  }

  // Recheck
  const recheck = await fetchAccountsAvailable(client, {
    managedBy: evmAddress(account.address),
  });
  if (recheck.isOk() && recheck.value.items.length > 0) {
    const a = recheck.value.items[0].account;
    console.log(`\nAccount: ${a.username?.value} (${a.address})`);
    console.log(`\nUpdate .env.local:\n  LENS_ACCOUNT=${a.address}`);
  }
}

main().catch(console.error);
