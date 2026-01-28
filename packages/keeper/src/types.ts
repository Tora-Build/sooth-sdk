import type { Address } from 'viem';

export interface RangeOrder {
  orderId: bigint;
  owner: Address;
  outcome: number;
  tickLower: number;
  tickUpper: number;
  active: boolean;
  liquidityRemoved: boolean;
  sharesTotal: bigint;
  liquidity: bigint;
  collateralDepositedWad: bigint;
  filledShares: bigint;
  collateralUsedWad: bigint;
}

export interface SpotSellOrder {
  sellId: bigint;
  owner: Address;
  outcome: number;
  tickLower: number;
  tickUpper: number;
  active: boolean;
  sharesTotal: bigint;
  filledShares: bigint;
  proceedsClaimedWad: bigint;
}

export interface ArbitrageOpportunity {
  buyOrder: RangeOrder;
  sellSource: SpotSellOrder;
  buyPrice: number;
  sellPrice: number;
  spread: number;
  maxShares: bigint;
  estimatedProfitWad: bigint;
}

export interface MarketInfo {
  marketKey: `0x${string}`;
  truthMarket: Address;
  yesToken: Address;
  noToken: Address;
  isActive: boolean;
}

export interface KeeperStats {
  totalOpportunitiesFound: number;
  totalArbitragesExecuted: number;
  totalProfitWad: bigint;
  lastScanTime: Date;
}
