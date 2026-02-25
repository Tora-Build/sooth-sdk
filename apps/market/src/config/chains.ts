import {
  getSupportedChains,
  getSupportedChainIds,
  getChain,
  getAddressUrl as registryGetAddressUrl,
  getTxUrl as registryGetTxUrl,
} from '@sooth/registry';

export const SUPPORTED_CHAINS = getSupportedChains().map((c) => ({
  id: c.chainId,
  name: c.name,
  color: 'blue',
}));

export const DEFAULT_CHAIN_ID = getSupportedChainIds()[0] ?? 84532;

export const EXPLORER_URL =
  getChain(DEFAULT_CHAIN_ID)?.explorer.url ?? 'https://sepolia.basescan.org';

/**
 * Get explorer address URL. Uses chainId to pick the correct explorer.
 * Falls back to DEFAULT_CHAIN_ID if chainId is not provided.
 */
export function getAddressUrl(address: string, chainIdOrExplorerBase?: number | string): string {
  if (typeof chainIdOrExplorerBase === 'number') {
    return registryGetAddressUrl(chainIdOrExplorerBase, address);
  }
  // Legacy: accept explorerBase string for backward compat
  const base = chainIdOrExplorerBase ?? EXPLORER_URL;
  return `${base}/address/${address}`;
}

/**
 * Get explorer tx URL. Uses chainId to pick the correct explorer.
 * Falls back to DEFAULT_CHAIN_ID if chainId is not provided.
 */
export function getTxUrl(hash: string, chainIdOrExplorerBase?: number | string): string {
  if (typeof chainIdOrExplorerBase === 'number') {
    return registryGetTxUrl(chainIdOrExplorerBase, hash);
  }
  const base = chainIdOrExplorerBase ?? EXPLORER_URL;
  return `${base}/tx/${hash}`;
}
