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
      MockUSDC: '0xc7587d8393bf43d778267c40706a533ca1299e21',
      ProtocolConfig: '0x4dedced068424cab5def4e5fd0b3ce7bf5671d8d',
      Collateralizer: '0xfb757cec1ff68cbef2124172a03d92090602576c',
      AMMEngine: '0x5d2bfce963bd7e002213522a22e3615d454708b3',
      SoothBook: '0x6c3ad4d5a800b87acdfe5ba82972feb23acab011',
      LaunchpadEngine: '0x69a831d48d1c46ab0919d0c19cf47a2fdc842ee3',
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
