/**
 * Indexer configuration
 * 
 * The indexer provides fast, indexed access to orderbook data.
 * Falls back to RPC if indexer is unavailable.
 */

// Default indexer URL (can be overridden via env)
export const INDEXER_URL = import.meta.env.VITE_INDEXER_URL || "http://localhost:42069";

// Whether to use indexer (disable for debugging)
export const USE_INDEXER = import.meta.env.VITE_USE_INDEXER !== "false";

// Timeout for indexer requests (ms)
export const INDEXER_TIMEOUT = 5000;

/**
 * Check if indexer is available
 */
export async function checkIndexerHealth(): Promise<boolean> {
  if (!USE_INDEXER) return false;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), INDEXER_TIMEOUT);
    
    const response = await fetch(`${INDEXER_URL}/health`, {
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch from indexer with timeout
 */
export async function fetchFromIndexer<T>(path: string): Promise<T | null> {
  if (!USE_INDEXER) return null;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), INDEXER_TIMEOUT);
    
    const response = await fetch(`${INDEXER_URL}${path}`, {
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}
