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
          address: "0xc5f6b53c74a5d14336e971459ee7cf936d401384",
          startBlock: 37702590,
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
          address: "0xb7cf9d7e3357052238a9bbdc9aaaa63e1b1346f2",
          startBlock: 37702590,
        },
      },
    },
    SoothBook: {
      abi: SoothBookAbi,
      chain: {
        baseSepolia: {
          address: "0xa83b770de63349629ea1f92ad9b40285b1d47d74",
          startBlock: 37702590,
        },
      },
    },
  },
});
