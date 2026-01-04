import { createConfig } from "ponder";

import { TickBookPoolManagerAbi } from "./src/abis/TickBookPoolManager";

export default createConfig({
  chains: {
    arcTestnet: {
      id: 5042002,
      rpc: process.env.ARC_TESTNET_RPC_URL 
        ?? process.env.PONDER_RPC_URL_ARC_TESTNET 
        ?? "https://rpc.testnet.arc.network",
    },
    baseSepolia: {
      id: 84532,
      rpc: process.env.BASE_SEPOLIA_RPC_URL 
        ?? process.env.PONDER_RPC_URL_BASE_SEPOLIA 
        ?? "https://sepolia.base.org",
    },
    monadTestnet: {
      id: 10143,
      rpc: process.env.MONAD_TESTNET_RPC_URL 
        ?? process.env.PONDER_RPC_URL_MONAD_TESTNET 
        ?? "https://testnet-rpc.monad.xyz",
    },
  },
  contracts: {
    TickBookPoolManager: {
      abi: TickBookPoolManagerAbi,
      chain: {
        arcTestnet: {
          address: "0x5ab590b3526bfd4ba3c51858be917271e0361311",
          startBlock: 19_000_000, // Recent blocks only
        },
        baseSepolia: {
          address: "0xb66b700d78eea06cf7aa88536ec4679fd766ffd6",
          startBlock: 35_000_000, // Recent blocks only
        },
        monadTestnet: {
          address: "0x4C593Fc2D9c33A52A4b05e4604942014076c87dc",
          startBlock: 3_000_000, // Recent blocks only
        },
      },
    },
  },
});
