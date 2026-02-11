import { MONAD_MAINNET_CHAIN_ID } from './config';

// Only use indexer if explicitly configured — otherwise fall back to RPC
const INDEXER_URL = import.meta.env.VITE_INDEXER_URL || '';

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
  // Settlement fields (from TruthMarket contract)
  deadline: string | null;
  isSettled: boolean | null;
  isFinalized: boolean | null;
  winningOutcome: number | null;
  // Reserve tracking (for computing price)
  yesReserves: string | null;
  noReserves: string | null;
  // Price tracking (computed from reserves)
  yesProbability: number | null;
}

/**
 * Fetch launchpad markets from indexer
 * GET /launchpad-markets/:chainId
 */
export async function fetchLaunchpadMarketsFromIndexer(): Promise<IndexerLaunchpadMarket[]> {
  if (!INDEXER_URL) throw new Error('Indexer not configured');
  const response = await fetch(`${INDEXER_URL}/launchpad-markets/${MONAD_MAINNET_CHAIN_ID}`);
  if (!response.ok) {
    throw new Error(`Indexer error: ${response.status}`);
  }
  return response.json();
}

export async function fetchOrderbookFromIndexer(marketKey: string) {
  const response = await fetch(`${INDEXER_URL}/orderbook/${MONAD_MAINNET_CHAIN_ID}/${marketKey}`);
  if (!response.ok) {
    throw new Error(`Indexer error: ${response.status}`);
  }
  return response.json();
}

export async function checkIndexerHealth(): Promise<boolean> {
  if (!INDEXER_URL) return false;
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
