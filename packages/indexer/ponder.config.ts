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
          address: "0x463759fa866e6045c97cb37c25bcd74d23aa9b34",
          startBlock: 36_399_054,
        },
        monadTestnet: {
          address: "0xaa3daf93c823258fe025b26be90e8a08d2abf84f",
          startBlock: 6_558_945,
        },
        arcTestnet: {
          address: "0xb4240ac6cc3a082d5819e9410f0eb90209a4a3f3",
          startBlock: 21_983_353,
        },
        megaethTestnet: {
          address: "0x7f7a84196dc38b054a6f31b2efcd7142860b37c6",
          startBlock: 8_855_931,
        },
      },
    },
    LaunchpadEngine: {
      abi: LaunchpadEngineAbi,
      chain: {
        baseSepolia: {
          address: "0xdc51a2beb6ed2e65f1ee4cfa87a228b77e697a21",
          startBlock: 36_399_058,
        },
        monadTestnet: {
          address: "0x9ca66ac4a00e7c380db41a714be470493bc2eee1",
          startBlock: 6_558_952,
        },
        arcTestnet: {
          address: "0x7015ea4bdada102969f5d9eb9457e087a559cedc",
          startBlock: 21_983_359,
        },
        megaethTestnet: {
          address: "0x2de2f2e6aad4f310dc72acc6f896412ceb4706f3",
          startBlock: 8_855_935,
        },
      },
    },
    TickBookVault: {
      abi: TickBookVaultAbi,
      chain: {
        baseSepolia: {
          address: "0x3727d8d586bd37cd716c1bdbc05c6c2c6b8adc5d",
          startBlock: 36_399_052,
        },
        monadTestnet: {
          address: "0xb3ea593be1a834650e2955cc8f038921f4571ffa",
          startBlock: 6_558_941,
        },
        arcTestnet: {
          address: "0xadd058a6bd2bce6f1fe1cbd3c9e21250c055e242",
          startBlock: 21_983_350,
        },
        megaethTestnet: {
          address: "0xb80a06cc6813c03f1b04bc969942740b7483b447",
          startBlock: 8_855_928,
        },
      },
    },
    AMMEngine: {
      abi: AMMEngineAbi,
      chain: {
        baseSepolia: {
          address: "0x95c0a48c38a19dcdd9b8d21b0c304154230b56b9",
          startBlock: 36_399_050,
        },
        monadTestnet: {
          address: "0xd18e6e7489d07e38f903e301c19f6a43650a0178",
          startBlock: 6_558_938,
        },
        arcTestnet: {
          address: "0x3c01829ddac95f1f143c04afdcf0c2689aa979f0",
          startBlock: 21_983_348,
        },
        megaethTestnet: {
          address: "0xed1ffac79bfe9a13715774d2694a0f55ed392656",
          startBlock: 8_855_926,
        },
      },
    },
  },
});
