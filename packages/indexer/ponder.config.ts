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
    arcTestnet: {
      id: 5042002,
      rpc: process.env.ARC_TESTNET_RPC_URL ?? "https://rpc.testnet.arc.network",
    },
  },
  contracts: {
    TickBookPoolManager: {
      abi: TickBookPoolManagerAbi,
      chain: {
        baseSepolia: {
          address: "0x1b6c55c70ae4dafdc8cda646af83bb3554dac388",
          startBlock: 35_975_490,
        },
        monadTestnet: {
          address: "0xc0768a0be30662cd15e7ff4bd79ae8a110681ae0",
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
