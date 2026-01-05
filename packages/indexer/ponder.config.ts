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
        ?? "https://blue-stylish-friday.monad-testnet.quiknode.pro/e8b690b8d333c538f85bab9c93a2a3b512a4cb9a/",
    },
  },
  contracts: {
    TickBookPoolManager: {
      abi: TickBookPoolManagerAbi,
      chain: {
        baseSepolia: {
          address: "0x32c228f558eca71a1aab8663162b4b4bf87bdd1a",
          startBlock: 35_900_000, // V9.9.7 deployment 2026-01-05
        },
        monadTestnet: {
          address: "0xc80c8b4c56a62614d9408b805b40580dd9420361",
          startBlock: 3_989_818, // V9.9.7 deployment 2026-01-05
        },
      },
    },
  },
});
