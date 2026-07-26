/**
 * Registry — node/chain lookups over the Sooth registry.
 *
 * Thin wrapper around `registry-loader.loadManifest`, which owns the real
 * resolution policy: injected manifest → HTTP (2s timeout) → embedded snapshot,
 * and never rejects. This class exists only to bind a `registryUrl` and expose
 * ergonomic lookups; it deliberately holds no manifest cache of its own so two
 * clients on different URLs can't read each other's data.
 */

import { loadManifest } from './registry-loader.js';
import type { SoothNode, ChainMeta, NodesManifest } from './registry-types.js';

export type {
  SoothNode,
  SoothContracts,
  ChainMeta,
  NodesManifest,
  Address,
} from './registry-types.js';

export class Registry {
  private url?: string;

  constructor(registryUrl?: string) {
    this.url = registryUrl;
  }

  private manifest(): Promise<NodesManifest> {
    return loadManifest(this.url ? { registryUrl: this.url } : undefined);
  }

  async getManifest(): Promise<NodesManifest> {
    return this.manifest();
  }

  async getNode(id: string): Promise<SoothNode | undefined> {
    return (await this.manifest()).nodes.find((n) => n.id === id);
  }

  async getNodeByChainId(chainId: number): Promise<SoothNode | undefined> {
    return (await this.manifest()).nodes.find((n) => n.chainId === chainId);
  }

  async getAllNodes(): Promise<SoothNode[]> {
    return (await this.manifest()).nodes;
  }

  async getChain(chainId: number): Promise<ChainMeta | undefined> {
    return (await this.manifest()).chains[String(chainId)];
  }

  async getAllChains(): Promise<Record<string, ChainMeta>> {
    return (await this.manifest()).chains;
  }

  async listNodes(): Promise<
    Array<{ id: string; chainId: number; chainName: string; indexed: boolean }>
  > {
    const manifest = await this.manifest();
    return manifest.nodes.map((n) => ({
      id: n.id,
      chainId: n.chainId,
      chainName: manifest.chains[String(n.chainId)]?.name ?? `Chain ${n.chainId}`,
      indexed: n.indexed !== false,
    }));
  }
}
