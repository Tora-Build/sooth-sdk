export type Address = `0x${string}`;

export interface SoothContracts {
  launchpadEngine: Address;
  soothBook: Address;
  ammEngine: Address;
  collateralizer: Address;
  usdc: Address;
  protocolConfig: Address;
}

export interface SoothNode {
  id: string;
  chainId: number;
  contracts: SoothContracts;
  deployedAt: string;
  deployedBy: Address;
  startBlock: number;
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
