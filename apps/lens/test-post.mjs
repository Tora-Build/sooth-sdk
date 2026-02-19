/**
 * Post to Lens testnet as lens/soothalpha
 * Run: node apps/lens/test-post.mjs
 */

import { readFileSync } from "fs";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { PublicClient, testnet, evmAddress, postId } from "@lens-protocol/client";
import { post, fetchPost } from "@lens-protocol/client/actions";
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
const LENS_ACCOUNT = env.LENS_ACCOUNT;
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
  console.log(`Lens Account: ${LENS_ACCOUNT}`);

  const walletClient = createWalletClient({
    account,
    chain: lensTestnet,
    transport: http("https://rpc.testnet.lens.xyz"),
  });

  const client = PublicClient.create({
    environment: testnet,
    origin: "https://sooth.market",
  });

  // Login as account owner
  console.log("\nAuthenticating...");
  const login = await client.login({
    accountOwner: {
      account: evmAddress(LENS_ACCOUNT),
      app: APP_ADDRESS,
      owner: account.address,
    },
    signMessage: signMessageWith(walletClient),
  });

  if (login.isErr()) {
    console.log(`Login failed:`, JSON.stringify(login.error, null, 2));
    return;
  }

  const sessionClient = login.value;
  console.log("[OK] Authenticated as lens/soothalpha");

  // Upload post metadata to Grove
  console.log("\nUploading post metadata...");
  const storageClient = StorageClient.create();

  const metadata = {
    $schema: "https://json-schemas.lens.dev/posts/text-only/3.0.0.json",
    lens: {
      id: crypto.randomUUID(),
      content: "gm from Sooth Protocol. Prediction markets coming to Lens Chain.",
      locale: "en",
      mainContentFocus: "TEXT_ONLY",
      tags: ["sooth", "prediction-market", "gm"],
    },
  };

  const { uri } = await storageClient.uploadAsJson(metadata);
  console.log(`[OK] Metadata: ${uri}`);

  // Create post
  console.log("\nPosting...");
  const result = await post(sessionClient, {
    contentUri: uri,
  });

  if (result.isErr()) {
    console.log("Post error:", result.error.message || JSON.stringify(result.error));
    return;
  }

  console.log("Result type:", result.value.__typename);

  // Handle tx
  const txResult = await handleOperationWith(walletClient)(result.value);

  if (txResult.isErr()) {
    console.log("Tx error:", JSON.stringify(txResult.error, null, 2));
    return;
  }

  console.log(`[OK] TX: ${txResult.value}`);
  console.log("Waiting for indexing...");

  try {
    await sessionClient.waitForTransaction(txResult.value);
    console.log("[OK] Post indexed!");
  } catch (e) {
    console.log("Wait warning:", e.message);
  }

  console.log("\nPost published by lens/soothalpha on Lens testnet!");
  console.log(`Explorer: https://explorer.testnet.lens.xyz/tx/${txResult.value}`);
}

main().catch(console.error);
