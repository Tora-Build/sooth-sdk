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

  {
    id: 'monad-testnet-v12',
    chainId: 10143,
    chainName: 'Monad Testnet',
    soothBook: '0x94818c56b904371bf100acf723a7619dfc2c2ec0',
    usdc: '0x01843713106f85749335472ccb8b477804ac235f',
    collateralizer: '0xeb664daf2c4beb41b9f1f5ad1fb822730bb62b03',
    protocolConfig: '0xd02f94185e6561c48810cab151803c12919f7eea',
    ammEngine: '0x28b799febd74b92d8ff17745ad432bfa86799fc8',
    launchpadEngine: '0x6fd82b76045af934354a2033fde5cb64772ae615',
    explorer: 'https://testnet.monadvision.com',
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
