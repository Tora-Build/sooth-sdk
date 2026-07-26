/**
 * SoothClient — main SDK entry point
 *
 * Usage:
 *   const client = await SoothClient.create('a7f3b2e1', { privateKey: '0x...' })
 *   const markets = await client.markets.list()
 */

import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type Abi,
  type Chain,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { Registry } from './registry';
import { Markets } from './market';
import { Orderbook } from './orderbook';
import { Wallet } from './wallet';
import type { SoothClientOptions } from './types';
import type { SoothNode, ChainMeta } from './registry-types';

function toViemChain(meta: ChainMeta, chainId: number, rpcUrls: string[]): Chain {
  return defineChain({
    id: chainId,
    name: meta.name,
    nativeCurrency: meta.nativeCurrency,
    rpcUrls: { default: { http: rpcUrls } },
    blockExplorers: {
      default: { name: meta.explorer.name, url: meta.explorer.url },
    },
    testnet: meta.testnet,
  });
}

export class SoothClient {
  readonly nodeId: string;
  readonly node: SoothNode;
  readonly chainInfo: ChainMeta;
  readonly chain: Chain;
  readonly publicClient: PublicClient;
  readonly walletClient: WalletClient | null;
  readonly account: `0x${string}` | null;
  readonly registry: Registry;
  readonly markets: Markets;
  readonly orderbook: Orderbook;
  readonly wallet: Wallet;

  private constructor(
    nodeId: string,
    node: SoothNode,
    chainInfo: ChainMeta,
    chain: Chain,
    publicClient: PublicClient,
    walletClient: WalletClient | null,
    account: `0x${string}` | null,
    registry: Registry,
  ) {
    this.nodeId = nodeId;
    this.node = node;
    this.chainInfo = chainInfo;
    this.chain = chain;
    this.publicClient = publicClient;
    this.walletClient = walletClient;
    this.account = account;
    this.registry = registry;
    this.markets = new Markets(this);
    this.orderbook = new Orderbook(this);
    this.wallet = new Wallet(this);
  }

  /**
   * Create a SoothClient connected to a specific node.
   *
   * @param nodeId - 8-char hex node ID from the registry
   * @param options - private key, RPC override, registry URL override
   */
  static async create(nodeId: string, options: SoothClientOptions = {}): Promise<SoothClient> {
    const registry = new Registry(options.registryUrl);

    const node = await registry.getNode(nodeId);
    if (!node) {
      const nodes = await registry.listNodes();
      const list = nodes.map((n) => `  ${n.id}  ${n.chainName}`).join('\n');
      throw new Error(`Node not found: "${nodeId}"\n\nAvailable nodes:\n${list}`);
    }

    const chainInfo = await registry.getChain(node.chainId);
    if (!chainInfo) {
      throw new Error(`Chain metadata not found for chainId ${node.chainId}`);
    }

    const rpcUrl = options.rpcUrl ?? chainInfo.rpcUrls[0];
    const chain = toViemChain(chainInfo, node.chainId, [rpcUrl]);

    const publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl),
    });

    let walletClient: WalletClient | null = null;
    let account: `0x${string}` | null = null;

    if (options.privateKey) {
      const acct = privateKeyToAccount(options.privateKey);
      account = acct.address;
      walletClient = createWalletClient({
        account: acct,
        chain,
        transport: http(rpcUrl),
      });
    }

    return new SoothClient(
      nodeId,
      node,
      chainInfo,
      chain,
      publicClient as PublicClient,
      walletClient,
      account,
      registry,
    );
  }

  /** Shorthand for contracts */
  get contracts() {
    return this.node.contracts;
  }

  /** Require wallet for write operations */
  requireWallet(): WalletClient {
    if (!this.walletClient) {
      throw new Error(
        'Write operations require a private key. Pass { privateKey } to SoothClient.create().',
      );
    }
    return this.walletClient;
  }

  /** Write contract call with chain set */
  async writeContract(params: {
    address: `0x${string}`;
    abi: Abi;
    functionName: string;
    args?: readonly unknown[];
  }): Promise<`0x${string}`> {
    const walletClient = this.requireWallet();
    return walletClient.writeContract({
      ...params,
      account: this.account,
      chain: this.chain,
    } as Parameters<WalletClient['writeContract']>[0]);
  }
}
