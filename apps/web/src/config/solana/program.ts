import { PublicKey } from '@solana/web3.js';

export const SOLANA_CONFIG = {
    devnet: {
        programId: new PublicKey('23pTwMDF5Y9FFjnaqr2411cXVN2qfYmvuHMmsaeHVPmG'),
        usdcMint: new PublicKey('CFpH3GfG5omFAPf44NnhUC2ivL35aL3dd2wqQrSJEmos'),
        traderVaultV2: new PublicKey('6Tw72bGYp7QXGiPQRfJgXsGbTjypN3sjizU8GPR17rfe'),
        governorVaultV2: new PublicKey('EyrUhv4Dfy7REq2Q3HmC3boSpC8WtRwmvwnVwx4s17E9'),
        rpcUrl: 'https://api.devnet.solana.com',
        cluster: 'devnet' as const,
    },
    // Mainnet configuration (to be added later)
    mainnet: {
        programId: new PublicKey('11111111111111111111111111111111'), // placeholder
        usdcMint: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'), // Real USDC on mainnet
        traderVaultV2: new PublicKey('11111111111111111111111111111111'), // placeholder
        governorVaultV2: new PublicKey('11111111111111111111111111111111'), // placeholder
        rpcUrl: 'https://api.mainnet-beta.solana.com',
        cluster: 'mainnet-beta' as const,
    },
} as const;

export type SolanaCluster = keyof typeof SOLANA_CONFIG;

export function getSolanaConfig(cluster: SolanaCluster = 'devnet') {
    return SOLANA_CONFIG[cluster];
}
