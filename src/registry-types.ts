export type Address = `0x${string}`;

export interface SoothContracts {
  launchpadEngine: Address;
  soothBook: Address;
  ammEngine: Address;
  orderEngine: Address;
  truthMarket: Address;
  /** Fee contract. On core <= 0.2.x this is the FeeRouter; on core >= 0.4.0
   *  the contract is FeeVault and this field carries the FeeVault address as a
   *  back-compat alias so existing consumers keep working. Prefer `feeVault`
   *  when present. */
  feeRouter: Address;
  adjudicatorRegistry: Address;
  /** AMM/instance-venue collateral (custodied by AMMEngine/LaunchpadEngine).
   *  Name kept from the single-token era. */
  baseToken: Address;
  baseTokenDecimals?: number;
  /** core >= 0.4.0: the FeeVault address (same value as `feeRouter`). */
  feeVault?: Address;
  /** core >= 0.4.0 dual-token nodes: book-venue collateral (custodied by
   *  OrderEngine/SoothBook). Absent means same-token: book == baseToken.
   *  Venues may differ in decimals (e.g. 18-dec EAST amm + 6-dec USDC book) —
   *  never assume bookTokenDecimals === baseTokenDecimals. */
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
