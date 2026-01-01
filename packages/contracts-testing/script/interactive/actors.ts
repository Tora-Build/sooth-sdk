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
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import * as fs from 'fs';
import * as path from 'path';
import { shortAddress, error, success, info } from './utils';

export type ActorRole = 'maker' | 'taker' | 'arbitrageur' | 'keeper' | 'admin';

export interface Actor {
  name: string;
  account: Account;
  role: ActorRole;
  walletClient: WalletClient;
}

export interface ActorConfig {
  name: string;
  envKey: string;
  role: ActorRole;
}

export interface ActorManagerOptions {
  confirmations?: number;
  postTxWaitMs?: number;
}

// Default actor configuration
const DEFAULT_ACTORS: ActorConfig[] = [
  { name: 'alice', envKey: 'PRIVATE_KEY_ALICE', role: 'maker' },
  { name: 'bob', envKey: 'PRIVATE_KEY_BOB', role: 'taker' },
  { name: 'charlie', envKey: 'PRIVATE_KEY_CHARLIE', role: 'arbitrageur' },
  { name: 'keeper', envKey: 'PRIVATE_KEY_KEEPER', role: 'keeper' },
  { name: 'admin', envKey: 'PRIVATE_KEY', role: 'admin' }, // Fallback to default PRIVATE_KEY
];

export class ActorManager {
  private actors: Map<string, Actor> = new Map();
  private currentActorName: string = '';
  private publicClient: PublicClient;
  private chain: Chain;
  private rpc: string;
  private confirmations: number;
  private postTxWaitMs: number;

  constructor(chain: Chain, rpc: string, options?: ActorManagerOptions) {
    this.chain = chain;
    this.rpc = rpc;
    this.confirmations = options?.confirmations ?? 1;
    this.postTxWaitMs = options?.postTxWaitMs ?? 0;
    this.publicClient = createPublicClient({
      chain,
      transport: http(rpc),
    });
  }

  async waitForTransactionReceipt(hash: `0x${string}`) {
    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash,
      confirmations: this.confirmations,
    });

    if (this.postTxWaitMs > 0) {
      await new Promise(resolve => setTimeout(resolve, this.postTxWaitMs));
    }

    return receipt;
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

    let envLoaded = false;
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
        envLoaded = true;
        break;
      }
    }

    // Load each actor from environment
    for (const config of DEFAULT_ACTORS) {
      const privateKey = process.env[config.envKey];
      if (privateKey) {
        this.addActor(config.name, privateKey, config.role);
      }
    }

    // If only PRIVATE_KEY is set, create aliases for common actor names
    // This allows "actor alice" to work even with a single key
    if (this.actors.size === 1 && this.actors.has('admin')) {
      const adminKey = process.env.PRIVATE_KEY!;
      this.addActor('alice', adminKey, 'maker');
      this.addActor('bob', adminKey, 'taker');
      this.addActor('charlie', adminKey, 'arbitrageur');
      // Set alice as default instead of admin for better UX
      this.currentActorName = 'alice';
    } else if (this.actors.size > 0) {
      // Set default actor (first available)
      this.currentActorName = this.actors.keys().next().value!;
    }
  }

  /**
   * Add an actor manually
   */
  addActor(name: string, privateKey: string, role: ActorRole = 'taker'): void {
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
  currentWalletClient(): WalletClient | null {
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
  options?: ActorManagerOptions
): ActorManager {
  const manager = new ActorManager(chain, rpc, options);
  manager.loadFromEnv(envPath);
  return manager;
}
