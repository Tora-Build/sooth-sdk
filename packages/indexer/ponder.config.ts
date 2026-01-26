import { createConfig } from "ponder";

import { TickBookPoolManagerAbi } from "./src/abis/TickBookPoolManager";
import { LaunchpadEngineAbi } from "./src/abis/LaunchpadEngine";
import { TickBookVaultAbi } from "./src/abis/TickBookVault";
import { AMMEngineAbi } from "./src/abis/AMMEngine";

// Arc RPC: check both env var names, use stable RPC endpoint
const arcRpcEnv = process.env.ARC_TESTNET_RPC_URL
  ?? process.env.PONDER_RPC_URL_ARC_TESTNET
  ?? "";
const arcRpcCandidates = arcRpcEnv
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);
const arcRpcUrls = arcRpcCandidates.length > 0
  ? arcRpcCandidates
  : ["https://rpc.testnet.arc.network"];

const baseRpcEnv = process.env.BASE_SEPOLIA_RPC_URL
  ?? process.env.PONDER_RPC_URL_BASE_SEPOLIA
  ?? "";
const baseRpcCandidates = baseRpcEnv
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);
const baseRpcUrls = Array.from(
  new Set(
    baseRpcCandidates.length > 0
      ? [...baseRpcCandidates, "https://sepolia.base.org"]
      : ["https://sepolia.base.org"],
  ),
);

export default createConfig({
  // V11.0 deployment - 2026-01-22 (Base Sepolia)
  // Other chains remain at V10.x per STATUS.md
  // Note: Use DATABASE_SCHEMA env var on Render to set schema (e.g., sooth_v11)
  // to avoid migration conflicts when contract addresses change
  chains: {
    baseSepolia: {
      id: 84532,
      rpc: baseRpcUrls,
    },
    monadTestnet: {
      id: 10143,
      rpc: process.env.MONAD_TESTNET_RPC_URL
        ?? "https://blue-stylish-friday.monad-testnet.quiknode.pro/e8b690b8d333c538f85bab9c93a2a3b512a4cb9a/",
      pollingInterval: 500,
      ethGetLogsBlockRange: 1_000,
    },
    arcTestnet: {
      id: 5042002,
      rpc: arcRpcUrls,
      pollingInterval: 2_000,
      ethGetLogsBlockRange: 10,
    },
    megaethTestnet: {
      id: 6343,
      rpc: process.env.MEGAETH_TESTNET_RPC_URL ?? "https://carrot.megaeth.com/rpc",
      pollingInterval: 2_000,
      ethGetLogsBlockRange: 500,
    },
  },
  contracts: {
    TickBookPoolManager: {
      abi: TickBookPoolManagerAbi,
      chain: {
        baseSepolia: {
          address: "0xa2261ad47f5f60048384f66f544d7ec48ddb3ed0",
          startBlock: 36_700_000,
        },
        monadTestnet: {
          address: "0xdebbf3b24b3bc6ff44888b6153c64bbd569ec90e",
          startBlock: 7_500_000,
        },
        arcTestnet: {
          address: "0x8ba9751284d77ed59f46ea877577e6430bc30209",
          startBlock: 22_800_000,
        },
        megaethTestnet: {
          address: "0xf52a8e9f5defcc6fe0e66b523d29ad7cfc3af530",
          startBlock: 9_500_000,
        },
      },
    },
    LaunchpadEngine: {
      abi: LaunchpadEngineAbi,
      chain: {
        baseSepolia: {
          address: "0x0ec7c40acbe1b0b1340aa20b9bb141e2d0996826",
          startBlock: 36_700_000,
        },
        monadTestnet: {
          address: "0x3ae688354f831a6b37025e3f19744bd857005cca",
          startBlock: 7_500_000,
        },
        arcTestnet: {
          address: "0x625b4b2997232380126f0aecd84867086f89b27e",
          startBlock: 22_800_000,
        },
        megaethTestnet: {
          address: "0xa2b2653124cb98b4d83a8a314e5e0bef2621832f",
          startBlock: 9_500_000,
        },
      },
    },
    TickBookVault: {
      abi: TickBookVaultAbi,
      chain: {
        baseSepolia: {
          address: "0xa21f54a6964c0213c610ef55dc1abf88ee63982e",
          startBlock: 36_700_000,
        },
        monadTestnet: {
          address: "0x0d9c613ae45820dacfcd5aff85a98f2e650b09a9",
          startBlock: 7_500_000,
        },
        arcTestnet: {
          address: "0x1695ac9983f457e446d8f903d7c4061fbc7907f8",
          startBlock: 22_800_000,
        },
        megaethTestnet: {
          address: "0x5b9a8b49d5616326bd61ac57b429cbf84e8cc756",
          startBlock: 9_500_000,
        },
      },
    },
    AMMEngine: {
      abi: AMMEngineAbi,
      chain: {
        baseSepolia: {
          address: "0x16948479c5d43b59742adae6401645271546366d",
          startBlock: 36_700_000,
        },
        monadTestnet: {
          address: "0x8f3e3e0309f0730c62b3fdc68bff2291308537bd",
          startBlock: 7_500_000,
        },
        arcTestnet: {
          address: "0x0f0dd0be87f6ab153e732039469fe64353b95dbb",
          startBlock: 22_800_000,
        },
        megaethTestnet: {
          address: "0x61470420cc117e9460aae3bdc6cdf77c443ac09c",
          startBlock: 9_500_000,
        },
      },
    },
  },
});
