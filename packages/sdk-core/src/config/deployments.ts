export interface ChainDeployment {
  chainId: number;
  networkName: string;
  version: string;
  contracts: {
    LaunchpadEngine: string;
    AMMEngine: string;
    SoothBook?: string;
    Collateralizer: string;
    MockUSDC: string;
    ProtocolConfig?: string;
    [key: string]: string | undefined;
  };
}

const DEPLOYMENTS: Record<number, ChainDeployment> = {
  84532: {
    chainId: 84532,
    networkName: 'baseSepolia',
    version: 'V12.0',
    contracts: {
      MockUSDC: '0xe2025de4fbee78d0a3832ea02d070d791c42ed1e',
      ProtocolConfig: '0xaf2b599fedfda277f66525bf91ef6f49df6bddae',
      Collateralizer: '0x72b11e98d4050b5edaa9b069d1c6d7309a8c8f04',
      AMMEngine: '0xb7cf9d7e3357052238a9bbdc9aaaa63e1b1346f2',
      SoothBook: '0xa83b770de63349629ea1f92ad9b40285b1d47d74',
      LaunchpadEngine: '0xc5f6b53c74a5d14336e971459ee7cf936d401384',
    },
  },
  143: {
    chainId: 143,
    networkName: 'monadMainnet',
    version: 'V11.1',
    contracts: {
      MockUSDC: '0x3C06E44bD4d09328a4c374174b8e325c0C674b6E',
      ProtocolConfig: '0xbc7b155057Bb78BB8bF9c9F9Fa6bFCc931aEAF38',
      Collateralizer: '0x1aF3cB8B270Db3e71fC979543c32B87709EA191f',
      AMMEngine: '0x8629b9ca457F4088ec8346FAED61DA858FDB498d',
      LaunchpadEngine: '0xaa3Ffae62A8Af00d08Ac395e9551776b0A01E492',
      ValidatedAdjudicator: '0x4F0b73177dac5A7f5EA2dbCffd2b983B3719b39B',
    },
  },
};

export function getDeployment(chainId: number): ChainDeployment | undefined {
  return DEPLOYMENTS[chainId];
}

export function getSupportedChains(): number[] {
  return Object.keys(DEPLOYMENTS).map(Number);
}

export function getVersion(): string {
  return 'V12.0';
}
