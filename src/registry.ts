/**
 * Registry — fetches node/chain data from the Sooth Registry API
 */

import type { NodesManifest } from './registry-types';
import type { NodeInfo, ChainInfo } from './types';

export type {
  SoothNode,
  SoothContracts,
  ChainMeta,
  NodesManifest,
  Address,
} from './registry-types';

const DEFAULT_REGISTRY_URL = 'https://registry.sooth.market';
const CACHE_TTL_MS = 60_000;

let cachedManifest: NodesManifest | null = null;
let cachedAt = 0;

async function fetchManifest(registryUrl: string): Promise<NodesManifest> {
  const now = Date.now();
  if (cachedManifest && now - cachedAt < CACHE_TTL_MS) {
    return cachedManifest;
  }

  const res = await fetch(`${registryUrl}/v1/manifest`);
  if (!res.ok) throw new Error(`Registry API error: HTTP ${res.status}`);
  const json = (await res.json()) as { data: NodesManifest };
  cachedManifest = json.data;
  cachedAt = now;
  return cachedManifest;
}

export class Registry {
  private url: string;

  constructor(registryUrl?: string) {
    this.url = registryUrl ?? DEFAULT_REGISTRY_URL;
  }

  async getManifest(): Promise<NodesManifest> {
    return fetchManifest(this.url);
  }

  async getNode(id: string): Promise<NodeInfo | undefined> {
    const manifest = await fetchManifest(this.url);
    return manifest.nodes.find((n) => n.id === id) as NodeInfo | undefined;
  }

  async getNodeByChainId(chainId: number): Promise<NodeInfo | undefined> {
    const manifest = await fetchManifest(this.url);
    return manifest.nodes.find((n) => n.chainId === chainId) as NodeInfo | undefined;
  }

  async getAllNodes(): Promise<NodeInfo[]> {
    const manifest = await fetchManifest(this.url);
    return manifest.nodes as NodeInfo[];
  }

  async getChain(chainId: number): Promise<ChainInfo | undefined> {
    const manifest = await fetchManifest(this.url);
    return manifest.chains[String(chainId)] as ChainInfo | undefined;
  }

  async getAllChains(): Promise<Record<string, ChainInfo>> {
    const manifest = await fetchManifest(this.url);
    return manifest.chains as Record<string, ChainInfo>;
  }

  async listNodes(): Promise<
    Array<{ id: string; chainId: number; chainName: string; indexed: boolean }>
  > {
    const manifest = await fetchManifest(this.url);
    return manifest.nodes.map((n) => ({
      id: n.id,
      chainId: n.chainId,
      chainName: manifest.chains[String(n.chainId)]?.name ?? `Chain ${n.chainId}`,
      indexed: n.indexed !== false,
    }));
  }
}
