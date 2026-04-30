/**
 * SDK CLI Configuration
 * Chain configs, contract addresses, and settings
 *
 * RPC resolution order:
 *   1. --rpc=<url> CLI flag
 *   2. `rpc set <url>` interactive command
 *   3. Registry public RPC (default)
 */

import type { Chain } from "viem";
import {
  getAllNodes,
  getNodeById,
  getChain,
  toViemChain,
} from "../registry-loader";
import type { SoothNode, ChainMeta } from "../registry-types";

// Chain definitions inlined as static literals so they don't require the
// registry manifest to be loaded at module import time. The other three
// chains below follow the same pattern.
export const monadTestnet: Chain = {
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        "https://testnet-rpc.monad.xyz",
        "https://rpc.ankr.com/monad_testnet",
        "https://rpc-testnet.monadinfra.com",
      ],
    },
  },
  blockExplorers: {
    default: {
      name: "MonadExplorer",
      url: "https://testnet.monadexplorer.com",
    },
  },
  testnet: true,
};

export const arcTestnet: Chain = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: {
    default: {
      http: ["https://rpc.testnet.arc.network"],
    },
  },
  blockExplorers: {
    default: { name: "Arcscan", url: "https://testnet.arcscan.app" },
  },
  testnet: true,
};

export const megaethTestnet: Chain = {
  id: 6343,
  name: "MegaETH Testnet",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://carrot.megaeth.com/rpc"],
    },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: "https://megaeth-testnet-v2.blockscout.com",
    },
  },
  testnet: true,
};

export const hyperEvmTestnet: Chain = {
  id: 998,
  name: "HyperEVM Testnet",
  nativeCurrency: { name: "HYPE", symbol: "HYPE", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://rpc.hyperliquid-testnet.xyz/evm"],
    },
  },
  blockExplorers: {
    default: { name: "Purrsec", url: "https://testnet.purrsec.com" },
  },
  testnet: true,
};

function resolveNodeId(input: string): string {
  const trimmed = input.trim();
  if (!/^[0-9a-f]{8}$/i.test(trimmed)) {
    throw new Error(
      `Invalid node ID: "${input}". Node IDs must be 8 hex characters. Run \`soothcli --list\` for valid IDs.`,
    );
  }

  const nodeId = trimmed.toLowerCase();
  const node = getNodeById(nodeId);

  if (node) return nodeId;

  throw new Error(
    `Unknown node ID: "${input}". Available: ${getAllNodes()
      .map((n) => n.id)
      .join(", ")}`,
  );
}

export interface Deployment {
  chainId: number;
  chainName: string;
  coreVersion: string;
  contracts: {
    SoothBook?: string;
    BaseToken: string;
    OrderEngine: string;
    AMMEngine: string;
    LaunchpadEngine: string;
    TruthMarket: string;
    FeeRouter: string;
    AdjudicatorRegistry: string;
    [key: string]: string | undefined;
  };
  adjudicators?: {
    default?: string;
    manual?: string;
    zkTLS?: string;
    optimistic?: string;
  };
  markets: Array<{
    key: string;
    name: string;
    yesToken: string;
    noToken: string;
    address?: string;
    marketKey?: string;
    isGraduated?: boolean;
  }>;
}

function nodeToDeployment(node: SoothNode, chain: ChainMeta): Deployment {
  return {
    chainId: node.chainId,
    chainName: chain.name,
    coreVersion: node.coreVersion,
    contracts: {
      SoothBook: node.contracts.soothBook,
      BaseToken: node.contracts.baseToken,
      OrderEngine: node.contracts.orderEngine,
      AMMEngine: node.contracts.ammEngine,
      LaunchpadEngine: node.contracts.launchpadEngine,
      TruthMarket: node.contracts.truthMarket,
      FeeRouter: node.contracts.feeRouter,
      DefaultAdjudicator: node.adjudicators?.default,
      AdjudicatorRegistry: node.contracts.adjudicatorRegistry,
    },
    adjudicators: node.adjudicators,
    markets: [],
  };
}

function getPostTxWait(chainId: number): number {
  if (chainId === 10143) return 8000;
  return 0;
}

// CLI is hardcoded against this sooth-core version's ABIs and call flow.
// Connecting to a node with a different coreVersion produces ABI mismatches
// (e.g. settle() arity, isMarketSettled vs isSettled). Refuse to start.
export const SUPPORTED_CORE_VERSION = "0.2.1";

// SDK version tracks the contract version it speaks. Bump both together.
// If we ever need a patch release without a contract change, append `-N`
// (e.g. "0.2.0-1") so the major.minor.patch still encodes contract compat.
export const SDK_VERSION = SUPPORTED_CORE_VERSION;

export interface InteractiveConfig {
  nodeId: string;
  chainName: string;
  coreVersion: string;
  chain: Chain;
  rpc: string;
  deployment: Deployment;
  gasMultiplier: number;
  confirmations: number;
  postTxWaitMs: number;
  defaultMarketIndex: number;
}

export function createConfig(nodeIdInput: string): InteractiveConfig {
  const nodeId = resolveNodeId(nodeIdInput);
  const node = getNodeById(nodeId);
  if (!node) {
    throw new Error(
      `Node not found: "${nodeId}". Is it registered in nodes.json?`,
    );
  }
  const chainMeta = getChain(node.chainId);
  if (!chainMeta) {
    throw new Error(`Chain metadata not found for chainId ${node.chainId}`);
  }

  const rpc = chainMeta.rpcUrls[0];
  const chain = toViemChain(node.chainId, [rpc]);

  return {
    nodeId,
    chainName: chainMeta.name,
    coreVersion: node.coreVersion,
    chain,
    rpc,
    deployment: nodeToDeployment(node, chainMeta),
    gasMultiplier: 1.2,
    confirmations: 1,
    postTxWaitMs: getPostTxWait(node.chainId),
    defaultMarketIndex: 0,
  };
}

// Contract ABIs (minimal for interactive testing)
export const ABIS = {
  BaseToken: [
    {
      name: "mint",
      type: "function",
      inputs: [
        { type: "address", name: "to" },
        { type: "uint256", name: "amount" },
      ],
      outputs: [],
      stateMutability: "nonpayable",
    },
    {
      name: "approve",
      type: "function",
      inputs: [
        { type: "address", name: "spender" },
        { type: "uint256", name: "amount" },
      ],
      outputs: [{ type: "bool" }],
      stateMutability: "nonpayable",
    },
    {
      name: "balanceOf",
      type: "function",
      inputs: [{ type: "address", name: "account" }],
      outputs: [{ type: "uint256" }],
      stateMutability: "view",
    },
    {
      name: "allowance",
      type: "function",
      inputs: [
        { type: "address", name: "owner" },
        { type: "address", name: "spender" },
      ],
      outputs: [{ type: "uint256" }],
      stateMutability: "view",
    },
    {
      name: "decimals",
      type: "function",
      inputs: [],
      outputs: [{ type: "uint8" }],
      stateMutability: "view",
    },
    {
      name: "totalSupply",
      type: "function",
      inputs: [],
      outputs: [{ type: "uint256" }],
      stateMutability: "view",
    },
  ],

  OutcomeToken: [
    {
      name: "balanceOf",
      type: "function",
      inputs: [{ type: "address", name: "account" }],
      outputs: [{ type: "uint256" }],
      stateMutability: "view",
    },
    {
      name: "approve",
      type: "function",
      inputs: [
        { type: "address", name: "spender" },
        { type: "uint256", name: "amount" },
      ],
      outputs: [{ type: "bool" }],
      stateMutability: "nonpayable",
    },
    {
      name: "allowance",
      type: "function",
      inputs: [
        { type: "address", name: "owner" },
        { type: "address", name: "spender" },
      ],
      outputs: [{ type: "uint256" }],
      stateMutability: "view",
    },
    {
      name: "totalSupply",
      type: "function",
      inputs: [],
      outputs: [{ type: "uint256" }],
      stateMutability: "view",
    },
  ],

  SoothBook: [
    {
      name: "buyYes",
      type: "function",
      inputs: [
        { type: "bytes32", name: "marketKey" },
        { type: "uint16", name: "tick" },
        { type: "uint128", name: "amount" },
        { type: "bool", name: "escrow" },
        { type: "uint32", name: "matchLimit" },
      ],
      outputs: [],
      stateMutability: "nonpayable",
    },
    {
      name: "buyNo",
      type: "function",
      inputs: [
        { type: "bytes32", name: "marketKey" },
        { type: "uint16", name: "tick" },
        { type: "uint128", name: "amount" },
        { type: "bool", name: "escrow" },
        { type: "uint32", name: "matchLimit" },
      ],
      outputs: [],
      stateMutability: "nonpayable",
    },
    {
      name: "mint",
      type: "function",
      inputs: [
        { type: "bytes32", name: "marketKey" },
        { type: "uint256", name: "amount" },
      ],
      outputs: [],
      stateMutability: "nonpayable",
    },
    {
      name: "merge",
      type: "function",
      inputs: [
        { type: "bytes32", name: "marketKey" },
        { type: "uint256", name: "amount" },
      ],
      outputs: [],
      stateMutability: "nonpayable",
    },
    {
      name: "cancel",
      type: "function",
      inputs: [
        { type: "bytes32", name: "marketKey" },
        { type: "uint8", name: "side" },
        { type: "uint16", name: "tick" },
      ],
      outputs: [],
      stateMutability: "nonpayable",
    },
    {
      name: "createMarket",
      type: "function",
      inputs: [
        { type: "bytes32", name: "marketKey" },
        { type: "address", name: "collateral" },
        { type: "string", name: "name" },
      ],
      outputs: [
        { type: "address", name: "yesToken" },
        { type: "address", name: "noToken" },
      ],
      stateMutability: "nonpayable",
    },
    {
      name: "getBalance",
      type: "function",
      inputs: [
        { type: "bytes32", name: "marketKey" },
        { type: "address", name: "user" },
      ],
      outputs: [
        { type: "uint256", name: "yes" },
        { type: "uint256", name: "no" },
      ],
      stateMutability: "view",
    },
    {
      name: "getCollateralBacking",
      type: "function",
      inputs: [{ type: "bytes32", name: "marketKey" }],
      outputs: [{ type: "uint256" }],
      stateMutability: "view",
    },
    {
      name: "getBestTick",
      type: "function",
      inputs: [
        { type: "bytes32", name: "marketKey" },
        { type: "uint8", name: "side" },
      ],
      outputs: [{ type: "uint16" }],
      stateMutability: "view",
    },
    {
      name: "getOrdersAtTick",
      type: "function",
      inputs: [
        { type: "bytes32", name: "marketKey" },
        { type: "uint8", name: "side" },
        { type: "uint16", name: "tick" },
      ],
      outputs: [
        { type: "uint256", name: "totalAmount" },
        { type: "uint256", name: "orderCount" },
      ],
      stateMutability: "view",
    },
    {
      name: "getImpliedPrice",
      type: "function",
      inputs: [{ type: "address", name: "market" }],
      outputs: [
        { type: "uint256", name: "yesPrice" },
        { type: "uint256", name: "noPrice" },
      ],
      stateMutability: "view",
    },
    {
      name: "getImpliedPriceByKey",
      type: "function",
      inputs: [{ type: "bytes32", name: "marketKey" }],
      outputs: [
        { type: "uint256", name: "yesPrice" },
        { type: "uint256", name: "noPrice" },
      ],
      stateMutability: "view",
    },
    {
      name: "registeredMarkets",
      type: "function",
      inputs: [{ type: "bytes32", name: "marketKey" }],
      outputs: [{ type: "bool" }],
      stateMutability: "view",
    },
    {
      name: "isMarketRegistered",
      type: "function",
      inputs: [{ type: "address", name: "market" }],
      outputs: [{ type: "bool" }],
      stateMutability: "view",
    },
    {
      name: "feeBps",
      type: "function",
      inputs: [],
      outputs: [{ type: "uint24" }],
      stateMutability: "view",
    },
    {
      name: "feeRecipient",
      type: "function",
      inputs: [],
      outputs: [{ type: "address" }],
      stateMutability: "view",
    },
    {
      name: "owner",
      type: "function",
      inputs: [],
      outputs: [{ type: "address" }],
      stateMutability: "view",
    },
  ],

  LaunchpadEngine: [
    {
      // v0.1.0: markets struct reduced to 5 fields
      name: "markets",
      type: "function",
      inputs: [{ type: "address", name: "market" }],
      outputs: [
        { type: "address", name: "creator" },
        { type: "address", name: "lpToken" },
        { type: "uint256", name: "bBase" },
        { type: "uint256", name: "creatorDeposit" },
        { type: "uint64", name: "graduatedAt" },
      ],
      stateMutability: "view",
    },
    {
      name: "isGraduated",
      type: "function",
      inputs: [{ type: "address", name: "market" }],
      outputs: [{ type: "bool" }],
      stateMutability: "view",
    },
    {
      name: "getMarkets",
      type: "function",
      inputs: [],
      outputs: [{ type: "address[]" }],
      stateMutability: "view",
    },
    {
      name: "getMarketCount",
      type: "function",
      inputs: [],
      outputs: [{ type: "uint256" }],
      stateMutability: "view",
    },
  ],

  AMMEngine: [
    {
      name: "tradePositions",
      type: "function",
      inputs: [
        { type: "address", name: "market" },
        { type: "uint8", name: "outcome" },
        { type: "int256", name: "deltaShares" },
        { type: "uint256", name: "maxCostOrMinProceeds" },
      ],
      outputs: [{ type: "uint256" }],
      stateMutability: "nonpayable",
    },
    {
      name: "getPosition",
      type: "function",
      inputs: [
        { type: "address", name: "market" },
        { type: "address", name: "user" },
      ],
      outputs: [{ type: "uint256" }, { type: "uint256" }],
      stateMutability: "view",
    },
    {
      name: "getBalances",
      type: "function",
      inputs: [{ type: "address", name: "user" }],
      outputs: [
        { type: "uint256", name: "available" },
        { type: "uint256", name: "locked" },
      ],
      stateMutability: "view",
    },
    {
      name: "getMarketState",
      type: "function",
      inputs: [{ type: "address", name: "market" }],
      outputs: [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }],
      stateMutability: "view",
    },
    {
      name: "protocolTreasury",
      type: "function",
      inputs: [],
      outputs: [{ type: "address" }],
      stateMutability: "view",
    },
  ],
} as const;

export { WAD, MAX_UINT256 } from "../core/types";
