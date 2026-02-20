import { createConfig } from "ponder";

import { LaunchpadEngineAbi } from "./src/abis/LaunchpadEngine";
import { AMMEngineAbi } from "./src/abis/AMMEngine";
import { SoothBookAbi } from "./src/abis/SoothBook";

const monadTestnetRpcUrls = [
  "https://blue-stylish-friday.monad-testnet.quiknode.pro/e8b690b8d333c538f85bab9c93a2a3b512a4cb9a/",
  "https://testnet-rpc.monad.xyz",
];

const baseSepoliaRpcEnv = process.env.BASE_SEPOLIA_RPC_URL
  ?? process.env.PONDER_RPC_URL_BASE_SEPOLIA
  ?? "";
const baseSepoliaRpcUrls = baseSepoliaRpcEnv
  ? [baseSepoliaRpcEnv, "https://sepolia.base.org"]
  : ["https://sepolia.base.org"];

export default createConfig({
  chains: {
    monadTestnet: {
      id: 10143,
      rpc: monadTestnetRpcUrls,
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
        monadTestnet: {
          address: "0x6fd82b76045af934354a2033fde5cb64772ae615",
          startBlock: 13700000,
        },
        baseSepolia: {
          address: "0xf00fb446d1262d1f4100e6d899cf0c8c298a6e61",
          startBlock: 37890676,
        },
      },
    },
    AMMEngine: {
      abi: AMMEngineAbi,
      chain: {
        monadTestnet: {
          address: "0x28b799febd74b92d8ff17745ad432bfa86799fc8",
          startBlock: 13700000,
        },
        baseSepolia: {
          address: "0x1d736e5008b775948e0cbd06bbf0074d48a9803a",
          startBlock: 37890676,
        },
      },
    },
    SoothBook: {
      abi: SoothBookAbi,
      chain: {
        monadTestnet: {
          address: "0x94818c56b904371bf100acf723a7619dfc2c2ec0",
          startBlock: 13700000,
        },
        baseSepolia: {
          address: "0x0eb179c7e79e62bac3ee40d379425e32cb00d22b",
          startBlock: 37890676,
        },
      },
    },
  },
});
