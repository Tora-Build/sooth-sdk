export type MarketStatus = 'trading' | 'cooldown' | 'settling' | 'clearing' | 'settled' | 'paused';

export interface MarketsConfigJson {
  version: string;
  markets: MarketConfig[];
}

export type AdjudicatorKind = string;

export interface MarketConfig {
  id: string;
  id_numeric?: number;
  chainId?: number;
  version?: string;
  name: string;
  symbol?: string;
  description?: string;
  question: string;
  adjudicatorKind: string;
  adjudicatorLabel?: string;
  openEnded: boolean;
  contractAddress: string;
  outcomeTokenAddress?: string;
  yesToken?: string;
  noToken?: string;
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
  outcomeTokenAddress?: string; // V4 only
  adjudicatorId: string;
  eventId: string;
  initialStatus?: MarketStatus;
  initialYes?: number;
  status: MarketStatus;

  // Pricing (LMSR)
  priceYes: number | undefined;
  priceNo: number | undefined;
  qYes: bigint;
  qNo: bigint;
  bParam: bigint;

  // Risk Management
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';

  // User Position
  userYesShares: number; // Liquid in Vault (Orderbook Ready)
  userNoShares: number;  // Liquid in Vault (Orderbook Ready)
  
  // Wallet Position (ERC1155) - AMM Ready
  userYesWallet?: number;
  userNoWallet?: number;

  // Locked Shares (AMM legacy)
  userYesLocked?: number;
  userNoLocked?: number;
  unlockTime?: number;

  userYesOutcomeTokens: number; // Integer (ERC1155) - Legacy field
  userNoOutcomeTokens: number; // Integer (ERC1155) - Legacy field
  userAvgEntryYes: number | null;
  userAvgEntryNo: number | null;

  // Settlement
  winningOutcome?: 'YES' | 'NO';
  adjudicatorProofUploaded?: boolean;

  // Demo Mode Only
  virtualYesStake?: number;
  virtualNoStake?: number;
  mode: 'real' | 'demo';
  // V4 Dynamic Fee
  fee?: number; // Fee rate, e.g. 0.005 for 0.5%
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

