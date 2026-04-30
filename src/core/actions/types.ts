/**
 * Shared action context and event types.
 *
 * Actions are pure async functions that both the Node CLI and browser demo
 * can call. They take a viem PublicClient + WalletClient, a contracts map,
 * and an optional progress callback — no Spinner, no console.log, no
 * actorManager. The consumer (CLI or demo) wraps events into its own
 * output format.
 */

import type { Address, PublicClient, WalletClient } from 'viem';

export interface ActionContracts {
  MockUSDC: Address;
  LaunchpadEngine: Address;
  AMMEngine: Address;
  SoothBook?: Address;
  OrderEngine?: Address;
  FeeRouter?: Address;
  TruthMarket?: Address;
  AdjudicatorRegistry?: Address;
}

export interface ActionContext {
  chainId: number;
  publicClient: PublicClient;
  walletClient: WalletClient;
  address: Address;
  contracts: ActionContracts;
}

export type ActionEventType = 'info' | 'success' | 'warn' | 'error' | 'progress';

export interface ActionEvent {
  type: ActionEventType;
  message: string;
  data?: unknown;
}

export type ActionReporter = (event: ActionEvent) => void;

export const noopReporter: ActionReporter = () => {};
