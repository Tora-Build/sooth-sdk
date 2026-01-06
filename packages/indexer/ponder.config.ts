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
          address: "0x34a3d25e23d110da28b376591ee2e478157441f5",
          startBlock: 35_970_263,
        },
        monadTestnet: {
          address: "0x40c9032c2a4d29d7f85ae8f4b7864d22c781b4b4",
          startBlock: 4_432_510,
        },
      },
    },
  },
});
