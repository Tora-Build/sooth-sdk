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
          // V10.3.0 deployment (matches packages/contracts-core/deployments/baseSepolia.json)
          address: "0x113067ee976fd86e5e764b559a04c2e277a82a2d",
          // Earliest observed MarketRegistered for ALIEN market: 35,932,801
          startBlock: 35_932_000,
        },
        monadTestnet: {
          // V10.3.0 deployment (matches packages/contracts-core/deployments/monadTestnet.json)
          address: "0xb5b7fe0e6ceb1e58976b6171ec2cb060c8c522f1",
          startBlock: 4_000_000,
        },
      },
    },
  },
});
