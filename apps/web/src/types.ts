export type MarketStatus = 'trading' | 'cooldown' | 'settling' | 'clearing' | 'settled' | 'paused';

export type AdjudicatorKind = string;

export interface MarketConfig {
  id: string;
  id_numeric?: number;
  chainId?: number;
  name: string;
  question: string;
  adjudicatorKind: string;
  adjudicatorLabel?: string;
  openEnded: boolean;
  contractAddress: string;
  adjudicatorId: string;
  eventId: string;
  initialStatus?: MarketStatus;
  initialYes?: number;
  mode: 'real' | 'demo';
}

export interface Market {
  id: string;
  id_numeric?: number;
  chainId?: number; // Chain ID for real markets
  name: string;
  question: string;
  adjudicatorKind: string;
  adjudicatorLabel: string;
  openEnded: boolean;
  contractAddress: string;
  adjudicatorId: string;
  eventId: string;
  initialStatus?: MarketStatus;
  initialYes?: number;
  status: MarketStatus;
  
  // Pricing (LMSR)
  priceYes: number;
  priceNo: number;
  qYes: bigint;
  qNo: bigint;
  bParam: bigint;
  
  // Risk Management
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  
  // User Position
  userYesShares: number;
  userNoShares: number;
  userAvgEntryYes: number | null;
  userAvgEntryNo: number | null;
  
  // Settlement
  winningOutcome?: 'YES' | 'NO';
  adjudicatorProofUploaded?: boolean;
  
  // Demo Mode Only
  virtualYesStake?: number;
  virtualNoStake?: number;
  mode: 'real' | 'demo';
}

export interface PoolConfig {
  id: string;
  label: string;
  token: string;
  adjudicatorKind: string;
  mode: 'real' | 'demo';
}

export interface Pool {
  id: string;
  label: string;
  token: string;
  adjudicatorKind: string;
  tvl: number;
  locked: number;
  userLpBalance: number;
  apy: number;
  mode: 'real' | 'demo';
}

export interface ProtocolConfig {
  name: string;
  version: string;
}

export interface TradeQuote {
  price: number;
  priceImpact: number;
  fee: number;
  totalCost: number;
  minReceived?: number; // For sells
}

