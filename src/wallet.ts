/**
 * Wallet — balance, approve, mint operations
 */

import { formatUnits, parseUnits, maxUint256 } from 'viem';
import type { SoothClient } from './client';

const ERC20Abi = [
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ type: 'address', name: 'account' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'decimals',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    name: 'allowance',
    type: 'function',
    inputs: [
      { type: 'address', name: 'owner' },
      { type: 'address', name: 'spender' },
    ],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'approve',
    type: 'function',
    inputs: [
      { type: 'address', name: 'spender' },
      { type: 'uint256', name: 'amount' },
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    name: 'mint',
    type: 'function',
    inputs: [
      { type: 'address', name: 'to' },
      { type: 'uint256', name: 'amount' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

export class Wallet {
  private client: SoothClient;

  constructor(client: SoothClient) {
    this.client = client;
  }

  /** Get USDC balance (raw bigint) */
  async getBalance(address: `0x${string}`): Promise<bigint> {
    return (await this.client.publicClient.readContract({
      address: this.client.contracts.baseToken,
      abi: ERC20Abi,
      functionName: 'balanceOf',
      args: [address],
    })) as bigint;
  }

  /** Get formatted USDC balance */
  async getFormattedBalance(address: `0x${string}`): Promise<string> {
    const balance = await this.getBalance(address);
    const decimals = await this.getDecimals();
    return formatUnits(balance, decimals);
  }

  /** Get USDC decimals */
  async getDecimals(): Promise<number> {
    const result = await this.client.publicClient.readContract({
      address: this.client.contracts.baseToken,
      abi: ERC20Abi,
      functionName: 'decimals',
    });
    return Number(result);
  }

  /** Get allowance */
  async getAllowance(
    owner: `0x${string}`,
    spender: `0x${string}`,
  ): Promise<bigint> {
    return (await this.client.publicClient.readContract({
      address: this.client.contracts.baseToken,
      abi: ERC20Abi,
      functionName: 'allowance',
      args: [owner, spender],
    })) as bigint;
  }

  /** Approve USDC for a spender (default: max approval) */
  async approve(
    spender: `0x${string}`,
    amount?: bigint,
  ): Promise<`0x${string}`> {
    return this.client.writeContract({
      address: this.client.contracts.baseToken,
      abi: ERC20Abi,
      functionName: 'approve',
      args: [spender, amount ?? maxUint256],
    });
  }

  /** Approve USDC for LaunchpadEngine */
  async approveLaunchpad(amount?: bigint): Promise<`0x${string}`> {
    return this.approve(this.client.contracts.launchpadEngine, amount);
  }

  /** Approve USDC for SoothBook */
  async approveSoothBook(amount?: bigint): Promise<`0x${string}`> {
    return this.approve(this.client.contracts.soothBook, amount);
  }

  /** Approve USDC for all contracts */
  async approveAll(): Promise<`0x${string}`[]> {
    const hashes = await Promise.all([
      this.approveLaunchpad(),
      this.approveSoothBook(),
    ]);
    return hashes;
  }

  /** Mint MockUSDC (testnet only) */
  async mint(to: `0x${string}`, amount: string): Promise<`0x${string}`> {
    const decimals = await this.getDecimals();
    return this.client.writeContract({
      address: this.client.contracts.baseToken,
      abi: ERC20Abi,
      functionName: 'mint',
      args: [to, parseUnits(amount, decimals)],
    });
  }

  /** Get native token balance (ETH/GRASS/MON) */
  async getNativeBalance(address: `0x${string}`): Promise<bigint> {
    return this.client.publicClient.getBalance({ address });
  }
}
