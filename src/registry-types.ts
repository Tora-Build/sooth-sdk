export type Address = `0x${string}`;

export interface SoothContracts {
  launchpadEngine: Address;
  soothBook: Address;
  ammEngine: Address;
  orderEngine: Address;
  truthMarket: Address;
  /** Single-token fee router. Present on core <= 0.3 nodes only; core 0.4+
   *  replaced it with the two-token FeeVault and the two are NOT interchangeable
   *  (different ABI, different accounting model, different claim surface). */
  feeRouter?: Address;
  /** Two-token fee custody + accounting (core 0.4+). Never an alias for
   *  feeRouter: a node has one or the other, never both. */
  feeVault?: Address;
  adjudicatorRegistry: Address;
  /** AMM / launchpad venue collateral. On a dual-token node this is the
   *  instance token (e.g. EAST); on a single-token node both venues use it. */
  baseToken: Address;
  baseTokenDecimals?: number;
  /** OrderEngine / SoothBook venue collateral on a dual-token node (e.g. WRMB).
   *  Absent means the book settles in `baseToken`. */
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
