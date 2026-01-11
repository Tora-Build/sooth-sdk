import { createConfig } from "ponder";

import { TickBookPoolManagerAbi } from "./src/abis/TickBookPoolManager";

// Arc RPC: check both env var names, prefer non-rate-limited endpoints
const arcRpcEnv = process.env.ARC_TESTNET_RPC_URL
  ?? process.env.PONDER_RPC_URL_ARC_TESTNET
  ?? "";
const arcRpcCandidates = arcRpcEnv
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);
// Prefer drpc/blockdaemon over rate-limited rpc.testnet.arc.network
const arcRpc =
  arcRpcCandidates.find((url) => url.includes("drpc") || url.includes("blockdaemon")) ??
  arcRpcCandidates.find((url) => !url.includes("quicknode")) ??
  "https://rpc.drpc.testnet.arc.network";

export default createConfig({
  // Note: Use DATABASE_SCHEMA env var on Render to set schema (e.g., sooth_v10_8)
  // to avoid migration conflicts when contract addresses change
  chains: {
    baseSepolia: {
      id: 84532,
      rpc: process.env.BASE_SEPOLIA_RPC_URL
        ?? process.env.PONDER_RPC_URL_BASE_SEPOLIA
        ?? "https://sepolia.base.org",
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
      rpc: arcRpc,
      pollingInterval: 2_000,
      ethGetLogsBlockRange: 100,
    },
  },
  contracts: {
    TickBookPoolManager: {
      abi: TickBookPoolManagerAbi,
      chain: {
        baseSepolia: {
          address: "0x9f4c719823935cbbb9db3f8e78556d8684c9b877",
          startBlock: 36_152_520,
        },
        monadTestnet: {
          address: "0x19424e5482ad7b79654706fa60f4e5153d54e3c3",
          startBlock: 5_332_196,
        },
        arcTestnet: {
          address: "0xf17e44c3ebcc7383b3a786a5d48783c2a5220c8e",
          startBlock: 21_044_000,
        },
      },
    },
  },
});
