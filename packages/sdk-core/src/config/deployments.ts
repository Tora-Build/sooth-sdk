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
      MockUSDC: '0x51073241ff403cd900008569714e0c9605f65a79',
      ProtocolConfig: '0xd19842d2cbcb6146460e6639db1571787620583f',
      Collateralizer: '0x956e8ad7b35c5270fc737ceddfcd7d894a1e5574',
      AMMEngine: '0x1d736e5008b775948e0cbd06bbf0074d48a9803a',
      SoothBook: '0x0eb179c7e79e62bac3ee40d379425e32cb00d22b',
      LaunchpadEngine: '0xf00fb446d1262d1f4100e6d899cf0c8c298a6e61',
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
