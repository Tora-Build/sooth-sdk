import type { Address } from 'viem';

/**
 * Common Market interface shared between Monad and Lens providers
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
  // Lens-specific fields (optional)
  lensPostId?: string;
  lensAuthor?: string;
}

/**
 * Commit/Position interface (future: for Lens comments as commits)
 */
export interface Commit {
  id: string;
  marketId: string;
  author: string;
  position: 'YES' | 'NO';
  confidence?: number;
  amount?: string;
  timestamp: bigint;
  // Lens-specific
  lensCommentId?: string;
}

/**
 * Provider interface - abstracts data fetching from different sources
 */
export interface Provider {
  name: string;
  chainId: number;
  
  /**
   * Fetch all markets from this provider
   */
  fetchMarkets(): Promise<Market[]>;
  
  /**
   * Fetch a single market by ID
   */
  fetchMarket(marketId: string): Promise<Market | null>;
  
  /**
   * Health check for this provider
   */
  checkHealth(): Promise<boolean>;
}

/**
 * Network configuration for provider selection
 */
export interface NetworkConfig {
  id: 'monad' | 'lens';
  name: string;
  chainId: number;
  icon?: string;
  enabled: boolean;
}
