import { createConfig } from "@ponder/core";
import { http } from "viem";

import { TickBookPoolManagerAbi } from "./src/abis/TickBookPoolManager";

export default createConfig({
  networks: {
    arcTestnet: {
      chainId: 5042002,
      transport: http(process.env.PONDER_RPC_URL_ARC_TESTNET),
    },
    baseSepolia: {
      chainId: 84532,
      transport: http(process.env.PONDER_RPC_URL_BASE_SEPOLIA),
    },
    monadTestnet: {
      chainId: 10143,
      transport: http(process.env.PONDER_RPC_URL_MONAD_TESTNET),
    },
  },
  contracts: {
    TickBookPoolManager: {
      abi: TickBookPoolManagerAbi,
      network: {
        arcTestnet: {
          address: "0x5ab590b3526bfd4ba3c51858be917271e0361311",
          startBlock: 0,
        },
        baseSepolia: {
          address: "0xb66b700d78eea06cf7aa88536ec4679fd766ffd6",
          startBlock: 0,
        },
        monadTestnet: {
          address: "0x4C593Fc2D9c33A52A4b05e4604942014076c87dc",
          startBlock: 0,
        },
      },
    },
  },
});
