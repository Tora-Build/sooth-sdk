import type { Address, Hash } from 'viem';

export const WAD = 10n ** 18n;
export const MAX_UINT256 = 2n ** 256n - 1n;

export type OutputLineType = 'info' | 'success' | 'error' | 'warn' | 'dim' | 'bold' | 'plain';

export interface OutputLine {
  type: OutputLineType;
  text: string;
}

export type OutputCallback = (lines: OutputLine[]) => void;

export interface CommandResult {
  success: boolean;
  message?: string;
  data?: unknown;
  txHash?: Hash;
}

export type OrderType = 'limit' | 'market' | 'range';

export interface OrderResult {
  orderId: bigint;
  filledShares: bigint;
  filledCost: bigint;
  restingShares: bigint;
  outcome: number;
  tickLower: number;
  tickUpper: number;
  shares: bigint;
  orderType: OrderType;
  gasUsed?: bigint;
}

export interface Order {
  owner: Address;
  outcome: number;
  tickLower: number;
  tickUpper: number;
  sharesTotal: bigint;
  filledShares: bigint;
  fillAccumulator: bigint;
  collateralDepositedWad: bigint;
  active: boolean;
  liquidityRemoved: boolean;
}

export interface SpotSellOrder {
  seller: Address;
  outcome: number;
  tickLower: number;
  tickUpper: number;
  sharesTotal: bigint;
  sharesFilled: bigint;
  proceedsCollected: bigint;
  active: boolean;
}

export interface MarketState {
  tick: number;
  liqNo: bigint;
  liqYes: bigint;
  prob: bigint;
}

export interface MarketInfo {
  truthMarket: Address;
  yesToken: Address;
  noToken: Address;
}

export interface Balances {
  walletUsdc: bigint;
  vaultAvailable: bigint;
  vaultReserved: bigint;
}

export interface InternalOutcomes {
  yesShares: bigint;
  noShares: bigint;
}

export interface RecordingState {
  active: boolean;
  commands: RecordedCommand[];
  startTime: number;
}

export interface RecordedCommand {
  actor: string;
  command: string;
  args: string[];
  timestamp: number;
}

export interface ScenarioStep {
  actor: string;
  action: string;
  args?: Record<string, unknown>;
  expect?: Record<string, unknown>;
}

export interface Scenario {
  name: string;
  description: string;
  steps: ScenarioStep[];
  assertions?: string[];
}
