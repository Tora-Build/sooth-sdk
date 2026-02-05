import { MONAD_TESTNET_CHAIN_ID } from './config';

const INDEXER_URL = import.meta.env.VITE_INDEXER_URL || 'http://localhost:42069';

/**
 * LaunchpadMarket from indexer - matches ponder.schema.ts launchpadMarket table
 */
export interface IndexerLaunchpadMarket {
  address: `0x${string}`;
  chainId: number;
  creator: `0x${string}`;
  name: string | null; // Market question
  symbol: string | null;
  initialLiquidity: string;
  deposit: string;
  totalLPSupply: string;
  isGraduated: boolean;
  createdAt: string;
  graduatedAt: string | null;
  blockNumber: string;
  lpToken: `0x${string}` | null;
  trialEndTime: string | null;
  isDismissed: boolean | null;
}

/**
 * Fetch launchpad markets from indexer
 * GET /launchpad-markets/:chainId
 */
export async function fetchLaunchpadMarketsFromIndexer(): Promise<IndexerLaunchpadMarket[]> {
  const response = await fetch(`${INDEXER_URL}/launchpad-markets/${MONAD_TESTNET_CHAIN_ID}`);
  if (!response.ok) {
    throw new Error(`Indexer error: ${response.status}`);
  }
  return response.json();
}

export async function fetchOrderbookFromIndexer(marketKey: string) {
  const response = await fetch(`${INDEXER_URL}/orderbook/${MONAD_TESTNET_CHAIN_ID}/${marketKey}`);
  if (!response.ok) {
    throw new Error(`Indexer error: ${response.status}`);
  }
  return response.json();
}

export async function checkIndexerHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${INDEXER_URL}/api-health`, { 
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
