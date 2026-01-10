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
      pollingInterval: 500,
      ethGetLogsBlockRange: 2_000,
    },
  },
  contracts: {
    TickBookPoolManager: {
      abi: TickBookPoolManagerAbi,
      chain: {
        baseSepolia: {
          address: "0x2f3464ca4a50a522786c3e72df94f12b02eec46b",
          startBlock: 35_975_490,
        },
        monadTestnet: {
          address: "0x4e9731f61c4e40e80e997a87a12c8a1dc50ec208",
          startBlock: 4_457_270,
        },
        arcTestnet: {
          address: "0xCb209Aa0E77A68378626e3f1d5136A0A5aa18B68",
          startBlock: 20_402_700,
        },
      },
    },
  },
});
