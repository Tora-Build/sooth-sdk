import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { PublicClient, testnet, evmAddress } from "@lens-protocol/client";
import { prepareSignerErc20Approval } from "@lens-protocol/client/actions";
import { handleOperationWith, signMessageWith } from "@lens-protocol/client/viem";
import { readFileSync } from "fs";

const lensTestnet = {
  id: 37111,
  name: "Lens Testnet",
  nativeCurrency: { name: "GRASS", symbol: "GRASS", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.lens.xyz"] } },
};

function loadEnv(filePath) {
  const content = readFileSync(filePath, "utf-8");
  const env = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return env;
}

const env = loadEnv(".env.local");
const account = privateKeyToAccount(env.LENS_PRIVATE_KEY);
const walletClient = createWalletClient({ account, chain: lensTestnet, transport: http("https://rpc.testnet.lens.xyz") });

const lensClient = PublicClient.create({ environment: testnet, origin: "https://sooth.market" });
const loginResult = await lensClient.login({
  accountOwner: {
    account: evmAddress(env.LENS_ACCOUNT),
    app: env.LENS_APP,
    owner: account.address,
  },
  signMessage: signMessageWith(walletClient),
});
if (loginResult.isErr()) throw new Error("Login failed: " + JSON.stringify(loginResult.error));
const sessionClient = loginResult.value;
console.log("Authenticated");

// Test prepareSignerErc20Approval
const SOOTH = "0x7ADCc784b192Ea376820aAa28E358f156E458f84";
const WGRASS = "0xeee5a340Cdc9c179Db25dea45AcfD5FE8d4d3eB8";

console.log("Calling prepareSignerErc20Approval...");
const result = await prepareSignerErc20Approval(sessionClient, {
  approval: {
    infinite: evmAddress(SOOTH),
  },
});

if (result.isErr()) {
  console.error("Error:", JSON.stringify(result.error));
} else {
  console.log("Result type:", result.value.__typename);
  console.log("Result:", JSON.stringify(result.value, null, 2).slice(0, 500));
}
