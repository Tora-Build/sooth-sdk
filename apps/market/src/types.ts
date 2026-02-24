export interface LaunchpadMarket {
  address: string;
  chainId: number;
  creator: string;
  isGraduated: boolean;
  deposit: string;
  isSettled: boolean;
  isFinalized: boolean;
  yesProbability?: number;
  yesReserves?: string;
  noReserves?: string;
  question?: string;
  marketKey?: string;
}

export type MarketStatus = 'trading' | 'settled' | 'finalized';

export function getMarketStatus(market: LaunchpadMarket): MarketStatus {
  if (market.isFinalized) return 'finalized';
  if (market.isSettled) return 'settled';
  return 'trading';
}

export interface Order {
  side: 0 | 1;
  tick: number;
  amount: bigint;
  maker: string;
}

export interface Fill {
  side: 0 | 1;
  tick: number;
  amount: bigint;
  taker: string;
  txHash?: string;
  timestamp?: number;
}
