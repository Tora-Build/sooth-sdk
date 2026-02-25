import { createConfig } from "ponder";
import nodesManifest from "@sooth/registry/nodes.json";
import type { NodesManifest } from "@sooth/registry";

import { LaunchpadEngineAbi } from "./src/abis/LaunchpadEngine";
import { AMMEngineAbi } from "./src/abis/AMMEngine";
import { SoothBookAbi } from "./src/abis/SoothBook";

const registry = nodesManifest as NodesManifest;

// Chain-specific overrides (private RPCs, polling, block range limits)
const chainOverrides: Record<string, {
  rpc?: string[];
  pollingInterval?: number;
  ethGetLogsBlockRange?: number;
}> = {
  "10143": {
    rpc: [
      "https://blue-stylish-friday.monad-testnet.quiknode.pro/e8b690b8d333c538f85bab9c93a2a3b512a4cb9a/",
      "https://testnet-rpc.monad.xyz",
    ],
    pollingInterval: 500,
    ethGetLogsBlockRange: 50,
  },
  "84532": {
    pollingInterval: 2_000,
  },
};

// Build chain name from registry (ponder needs string keys)
function chainKey(chainId: number): string {
  const meta = registry.chains[String(chainId)];
  if (!meta) return `chain_${chainId}`;
  return meta.name.replace(/\s+/g, '').replace(/^(.)/, (_, c) => c.toLowerCase());
}

// Build chains config dynamically
const chains: Record<string, { id: number; rpc: string[]; pollingInterval?: number; ethGetLogsBlockRange?: number }> = {};
for (const node of registry.nodes) {
  const key = chainKey(node.chainId);
  const meta = registry.chains[String(node.chainId)];
  const overrides = chainOverrides[String(node.chainId)] ?? {};

  const baseSepoliaRpcEnv = process.env.BASE_SEPOLIA_RPC_URL
    ?? process.env.PONDER_RPC_URL_BASE_SEPOLIA
    ?? "";

  let rpcUrls: string[];
  if (overrides.rpc) {
    rpcUrls = overrides.rpc;
  } else if (node.chainId === 84532 && baseSepoliaRpcEnv) {
    rpcUrls = [baseSepoliaRpcEnv, ...(meta?.rpcUrls ?? [])];
  } else {
    rpcUrls = meta?.rpcUrls ?? [];
  }

  chains[key] = {
    id: node.chainId,
    rpc: rpcUrls,
    ...(overrides.pollingInterval && { pollingInterval: overrides.pollingInterval }),
    ...(overrides.ethGetLogsBlockRange && { ethGetLogsBlockRange: overrides.ethGetLogsBlockRange }),
  };
}

// Build per-chain contract addresses from registry
type ChainAddress = { address: `0x${string}`; startBlock: number };
type ContractChains = Record<string, ChainAddress>;

function buildContractChains(contractKey: keyof typeof registry.nodes[0]['contracts']): ContractChains {
  const result: ContractChains = {};
  for (const node of registry.nodes) {
    const key = chainKey(node.chainId);
    result[key] = {
      address: node.contracts[contractKey] as `0x${string}`,
      startBlock: node.startBlock,
    };
  }
  return result;
}

export default createConfig({
  chains,
  contracts: {
    LaunchpadEngine: {
      abi: LaunchpadEngineAbi,
      chain: buildContractChains('launchpadEngine'),
    },
    AMMEngine: {
      abi: AMMEngineAbi,
      chain: buildContractChains('ammEngine'),
    },
    SoothBook: {
      abi: SoothBookAbi,
      chain: buildContractChains('soothBook'),
    },
  },
});
