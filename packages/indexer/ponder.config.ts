import { createConfig } from "ponder";

import { LaunchpadEngineAbi } from "./src/abis/LaunchpadEngine";
import { AMMEngineAbi } from "./src/abis/AMMEngine";
import { SoothBookAbi } from "./src/abis/SoothBook";

const monadRpcUrls = [
  "https://monad-mainnet.g.alchemy.com/v2/REDACTED_ALCHEMY_TOKEN",
  "https://rpc.monad.xyz",
];

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
      ethGetLogsBlockRange: 50,
    },
    baseSepolia: {
      id: 84532,
      rpc: baseSepoliaRpcUrls,
      pollingInterval: 2_000,
    },
  },
  contracts: {
    LaunchpadEngine: {
      abi: LaunchpadEngineAbi,
      chain: {
        monadMainnet: {
          address: "0xaa3Ffae62A8Af00d08Ac395e9551776b0A01E492",
          startBlock: 54706817,
        },
        baseSepolia: {
          address: "0x69a831d48d1c46ab0919d0c19cf47a2fdc842ee3",
          startBlock: 37762786,
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
          address: "0x5d2bfce963bd7e002213522a22e3615d454708b3",
          startBlock: 37762782,
        },
      },
    },
    SoothBook: {
      abi: SoothBookAbi,
      chain: {
        baseSepolia: {
          address: "0x6c3ad4d5a800b87acdfe5ba82972feb23acab011",
          startBlock: 37762784,
        },
      },
    },
  },
});
