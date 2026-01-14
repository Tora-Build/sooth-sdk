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
  // Note: Use DATABASE_SCHEMA env var on Render to set schema (e.g., sooth_v10_8)
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
      rpc: process.env.MEGAETH_TESTNET_RPC_URL ?? "https://timothy.megaeth.com/rpc",
    },
  },
  contracts: {
    TickBookPoolManager: {
      abi: TickBookPoolManagerAbi,
      chain: {
        baseSepolia: {
          address: "0xabfac62af3e6fb92765bea241653c3f454169dd8",
          startBlock: 36_260_304,
        },
        monadTestnet: {
          address: "0xe837986c70a38de67835059e5adb8b33ba145053",
          startBlock: 5_932_484,
        },
        arcTestnet: {
          address: "0x12a7537f1ccf4fc650402cc573da14d184965566",
          startBlock: 21_482_193,
        },
        megaethTestnet: {
          address: "0x8352aa95a7670057ac2ee73b7c8c39c5ae0901f5",
          startBlock: 8_684_178,
        },
      },
    },
    LaunchpadEngine: {
      abi: LaunchpadEngineAbi,
      chain: {
        baseSepolia: {
          address: "0xa3c20cda4877a1c76728f9cea2224189af2507c4",
          startBlock: 36_260_309,
        },
        monadTestnet: {
          address: "0xa948000dfc95f4055c60bc235bf8d87b34e4bc8e",
          startBlock: 5_932_492,
        },
        arcTestnet: {
          address: "0x3c2f09ba129d9ac0ea7234aa1e796a0376177d8d",
          startBlock: 21_482_202,
        },
        megaethTestnet: {
          address: "0x5ab590b3526bfd4ba3c51858be917271e0361311",
          startBlock: 8_684_179,
        },
      },
    },
    TickBookVault: {
      abi: TickBookVaultAbi,
      chain: {
        baseSepolia: {
          address: "0x4bf295e9d022986f02501a421bda3d7d3f73cc3f",
          startBlock: 36_260_302,
        },
        monadTestnet: {
          address: "0xbb5e3d1eb8c7b9930dc265adbbc21d8e927e3c79",
          startBlock: 5_932_480,
        },
        arcTestnet: {
          address: "0x766347b587bb3c03d2d88d72e9a81c228006a548",
          startBlock: 21_482_187,
        },
        megaethTestnet: {
          address: "0x0f450a5589f0cea761c914e8d75e097d3fb1c27f",
          startBlock: 8_684_177,
        },
      },
    },
    AMMEngine: {
      abi: AMMEngineAbi,
      chain: {
        baseSepolia: {
          address: "0x28b866bc672c7bd79067e5d826f2956c2cb3afb9",
          startBlock: 36_260_300,
        },
        monadTestnet: {
          address: "0x9bfaf374d560dafca5ebb522de58ca97491a3035",
          startBlock: 5_932_477,
        },
        arcTestnet: {
          address: "0x2d94583e48576cd031164c28b9705791aff97034",
          startBlock: 21_482_180,
        },
        megaethTestnet: {
          address: "0x45419a4f8fc485ac548f289d1a6279b9010c11ca",
          startBlock: 8_684_176,
        },
      },
    },
  },
});
