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
          address: "0xa613fe3F71fCa0913964E8f9c8b4e3f0320fC060",
          startBlock: 35_877_100, // V9.9.6-fix9l deployment 2026-01-04
        },
        monadTestnet: {
          address: "0x4e12e307165fcc37c8d67bef306c8204ff140946",
          startBlock: 3_989_818, // V9.9.6 deployment 2026-01-04
        },
      },
    },
  },
});
