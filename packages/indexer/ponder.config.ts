import { createConfig } from "ponder";

import { TickBookPoolManagerAbi } from "./src/abis/TickBookPoolManager";
import { LaunchpadEngineAbi } from "./src/abis/LaunchpadEngine";
import { TickBookVaultAbi } from "./src/abis/TickBookVault";
import { AMMEngineAbi } from "./src/abis/AMMEngine";

const monadRpcEnv = process.env.MONAD_MAINNET_RPC_URL
  ?? process.env.PONDER_RPC_URL_MONAD_MAINNET
  ?? "";
const monadRpcUrls = monadRpcEnv
  ? [monadRpcEnv, "https://rpc.monad.xyz"]
  : ["https://rpc.monad.xyz"];

const baseSepoliaRpcEnv = process.env.BASE_SEPOLIA_RPC_URL
  ?? process.env.PONDER_RPC_URL_BASE_SEPOLIA
  ?? "";
const baseSepoliaRpcUrls = baseSepoliaRpcEnv
  ? [baseSepoliaRpcEnv, "https://sepolia.base.org"]
  : ["https://sepolia.base.org"];

export default createConfig({
  chains: {
    monadMainnet: {
      id: 143,
      rpc: monadRpcUrls,
      pollingInterval: 500,
      ethGetLogsBlockRange: 1_000,
    },
    baseSepolia: {
      id: 84532,
      rpc: baseSepoliaRpcUrls,
      pollingInterval: 2_000,
    },
  },
  contracts: {
    TickBookPoolManager: {
      abi: TickBookPoolManagerAbi,
      chain: {
        monadMainnet: {
          address: "0x12A38bc9E3bD2359265cE70451777eDe2fd875A3",
          startBlock: 54706817,
        },
        baseSepolia: {
          address: "0x61ddf4716a181658e2fa9efd98b93c634ac49cdd",
          startBlock: 21127900,
        },
      },
    },
    LaunchpadEngine: {
      abi: LaunchpadEngineAbi,
      chain: {
        monadMainnet: {
          address: "0xaa3Ffae62A8Af00d08Ac395e9551776b0A01E492",
          startBlock: 54706817,
        },
        baseSepolia: {
          address: "0x3cfa2113c919c916e8334d245b157de937e76836",
          startBlock: 21127900,
        },
      },
    },
    TickBookVault: {
      abi: TickBookVaultAbi,
      chain: {
        monadMainnet: {
          address: "0x50293aD4e42593A8b081960c991c198729E81192",
          startBlock: 54706817,
        },
        baseSepolia: {
          address: "0x667c100f8f5667177fce0e9566ffe1403fc7c6f7",
          startBlock: 21127900,
        },
      },
    },
    AMMEngine: {
      abi: AMMEngineAbi,
      chain: {
        monadMainnet: {
          address: "0x8629b9ca457F4088ec8346FAED61DA858FDB498d",
          startBlock: 54706817,
        },
        baseSepolia: {
          address: "0x1399d385d2861eb046d83ededb7f4ea3aaca2ef5",
          startBlock: 21127900,
        },
      },
    },
  },
});
