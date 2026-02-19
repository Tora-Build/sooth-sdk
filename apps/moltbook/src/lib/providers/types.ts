import type { Address } from 'viem';

/**
 * Market interface for Monad provider
 */
export interface Market {
  address: Address;
  question: string;
  stage: 'bonding' | 'live' | 'settled' | 'finalized' | 'dismissed';
  yesProbability?: number;
  volume?: bigint;
  winningOutcome?: number | null;
  createdAt: bigint;
  deadline?: bigint;
  totalLPSupply?: bigint;
  lpToken?: Address;
}

/**
 * Provider interface - abstracts data fetching
 */
export interface Provider {
  name: string;
  chainId: number;
  fetchMarkets(): Promise<Market[]>;
  fetchMarket(marketId: string): Promise<Market | null>;
  checkHealth(): Promise<boolean>;
}

/**
 * Network configuration
 */
export interface NetworkConfig {
  id: 'monad';
  name: string;
  chainId: number;
  icon?: string;
  enabled: boolean;
}
