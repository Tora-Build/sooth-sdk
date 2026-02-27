/**
 * Sooth SDK Public Types
 */

import type { Chain, PublicClient, WalletClient, Account } from 'viem';

export interface SoothClientOptions {
  /** Private key for write operations */
  privateKey?: `0x${string}`;
  /** Override RPC URL (default: from registry) */
  rpcUrl?: string;
  /** Override registry API URL (default: https://registry.sooth.market) */
  registryUrl?: string;
}

export interface NodeInfo {
  id: string;
  chainId: number;
  contracts: {
    launchpadEngine: `0x${string}`;
    soothBook: `0x${string}`;
    ammEngine: `0x${string}`;
    collateralizer: `0x${string}`;
    usdc: `0x${string}`;
    protocolConfig: `0x${string}`;
  };
  deployedAt: string;
  deployedBy: `0x${string}`;
  startBlock: number;
  indexed?: boolean;
}

export interface ChainInfo {
  name: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrls: string[];
  explorer: { name: string; url: string };
  testnet: boolean;
}

export interface MarketInfo {
  address: `0x${string}`;
  creator: `0x${string}`;
  bBase: bigint;
  bCurrent: bigint;
  feesAccrued: bigint;
  totalLPSupply: bigint;
  isGraduated: boolean;
  createdAt: bigint;
}

export interface Position {
  yesShares: bigint;
  noShares: bigint;
}

export interface TradeParams {
  outcome: 'yes' | 'no';
  shares: string;
  maxCost: string;
}

export interface OrderbookOrder {
  tick: number;
  amount: bigint;
}

export interface SoothClients {
  publicClient: PublicClient;
  walletClient?: WalletClient;
  account?: Account;
  chain: Chain;
}
