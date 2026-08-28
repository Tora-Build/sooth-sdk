export type Address = `0x${string}`;

export interface SoothContracts {
  launchpadEngine: Address;
  soothBook: Address;
  ammEngine: Address;
  orderEngine: Address;
  truthMarket: Address;
  feeRouter: Address;
  adjudicatorRegistry: Address;
  baseToken: Address;
  baseTokenDecimals?: number;
  /** core >= 0.4.0: FeeVault address (feeRouter carries the same value). */
  feeVault?: Address;
  /** core >= 0.4.0 dual-token: book-venue collateral; absent = same-token. */
  bookToken?: Address;
  bookTokenDecimals?: number;
}

export interface SoothAdjudicators {
  /** Default contract adjudicator used by tools when the caller doesn't
   *  specify one. v0.1.2+ createMarket always calls configureMarket(), so
   *  this must be a deployed contract, not an EOA. */
  default?: Address;
  manual?: Address;
  zkTLS?: Address;
  optimistic?: Address;
}

export interface SoothNode {
  id: string;
  chainId: number;
  coreVersion: string;
  contracts: SoothContracts;
  adjudicators?: SoothAdjudicators;
  deployedAt: string;
  deployedBy: Address;
  startBlock?: number;
  indexed?: boolean;
  label?: string;
}

export interface ChainMeta {
  name: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrls: string[];
  explorer: { name: string; url: string };
  multicall3?: Address;
  testnet: boolean;
}

export interface NodesManifest {
  version: string;
  updatedAt: string;
  nodes: SoothNode[];
  chains: Record<string, ChainMeta>;
}
