/// <reference types="node" />
/**
 * Actor Management System
 * Handles multiple test wallets for multi-user simulation
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type WalletClient,
  type Account,
  type Chain,
  type Transport,
  type TransactionReceipt,
  type Hash,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';
import { shortAddress, error, success, info } from './cli-utils';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type ActorRole = 'creator' | 'amm' | 'trader' | 'adjudicator' | 'keeper' | 'admin';

export interface Actor {
  name: string;
  account: Account;
  role: ActorRole;
  walletClient: WalletClient<Transport, Chain, Account>;
}

export interface ActorConfig {
  name: string;
  envKey: string;
  role: ActorRole;
}

export interface ActorManagerOptions {
  confirmations?: number;
  postTxWaitMs?: number;
  realtimeApi?: boolean;
}

const MEGAETH_CHAIN_IDS = new Set([4326, 6343]);

function isMegaethChain(chainId: number): boolean {
  return MEGAETH_CHAIN_IDS.has(chainId);
}

const MEGAETH_NATIVE_RPC: Record<number, string> = {
  4326: 'https://mainnet.megaeth.com/rpc',
  6343: 'https://carrot.megaeth.com/rpc',
};

function getMegaethNativeRpcUrl(chainId: number): string | undefined {
  return MEGAETH_NATIVE_RPC[chainId];
}

/**
 * Load actor configs from actors.yaml (cwd, then fallback locations).
 * Returns empty array if no file found.
 */
function loadActorConfigs(): ActorConfig[] {
  const candidates = [
    path.join(process.cwd(), 'actors.yaml'),
    path.join(process.cwd(), '..', 'actors.yaml'),
    path.join(process.cwd(), '..', '..', 'actors.yaml'),
    path.join(__dirname, '..', '..', 'actors.yaml'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const raw = yaml.parse(fs.readFileSync(p, 'utf-8'));
      if (Array.isArray(raw?.actors)) {
        return raw.actors.map((a: any) => ({
          name: String(a.name),
          envKey: String(a.envKey),
          role: (a.role ?? 'trader') as ActorRole,
        }));
      }
    }
  }
  return [];
}

export class ActorManager {
  private actors: Map<string, Actor> = new Map();
  private currentActorName: string = '';
  private publicClient: PublicClient;
  private chain: Chain;
  private rpc: string;
  private confirmations: number;
  private postTxWaitMs: number;
  private realtimeApi: boolean;

  constructor(chain: Chain, rpc: string, options?: ActorManagerOptions) {
    this.chain = chain;
    this.rpc = rpc;
    this.confirmations = options?.confirmations ?? 1;
    this.postTxWaitMs = options?.postTxWaitMs ?? 0;
    this.realtimeApi = options?.realtimeApi ?? false;
    this.publicClient = createPublicClient({
      chain,
      transport: http(rpc),
    });
  }

  /** Whether MegaETH Realtime API mode is active */
  isRealtimeMode(): boolean {
    return this.realtimeApi && isMegaethChain(this.chain.id);
  }

  async waitForTransactionReceipt(hash: `0x${string}`) {
    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash,
      confirmations: this.confirmations,
    });

    // Check if transaction reverted
    if (receipt.status === 'reverted') {
      // Try to get revert reason by replaying the transaction
      let revertReason = '';
      try {
        const tx = await this.publicClient.getTransaction({ hash });
        if (tx) {
          try {
            await this.publicClient.call({
              to: tx.to!,
              data: tx.input,
              account: tx.from,
              blockNumber: receipt.blockNumber,
            });
          } catch (callErr: any) {
            // Extract revert reason from call error
            const errStr = callErr?.message || callErr?.toString() || '';
            const match =
              errStr.match(/reverted with.*?["']([^"']+)["']/i) ||
              errStr.match(/reason:\s*([^\n]+)/i) ||
              errStr.match(/execution reverted:\s*([^\n]+)/i);
            if (match) {
              revertReason = match[1];
            } else if (errStr.length < 200) {
              revertReason = errStr;
            }
          }
        }
      } catch {
        // Ignore errors getting revert reason
      }

      throw new Error(
        revertReason
          ? `Reverted: ${revertReason}`
          : `Transaction reverted: ${hash.slice(0, 18)}...`,
      );
    }

    if (this.postTxWaitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.postTxWaitMs));
    }

    return receipt;
  }

  /**
   * MegaETH Realtime API: send signed tx and get receipt in one call.
   * Uses `realtime_sendRawTransaction` — no polling needed.
   *
   * Routes the request directly to MegaETH's native RPC endpoint when the
   * active chain is MegaETH, bypassing the Sooth RPC proxy. The proxy
   * whitelists JSON-RPC methods and may not have `realtime_sendRawTransaction`
   * deployed yet — going native guarantees the call works as long as the
   * upstream MegaETH node honors the method.
   */
  async realtimeSendRawTransaction(signedTx: `0x${string}`): Promise<TransactionReceipt> {
    const nativeUrl = getMegaethNativeRpcUrl(this.chain.id);
    const targetUrl = nativeUrl ?? this.rpc;
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'realtime_sendRawTransaction',
        params: [signedTx],
      }),
    });
    const json = (await res.json()) as {
      result?: any;
      error?: { code: number; message: string };
    };
    if (json.error) {
      throw new Error(`realtime_sendRawTransaction: ${json.error.message}`);
    }
    const r = json.result;
    return {
      transactionHash: r.transactionHash as Hash,
      blockNumber: BigInt(r.blockNumber),
      from: r.from,
      to: r.to ?? null,
      gasUsed: BigInt(r.gasUsed),
      status: r.status === '0x1' ? 'success' : 'reverted',
      logs: r.logs ?? [],
      contractAddress: r.contractAddress ?? null,
      // Fill required TransactionReceipt fields with defaults
      blockHash: '0x' as Hash,
      transactionIndex: 0,
      logsBloom: '0x' as `0x${string}`,
      cumulativeGasUsed: BigInt(r.gasUsed),
      effectiveGasPrice: 0n,
      type: 'eip1559',
    } as TransactionReceipt;
  }

  /**
   * Write contract using MegaETH Realtime API when available.
   * Signs tx locally → realtime_sendRawTransaction → receipt in one call.
   * Skips eth_estimateGas (uses fixed gas) to minimize RPC round-trips.
   * Returns { receipt, sendMs, prepareMs } for benchmarking.
   */
  async writeContractRealtime(
    walletClient: WalletClient<Transport, Chain, Account>,
    request: Parameters<typeof walletClient.writeContract>[0],
  ): Promise<{
    receipt: TransactionReceipt;
    sendMs: number;
    prepareMs: number;
  }> {
    const prepareStart = performance.now();

    // Encode calldata locally (no RPC call)
    const { encodeFunctionData } = await import('viem');
    const data = encodeFunctionData({
      abi: request.abi,
      functionName: request.functionName as string,
      args: (request as any).args,
    });

    // Get nonce — single lightweight RPC call
    const nonce = await this.publicClient.getTransactionCount({
      address: walletClient.account.address,
      blockTag: 'pending',
    });

    // Sign locally with fixed gas (skip eth_estimateGas round-trip)
    // SoothBook crossing orders can use ~750k gas, so use 1.5M for safety
    const signedTx = await walletClient.account.signTransaction({
      to: request.address,
      data,
      nonce,
      gas: 1_500_000n,
      maxFeePerGas: 1_500_000n,
      maxPriorityFeePerGas: 0n,
      chainId: this.chain.id,
      type: 'eip1559' as const,
    } as any);

    const prepareMs = Number((performance.now() - prepareStart).toFixed(1));

    // Single RPC call: send + receipt
    const start = performance.now();
    const receipt = await this.realtimeSendRawTransaction(signedTx);
    const sendMs = Number((performance.now() - start).toFixed(1));

    if (receipt.status === 'reverted') {
      throw new Error(`Transaction reverted: ${receipt.transactionHash.slice(0, 18)}...`);
    }

    if (this.postTxWaitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.postTxWaitMs));
    }

    return { receipt, sendMs, prepareMs };
  }

  /**
   * Load actors from environment variables
   */
  loadFromEnv(envPath?: string): void {
    // Try multiple .env locations
    const possiblePaths = [
      envPath,
      path.join(process.cwd(), '.env'),
      path.join(process.cwd(), '..', '.env'),
      path.join(process.cwd(), '..', '..', '.env'),
      path.join(__dirname, '..', '..', '.env'),
      path.join(__dirname, '..', '..', '..', '.env'),
      path.join(__dirname, '..', '..', '..', '..', '.env'),
    ].filter(Boolean) as string[];

    for (const envFile of possiblePaths) {
      if (fs.existsSync(envFile)) {
        const envContent = fs.readFileSync(envFile, 'utf-8');
        for (const line of envContent.split('\n')) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const eqIndex = trimmed.indexOf('=');
            if (eqIndex > 0) {
              const key = trimmed.slice(0, eqIndex);
              const value = trimmed.slice(eqIndex + 1);
              if (!process.env[key]) {
                process.env[key] = value;
              }
            }
          }
        }
        break;
      }
    }

    // Load actor configs from actors.yaml
    const configs = loadActorConfigs();
    if (configs.length === 0) {
      // No actors.yaml — fall back to PRIVATE_KEY only
      const pk = process.env.PRIVATE_KEY;
      if (pk) this.addActor('default', pk, 'admin');
    } else {
      for (const cfg of configs) {
        const privateKey = process.env[cfg.envKey];
        if (privateKey) {
          this.addActor(cfg.name, privateKey, cfg.role);
        }
      }
    }

    if (this.actors.size > 0) {
      this.currentActorName = this.actors.keys().next().value!;
    }
  }

  /**
   * Add an actor manually
   */
  addActor(name: string, privateKey: string, role: ActorRole = 'amm'): void {
    // Ensure private key has 0x prefix
    const key = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;

    try {
      const account = privateKeyToAccount(key as `0x${string}`);
      const walletClient = createWalletClient({
        chain: this.chain,
        transport: http(this.rpc),
        account,
      });

      this.actors.set(name.toLowerCase(), {
        name: name.toLowerCase(),
        account,
        role,
        walletClient,
      });
    } catch (err) {
      console.error(error(`Failed to add actor ${name}: ${(err as Error).message}`));
    }
  }

  /**
   * Switch to a different actor
   */
  switchActor(name: string): Actor | null {
    const actor = this.actors.get(name.toLowerCase());
    if (!actor) {
      return null;
    }
    this.currentActorName = name.toLowerCase();
    return actor;
  }

  /**
   * Get current active actor
   */
  currentActor(): Actor | null {
    return this.actors.get(this.currentActorName) || null;
  }

  /**
   * Get actor by name
   */
  getActor(name: string): Actor | null {
    return this.actors.get(name.toLowerCase()) || null;
  }

  /**
   * Update RPC endpoint for all clients
   */
  setRpc(rpc: string): void {
    this.rpc = rpc;
    this.publicClient = createPublicClient({
      chain: this.chain,
      transport: http(rpc),
    });
    // Rebuild wallet clients with new RPC
    for (const [name, actor] of this.actors) {
      this.actors.set(name, {
        ...actor,
        walletClient: createWalletClient({
          chain: this.chain,
          transport: http(rpc),
          account: actor.account,
        }),
      });
    }
  }

  /**
   * Get public client (shared across all actors)
   */
  getPublicClient(): PublicClient {
    return this.publicClient;
  }

  /**
   * List all available actors
   */
  listActors(): Actor[] {
    return Array.from(this.actors.values());
  }

  /**
   * Get current actor's wallet client
   */
  currentWalletClient(): WalletClient<Transport, Chain, Account> | null {
    const actor = this.currentActor();
    return actor?.walletClient || null;
  }

  /**
   * Get current actor's address
   */
  currentAddress(): `0x${string}` | null {
    const actor = this.currentActor();
    return actor?.account.address || null;
  }

  /**
   * Print actor status
   */
  printStatus(): void {
    console.log('\nAvailable Actors:');
    console.log('─'.repeat(50));

    for (const actor of this.actors.values()) {
      const isCurrent = actor.name === this.currentActorName;
      const marker = isCurrent ? success('→') : ' ';
      const name = isCurrent ? success(actor.name.padEnd(10)) : actor.name.padEnd(10);
      const addr = shortAddress(actor.account.address);
      const roleStr = info(actor.role.padEnd(12));

      console.log(`${marker} ${name} ${addr}  ${roleStr}`);
    }
    console.log('');
  }

  /**
   * Check if any actors are loaded
   */
  hasActors(): boolean {
    return this.actors.size > 0;
  }
}

/**
 * Create and initialize actor manager
 */
export function createActorManager(
  chain: Chain,
  rpc: string,
  envPath?: string,
  options?: ActorManagerOptions,
): ActorManager {
  const manager = new ActorManager(chain, rpc, options);
  manager.loadFromEnv(envPath);
  return manager;
}
