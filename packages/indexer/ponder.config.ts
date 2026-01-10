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
      pollingInterval: 500,
      ethGetLogsBlockRange: 1_000,
    },
    arcTestnet: {
      id: 5042002,
      rpc: process.env.ARC_TESTNET_RPC_URL ?? "https://rpc.testnet.arc.network",
      pollingInterval: 2_000,
      ethGetLogsBlockRange: 100,
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
          address: "0xa4e8ba71791b014732beed5e92165c9c24db0cff",
          startBlock: 5_288_466,
        },
        arcTestnet: {
          address: "0x90d250665e49504325a0d370e566be8dc4801cce",
          startBlock: 20_500_000,
        },
      },
    },
  },
});
