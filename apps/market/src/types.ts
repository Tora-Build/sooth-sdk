export interface LaunchpadMarket {
  address: string;
  chainId: number;
  network?: string; // 'Base Sepolia' | 'Monad Testnet'
  creator: string;
  isGraduated: boolean;
  isDismissed?: boolean;
  deposit: string;
  isSettled: boolean;
  isFinalized: boolean;
  createdAt?: string | number;
  yesProbability?: number;
  yesReserves?: string;
  noReserves?: string;
  question?: string;
  name?: string;
  marketKey?: string;
}

// Only statuses shown in UI (bonding is filtered out before display)
export type MarketStatus = 'live' | 'settled' | 'finalized' | 'dismissed';

export function getMarketStatus(market: LaunchpadMarket): MarketStatus {
  if (market.isDismissed) return 'dismissed';
  if (market.isFinalized) return 'finalized';
  if (market.isSettled) return 'settled';
  return 'live';
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
