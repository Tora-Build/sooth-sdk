/**
 * Indexer configuration for launchpad markets
 * 
 * Provides REST client for fetching graduated markets from Ponder indexer.
 */

export const INDEXER_URL = import.meta.env.VITE_INDEXER_URL || 'https://sooth-indexer.onrender.com';
export const INDEXER_TIMEOUT = 8000; // 8s for production

/**
 * Fetch from indexer with timeout and error handling
 */
export async function fetchFromIndexer<T>(path: string): Promise<T | null> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), INDEXER_TIMEOUT);
    const res = await fetch(`${INDEXER_URL}${path}`, { signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) return null;
    return await res.json() as T;
  } catch {
    return null;
  }
}

/**
 * Check if indexer is healthy
 */
export async function checkIndexerHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${INDEXER_URL}/api-health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}
