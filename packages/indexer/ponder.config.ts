import { createConfig } from "ponder";

import { TickBookPoolManagerAbi } from "./src/abis/TickBookPoolManager";

export default createConfig({
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
    },
  },
  contracts: {
    TickBookPoolManager: {
      abi: TickBookPoolManagerAbi,
      chain: {
        baseSepolia: {
          address: "0x36abe6344a3756868f6ac26d81f1c7a40d68b0ba",
          startBlock: 22_000_000, // V10.0.0 deployment 2026-01-05
        },
        monadTestnet: {
          address: "0x0d9cb90f5bb982ed6a96a412a423317580d032ad",
          startBlock: 4_100_000, // V10.0.0 deployment 2026-01-05
        },
      },
    },
  },
});
