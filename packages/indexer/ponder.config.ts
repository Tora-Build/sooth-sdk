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
  // V10.10 deployment - 2026-01-20
  // Note: Use DATABASE_SCHEMA env var on Render to set schema (e.g., sooth_v10_10)
  // to avoid migration conflicts when contract addresses change
  chains: {
    baseSepolia: {
      id: 84532,
      rpc: baseRpcUrls,
    },
    monadTestnet: {
      id: 10143,
      rpc: process.env.MONAD_TESTNET_RPC_URL
        ?? "https://blue-stylish-friday.monad-testnet.quiknode.pro/REDACTED_QUICKNODE_TOKEN/",
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
          address: "0x6f81dc9b9a7f922f0dc89a9649eb8f22442ef547",
          startBlock: 36_532_214,
        },
        monadTestnet: {
          address: "0xe5aa0a546e890cc79002f607c353e88104ba5835",
          startBlock: 7_215_642,
        },
        arcTestnet: {
          address: "0xd699b06f61ef72698b28e133e8061496ed880a55",
          startBlock: 22_515_872,
        },
        megaethTestnet: {
          address: "0x3dc3281d5f526f5ddd3abeaf20d5e542ad4982e8",
          startBlock: 9_122_253,
        },
      },
    },
    LaunchpadEngine: {
      abi: LaunchpadEngineAbi,
      chain: {
        baseSepolia: {
          address: "0xf8712a447f987bf796c26cc5bbd693a6a5a09282",
          startBlock: 36_532_218,
        },
        monadTestnet: {
          address: "0x58f0fb2539f6f8b75e2b7711bb633b4b94b44a72",
          startBlock: 7_215_650,
        },
        arcTestnet: {
          address: "0xa34af1f9606edd45209f7617b670b93e61eb3d40",
          startBlock: 22_515_878,
        },
        megaethTestnet: {
          address: "0xf7989d2a1e013b149ec7b1bc67edf59ced9efcef",
          startBlock: 9_122_259,
        },
      },
    },
    TickBookVault: {
      abi: TickBookVaultAbi,
      chain: {
        baseSepolia: {
          address: "0xb6de2a206eb5933db5949ba3fb91c82011c1dedf",
          startBlock: 36_532_211,
        },
        monadTestnet: {
          address: "0x3ebca73ca7de9a4a93c211df8236e93b8322c1b8",
          startBlock: 7_215_637,
        },
        arcTestnet: {
          address: "0xb2b6349303ba0e85748d72abb62c2225133b2f73",
          startBlock: 22_515_869,
        },
        megaethTestnet: {
          address: "0x0f2f8db22953f0db4edfc3460e68f90c53c559cc",
          startBlock: 9_122_250,
        },
      },
    },
    AMMEngine: {
      abi: AMMEngineAbi,
      chain: {
        baseSepolia: {
          address: "0xe86cb3de0a628b9bda5123454960dc3d12057759",
          startBlock: 36_532_209,
        },
        monadTestnet: {
          address: "0xb48b11382b272f687821aeae964fd51157f427be",
          startBlock: 7_215_633,
        },
        arcTestnet: {
          address: "0xf07d397ab5fd9bd82e1f9e0e0b0471b0650871bf",
          startBlock: 22_515_867,
        },
        megaethTestnet: {
          address: "0x45ff3463c8b6185e64c91d3526f8f3768822cb08",
          startBlock: 9_122_247,
        },
      },
    },
  },
});
