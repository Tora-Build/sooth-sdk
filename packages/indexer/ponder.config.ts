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
      rpc: process.env.MEGAETH_TESTNET_RPC_URL ?? "https://timothy.megaeth.com/rpc",
    },
  },
  contracts: {
    TickBookPoolManager: {
      abi: TickBookPoolManagerAbi,
      chain: {
        baseSepolia: {
          address: "0x096105c2052d10d8d637b7f2f8af88b10396fe5e",
          startBlock: 36_389_936,
        },
        monadTestnet: {
          address: "0x767e0260fce8cdb6fd06aa4d997c0b86c780a73d",
          startBlock: 6_513_951,
        },
        arcTestnet: {
          address: "0x4af0dc87a6b2a1764ecd8ea6f705e7ab3515ec9c",
          startBlock: 21_946_905,
        },
        megaethTestnet: {
          address: "0xb243697c5f642cd7e75e14f0f3cf224583641120",
          startBlock: 8_684_000,
        },
      },
    },
    LaunchpadEngine: {
      abi: LaunchpadEngineAbi,
      chain: {
        baseSepolia: {
          address: "0x29225a42fbd93726424112f8f3eb043698c535c7",
          startBlock: 36_389_940,
        },
        monadTestnet: {
          address: "0xbd280f20ca24d9daecc8fc8756e7408ff095880d",
          startBlock: 6_513_958,
        },
        arcTestnet: {
          address: "0xebac310b73a4d9198cd7c688174a03370000f660",
          startBlock: 21_946_913,
        },
        megaethTestnet: {
          address: "0xc29ed9513c421bcc208388b7cc098fad0f338ba7",
          startBlock: 8_684_000,
        },
      },
    },
    TickBookVault: {
      abi: TickBookVaultAbi,
      chain: {
        baseSepolia: {
          address: "0xa2df334de3feb81a32bed868687ffbf9a0b218ab",
          startBlock: 36_389_933,
        },
        monadTestnet: {
          address: "0x6bcff6cd4edca4d4b0cd6bcbf47de5ad134328ba",
          startBlock: 6_513_948,
        },
        arcTestnet: {
          address: "0x9afc2ab14b9e1e1c01f05b5dcc9c583039fe7cb4",
          startBlock: 21_946_901,
        },
        megaethTestnet: {
          address: "0x125d547d5916b9e7d9c0bb312fbdaf127865fe1b",
          startBlock: 8_684_000,
        },
      },
    },
    AMMEngine: {
      abi: AMMEngineAbi,
      chain: {
        baseSepolia: {
          address: "0x37718d2eaccfbabd0b07929a900d8cf60db57680",
          startBlock: 36_389_931,
        },
        monadTestnet: {
          address: "0x85e29adb6591857aab50e6f20276981f31917b9c",
          startBlock: 6_513_945,
        },
        arcTestnet: {
          address: "0x9b8280640361171c94e2f7d221a245df3030f5d3",
          startBlock: 21_946_898,
        },
        megaethTestnet: {
          address: "0x2a1e74f74221b544d20d903fbf042e265e065703",
          startBlock: 8_684_000,
        },
      },
    },
  },
});
