import manifest from '../nodes.json';
import { createHash } from 'node:crypto';

import type { SoothNode, ChainMeta, NodesManifest, Address } from './types';

export type { SoothNode, SoothContracts, ChainMeta, NodesManifest, Address } from './types';

const data = manifest as NodesManifest;

/** All registered Sooth nodes */
export function getAllNodes(): SoothNode[] {
  return data.nodes;
}

/** First node on a given chain (most common lookup) */
export function getNodeByChainId(chainId: number): SoothNode | undefined {
  return data.nodes.find((n) => n.chainId === chainId);
}

/** All nodes on a given chain (future: multi-node per chain) */
export function getNodesByChainId(chainId: number): SoothNode[] {
  return data.nodes.filter((n) => n.chainId === chainId);
}

/** Find node by launchpadEngine address (case-insensitive) */
export function getNodeByLaunchpad(address: string): SoothNode | undefined {
  const lower = address.toLowerCase();
  return data.nodes.find((n) => n.contracts.launchpadEngine.toLowerCase() === lower);
}

/** Find node by soothBook address (case-insensitive) */
export function getNodeBySoothBook(address: string): SoothNode | undefined {
  const lower = address.toLowerCase();
  return data.nodes.find((n) => n.contracts.soothBook.toLowerCase() === lower);
}

/** Find node by human-readable ID */
export function getNodeById(id: string): SoothNode | undefined {
  return data.nodes.find((n) => n.id === id);
}

/** Chain metadata by chainId */
export function getChain(chainId: number): ChainMeta | undefined {
  return data.chains[String(chainId)];
}

/** All supported chain IDs */
export function getSupportedChainIds(): number[] {
  return [...new Set(data.nodes.map((n) => n.chainId))];
}

/** All supported chains with their chainId */
export function getSupportedChains(): (ChainMeta & { chainId: number })[] {
  return getSupportedChainIds()
    .map((chainId) => {
      const chain = getChain(chainId);
      return chain ? { ...chain, chainId } : undefined;
    })
    .filter((c): c is ChainMeta & { chainId: number } => c !== undefined);
}

/** Explorer link for an address */
export function getAddressUrl(chainId: number, address: string): string {
  const chain = getChain(chainId);
  const base = chain?.explorer.url ?? 'https://sepolia.basescan.org';
  return `${base}/address/${address}`;
}

/** Explorer link for a transaction */
export function getTxUrl(chainId: number, txHash: string): string {
  const chain = getChain(chainId);
  const base = chain?.explorer.url ?? 'https://sepolia.basescan.org';
  return `${base}/tx/${txHash}`;
}

/**
 * Compute deterministic 8-char node ID from chainId + launchpadEngine address.
 * SHA-256(`${chainId}:${launchpadEngine}`).slice(0, 8)
 * Use this when registering a new deployment to generate its canonical id.
 * Node.js only — not available in browser bundles.
 */
export function computeNodeId(chainId: number, launchpadEngine: string): string {
  const input = `${chainId}:${launchpadEngine.toLowerCase()}`;
  return createHash('sha256').update(input).digest('hex').slice(0, 8);
}

/** Registry manifest version */
export function getRegistryVersion(): string {
  return data.version;
}
