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
}

export interface SoothNode {
  id: string;
  chainId: number;
  coreVersion: string;
  contracts: SoothContracts;
  deployedAt: string;
  deployedBy: Address;
  startBlock?: number;
  indexed?: boolean;
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
  updatedAt: string;
  nodes: SoothNode[];
  chains: Record<string, ChainMeta>;
}
