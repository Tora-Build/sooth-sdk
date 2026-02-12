export interface ChainDeployment {
  chainId: number;
  networkName: string;
  version: string;
  contracts: {
    LaunchpadEngine: string;
    AMMEngine: string;
    TickBookPoolManager: string;
    TickBookVault: string;
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
    version: 'V11.1',
    contracts: {
      MockUSDC: '0xb4f46ed670ed6c4cf422ea61e06961d64a753e9d',
      ProtocolConfig: '0x4c76089b2ad28b2fc9c4d7a1c06eeb13d0336fc0',
      Collateralizer: '0x4deae2f0a39b84f57a28f07762e8b47085ed38de',
      AMMEngine: '0x1399d385d2861eb046d83ededb7f4ea3aaca2ef5',
      TickBookVault: '0x667c100f8f5667177fce0e9566ffe1403fc7c6f7',
      TickBookPoolManager: '0x61ddf4716a181658e2fa9efd98b93c634ac49cdd',
      LaunchpadEngine: '0x3cfa2113c919c916e8334d245b157de937e76836',
    },
  },
  10143: {
    chainId: 10143,
    networkName: 'monadTestnet',
    version: 'V11.1',
    contracts: {
      MockUSDC: '0x3b2f5a6e16cb5d5cf277f8718a9add3af0b1222a',
      ProtocolConfig: '0x6784f9b2e3a629c94cc05b441b6fdec4a6890830',
      Collateralizer: '0x57992a707c285971a22dffc3106118331b5e632f',
      AMMEngine: '0x67147bc54df45ce43cb88b735043c496047596a7',
      TickBookVault: '0x93c9ee74896f1f7854a35003d92c9e7b54c0f296',
      TickBookPoolManager: '0xcc8fbc38af3510c9b28941298b5bdd481a7698b4',
      LaunchpadEngine: '0x744724aa5b389644f31dfcfbb67786b581602084',
    },
  },
  6343: {
    chainId: 6343,
    networkName: 'megaethTestnet',
    version: 'V11.1',
    contracts: {
      MockUSDC: '0x57bda4319c306a68054f25017183030752f97d63',
      Collateralizer: '0xe928d0cf62a98f2e24e65978ae487f562749305a',
      AMMEngine: '0x61470420cc117e9460aae3bdc6cdf77c443ac09c',
      TickBookVault: '0x5b9a8b49d5616326bd61ac57b429cbf84e8cc756',
      TickBookPoolManager: '0xf52a8e9f5defcc6fe0e66b523d29ad7cfc3af530',
      LaunchpadEngine: '0xa2b2653124cb98b4d83a8a314e5e0bef2621832f',
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
      TickBookVault: '0x50293aD4e42593A8b081960c991c198729E81192',
      TickBookPoolManager: '0x12A38bc9E3bD2359265cE70451777eDe2fd875A3',
      LaunchpadEngine: '0xaa3Ffae62A8Af00d08Ac395e9551776b0A01E492',
      ValidatedAdjudicator: '0x4F0b73177dac5A7f5EA2dbCffd2b983B3719b39B',
    },
  },
  5042002: {
    chainId: 5042002,
    networkName: 'arcTestnet',
    version: 'V11.1',
    contracts: {
      MockUSDC: '0x805825e6af09178ea699a32a8d6cc5ca3637df80',
      Collateralizer: '0x0313af9c18e3c954f42b771a6d301fbbc6ad60a5',
      AMMEngine: '0x0f0dd0be87f6ab153e732039469fe64353b95dbb',
      TickBookVault: '0x1695ac9983f457e446d8f903d7c4061fbc7907f8',
      TickBookPoolManager: '0x8ba9751284d77ed59f46ea877577e6430bc30209',
      LaunchpadEngine: '0x625b4b2997232380126f0aecd84867086f89b27e',
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
  return 'V11.1';
}
