export interface SoothInstance {
  id: string;
  chainId: number;
  chainName: string;
  soothBook: string;
  usdc: string;
  collateralizer: string;
  protocolConfig: string;
  ammEngine: string;
  launchpadEngine: string;
  rpc?: string;
  explorer: string;
}

export const INSTANCES: SoothInstance[] = [
  {
    id: 'base-sepolia-v12',
    chainId: 84532,
    chainName: 'Base Sepolia',
    soothBook: '0x0eb179c7e79e62bac3ee40d379425e32cb00d22b',
    usdc: '0x51073241ff403cd900008569714e0c9605f65a79',
    collateralizer: '0x956e8ad7b35c5270fc737ceddfcd7d894a1e5574',
    protocolConfig: '0xd19842d2cbcb6146460e6639db1571787620583f',
    ammEngine: '0x1d736e5008b775948e0cbd06bbf0074d48a9803a',
    launchpadEngine: '0xf00fb446d1262d1f4100e6d899cf0c8c298a6e61',
    explorer: 'https://sepolia.basescan.org',
  },
];

export function getInstanceByChainId(chainId: number): SoothInstance | undefined {
  return INSTANCES.find((instance) => instance.chainId === chainId);
}

export function getInstanceBySoothBook(address: string): SoothInstance | undefined {
  return INSTANCES.find(
    (instance) => instance.soothBook.toLowerCase() === address.toLowerCase(),
  );
}

export function getAllInstances(): SoothInstance[] {
  return INSTANCES;
}

export function getDeployment(chainId: number) {
  const instance = getInstanceByChainId(chainId);
  if (!instance) return undefined;

  return {
    MockUSDC: instance.usdc,
    ProtocolConfig: instance.protocolConfig,
    Collateralizer: instance.collateralizer,
    AMMEngine: instance.ammEngine,
    SoothBook: instance.soothBook,
    LaunchpadEngine: instance.launchpadEngine,
  };
}

export type DeploymentKey =
  | 'MockUSDC'
  | 'ProtocolConfig'
  | 'Collateralizer'
  | 'AMMEngine'
  | 'SoothBook'
  | 'LaunchpadEngine';
