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
      pollingInterval: 500,
      ethGetLogsBlockRange: 1_000,
    },
    arcTestnet: {
      id: 5042002,
      rpc: process.env.ARC_TESTNET_RPC_URL ?? "https://rpc.testnet.arc.network",
      pollingInterval: 500,
      ethGetLogsBlockRange: 2_000,
    },
  },
  contracts: {
    TickBookPoolManager: {
      abi: TickBookPoolManagerAbi,
      chain: {
        baseSepolia: {
          address: "0x3a91eae7b928f6d676c5361949eb6054505d0ad6",
          startBlock: 21_500_000,
        },
        monadTestnet: {
          address: "0x4e9731f61c4e40e80e997a87a12c8a1dc50ec208",
          startBlock: 4_457_270,
        },
        arcTestnet: {
          address: "0x90d250665e49504325a0d370e566be8dc4801cce",
          startBlock: 20_500_000,
        },
      },
    },
  },
});
