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
// Use stable rpc.testnet.arc.network (drpc has 404 issues)
const arcRpc =
  arcRpcCandidates.find((url) => url.includes("rpc.testnet.arc.network")) ??
  arcRpcCandidates[0] ??
  "https://rpc.testnet.arc.network";

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
          address: "0x9d17f81207fc377bbd8a73b27ad38eeb23be4388",
          startBlock: 36_214_050,
        },
        monadTestnet: {
          address: "0xd4090b703e171bca15dce1cce2da4c8e14ff44c1",
          startBlock: 5_639_248,
        },
        arcTestnet: {
          address: "0x3520983370eef2d1e417154bbeddf57f0dd5823f",
          startBlock: 21_290_000,
        },
      },
    },
    LaunchpadEngine: {
      abi: LaunchpadEngineAbi,
      chain: {
        baseSepolia: {
          address: "0x06b0316239559ec7dd8d5299726d7ec6bb3b3d2d",
          startBlock: 36_214_054,
        },
        monadTestnet: {
          address: "0xa93305a91705b095ddeb3c82f7988b1acdf1f012",
          startBlock: 5_639_255,
        },
        arcTestnet: {
          address: "0x137ad07970322fb72c1e4d7758976b2237e3fe36",
          startBlock: 21_290_000,
        },
      },
    },
    TickBookVault: {
      abi: TickBookVaultAbi,
      chain: {
        baseSepolia: {
          address: "0xad72ba21563237ebdfbe310c052f87acb7cab0f2",
          startBlock: 36_214_047,
        },
        monadTestnet: {
          address: "0x656c7092038334a66928644df2bec755f85c32c8",
          startBlock: 5_639_244,
        },
        arcTestnet: {
          address: "0x751f57c504cb7311f52ccc4953e3658d2322c274",
          startBlock: 21_290_000,
        },
      },
    },
    AMMEngine: {
      abi: AMMEngineAbi,
      chain: {
        baseSepolia: {
          address: "0x67118b2ff01bbadce643c87d86f7228bb2f846b8",
          startBlock: 36_214_045,
        },
        monadTestnet: {
          address: "0xaa314e2370587f80b25b217ae97358e8be46d143",
          startBlock: 5_639_241,
        },
        arcTestnet: {
          address: "0xc3c92b8eb4185657be969848ba14e481752d8d01",
          startBlock: 21_290_000,
        },
      },
    },
  },
});
