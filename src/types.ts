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

// Node/chain shapes come from the registry — re-exported from a single source
// (registry-types) rather than redeclared here, so fields like `coreVersion`,
// `adjudicators`, and `multicall3` can't silently drop out.
export type { SoothNode, ChainMeta } from './registry-types';

export interface MarketInfo {
  address: `0x${string}`;
  creator: `0x${string}`;
  lpToken: `0x${string}`;
  bBase: bigint;
  creatorDeposit: bigint;
  /** 0 until the market graduates; the block-timestamp of graduation after. */
  graduatedAt: bigint;
  isGraduated: boolean;
}

export interface Position {
  yesShares: bigint;
  noShares: bigint;
}

export interface TradeParams {
  outcome: 'yes' | 'no';
  /** 'buy' (default) increases the position; 'sell' decreases it. */
  side?: 'buy' | 'sell';
  shares: string;
  /** Max cost for a buy. Required for a buy; ignored on a sell. */
  maxCost?: string;
  /** Min proceeds for a sell. Defaults to 0 (accept any proceeds). */
  minProceeds?: string;
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
