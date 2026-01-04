import { createConfig } from "ponder";

import { TickBookPoolManagerAbi } from "./src/abis/TickBookPoolManager";

export default createConfig({
  chains: {
    // Only Base Sepolia for now
    baseSepolia: {
      id: 84532,
      rpc: process.env.BASE_SEPOLIA_RPC_URL 
        ?? process.env.PONDER_RPC_URL_BASE_SEPOLIA 
        ?? "https://sepolia.base.org",
    },
    // Disabled temporarily:
    // arcTestnet: {
    //   id: 5042002,
    //   rpc: process.env.ARC_TESTNET_RPC_URL ?? "https://rpc.testnet.arc.network",
    // },
    // monadTestnet: {
    //   id: 10143,
    //   rpc: process.env.MONAD_TESTNET_RPC_URL ?? "https://testnet-rpc.monad.xyz",
    // },
  },
  contracts: {
    TickBookPoolManager: {
      abi: TickBookPoolManagerAbi,
      chain: {
        baseSepolia: {
          address: "0xa613fe3F71fCa0913964E8f9c8b4e3f0320fC060",
          startBlock: 35_877_100, // V9.9.6-fix9l deployment 2026-01-04
        },
        // Disabled temporarily:
        // arcTestnet: {
        //   address: "0x5ab590b3526bfd4ba3c51858be917271e0361311",
        //   startBlock: 19_000_000,
        // },
        // monadTestnet: {
        //   address: "0x4C593Fc2D9c33A52A4b05e4604942014076c87dc",
        //   startBlock: 3_000_000,
        // },
      },
    },
  },
});
