import { createConfig } from "ponder";

import { TickBookPoolManagerAbi } from "./src/abis/TickBookPoolManager";
import { LaunchpadEngineAbi } from "./src/abis/LaunchpadEngine";
import { TickBookVaultAbi } from "./src/abis/TickBookVault";
import { AMMEngineAbi } from "./src/abis/AMMEngine";

// Arc RPC: check both env var names, use stable RPC endpoint
const arcRpcEnv = process.env.ARC_TESTNET_RPC_URL
  ?? process.env.PONDER_RPC_URL_ARC_TESTNET
  ?? "";
const arcRpcCandidates = arcRpcEnv
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);
const arcRpcUrls = arcRpcCandidates.length > 0
  ? arcRpcCandidates
  : ["https://rpc.testnet.arc.network"];

const baseRpcEnv = process.env.BASE_SEPOLIA_RPC_URL
  ?? process.env.PONDER_RPC_URL_BASE_SEPOLIA
  ?? "";
const baseRpcCandidates = baseRpcEnv
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);
const baseRpcUrls = Array.from(
  new Set(
    baseRpcCandidates.length > 0
      ? [...baseRpcCandidates, "https://sepolia.base.org"]
      : ["https://sepolia.base.org"],
  ),
);

const monadRpcEnv = process.env.MONAD_TESTNET_RPC_URL
  ?? process.env.PONDER_RPC_URL_MONAD_TESTNET
  ?? "";
const monadRpcUrls = monadRpcEnv
  ? [monadRpcEnv, "https://testnet-rpc.monad.xyz"]
  : ["https://testnet-rpc.monad.xyz"];

export default createConfig({
  chains: {
    baseSepolia: {
      id: 84532,
      rpc: baseRpcUrls,
    },
    monadTestnet: {
      id: 10143,
      rpc: monadRpcUrls,
      pollingInterval: 500,
      ethGetLogsBlockRange: 1_000,
    },
    // V11.1: Disabled - single-chain focus
    /*
    arcTestnet: {
      id: 5042002,
      rpc: arcRpcUrls,
      pollingInterval: 2_000,
      ethGetLogsBlockRange: 10,
    },
    */
    // V11.1: Disabled - single-chain focus
    /*
    megaethTestnet: {
      id: 6343,
      rpc: process.env.MEGAETH_TESTNET_RPC_URL ?? "https://carrot.megaeth.com/rpc",
      pollingInterval: 2_000,
      ethGetLogsBlockRange: 500,
    },
    */
  },
  contracts: {
    TickBookPoolManager: {
      abi: TickBookPoolManagerAbi,
      chain: {
        baseSepolia: {
          address: "0x61ddf4716a181658e2fa9efd98b93c634ac49cdd",
          startBlock: 36814637,
        },
        monadTestnet: {
          address: "0xcc8fbc38af3510c9b28941298b5bdd481a7698b4",
          startBlock: 10_842_400,
        },
        // V11.1: Disabled - single-chain focus
        /*
        arcTestnet: {
          address: "0x8ba9751284d77ed59f46ea877577e6430bc30209",
          startBlock: 22_800_000,
        },
        */
        // V11.1: Disabled - single-chain focus
        /*
        megaethTestnet: {
          address: "0xf52a8e9f5defcc6fe0e66b523d29ad7cfc3af530",
          startBlock: 9_500_000,
        },
        */
      },
    },
    LaunchpadEngine: {
      abi: LaunchpadEngineAbi,
      chain: {
        baseSepolia: {
          address: "0x3cfa2113c919c916e8334d245b157de937e76836",
          startBlock: 36814637,
        },
        monadTestnet: {
          address: "0x744724aa5b389644f31dfcfbb67786b581602084",
          startBlock: 10_842_400,
        },
        // V11.1: Disabled - single-chain focus
        /*
        arcTestnet: {
          address: "0x625b4b2997232380126f0aecd84867086f89b27e",
          startBlock: 22_800_000,
        },
        */
        // V11.1: Disabled - single-chain focus
        /*
        megaethTestnet: {
          address: "0xa2b2653124cb98b4d83a8a314e5e0bef2621832f",
          startBlock: 9_500_000,
        },
        */
      },
    },
    TickBookVault: {
      abi: TickBookVaultAbi,
      chain: {
        baseSepolia: {
          address: "0x667c100f8f5667177fce0e9566ffe1403fc7c6f7",
          startBlock: 36814637,
        },
        monadTestnet: {
          address: "0x93c9ee74896f1f7854a35003d92c9e7b54c0f296",
          startBlock: 10_842_400,
        },
        // V11.1: Disabled - single-chain focus
        /*
        arcTestnet: {
          address: "0x1695ac9983f457e446d8f903d7c4061fbc7907f8",
          startBlock: 22_800_000,
        },
        */
        // V11.1: Disabled - single-chain focus
        /*
        megaethTestnet: {
          address: "0x5b9a8b49d5616326bd61ac57b429cbf84e8cc756",
          startBlock: 9_500_000,
        },
        */
      },
    },
    AMMEngine: {
      abi: AMMEngineAbi,
      chain: {
        baseSepolia: {
          address: "0x1399d385d2861eb046d83ededb7f4ea3aaca2ef5",
          startBlock: 36814637,
        },
        monadTestnet: {
          address: "0x67147bc54df45ce43cb88b735043c496047596a7",
          startBlock: 10_842_400,
        },
        // V11.1: Disabled - single-chain focus
        /*
        arcTestnet: {
          address: "0x0f0dd0be87f6ab153e732039469fe64353b95dbb",
          startBlock: 22_800_000,
        },
        */
        // V11.1: Disabled - single-chain focus
        /*
        megaethTestnet: {
          address: "0x61470420cc117e9460aae3bdc6cdf77c443ac09c",
          startBlock: 9_500_000,
        },
        */
      },
    },
  },
});
