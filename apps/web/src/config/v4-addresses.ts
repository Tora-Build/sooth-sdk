// V4 Contract Addresses - Base Sepolia
// Deployed: 2025-12-10 (Continuous LMSR - no ticks)

export const V4_ADDRESSES = {
    baseSepolia: {
        chainId: 84532,
        // Phase 0: Utilities
        usdc: '0x3c96e42e5dc8e28a0eb94f3f2ff0ece8c4593139',        // MockUSDC
        newUsdc: '0x3c96e42e5dc8e28a0eb94f3f2ff0ece8c4593139',    // Same for new deployment

        // Phase 1: Infrastructure
        governorVault: '0x2384b0ce7d1af975865c230f1f51addb718a828a',
        traderVault: '0x547bc4ca02cf67b4cea44bcf969fffab72f4e6b5',
        feeController: '0x6184906a66e731b19dbb9634c16c10b3a168987e',
    },
} as const

export const V4_MARKETS = [
    {
        id: '1',
        name: 'Trump Wins 2024 US Election',
        address: '0xf04e9231ebb0ff375553af550147993288e7eb5c',
        outcomeToken: '0x5245f2dc2cbc1aea6d0b74af28439ec817b86071',
        bParam: '10000000000000000000000', // 10000 * 1e18
        initialQYes: '0',
        initialQNo: '0',
        description: 'Will Trump win the 2024 US Election?',
        image: '/images/trump.png',
        category: 'Politics',
        status: 'live' as const,
    },
    {
        id: '2',
        name: 'BTC 7-day TWAP > $100k',
        address: '0x7ade00da0c0a078cfddf011b25e444457a276c9f',
        outcomeToken: '0xc7b84a8d578a48a697d02dba7265f1eb6c4b6383',
        bParam: '15000000000000000000000', // 15000 * 1e18
        initialQYes: '0',
        initialQNo: '0',
        description: 'Will BTC 7-day TWAP stay above $100k?',
        image: '/images/btc.png',
        category: 'Crypto',
        status: 'live' as const,
    }
] as const

export type V4Address = typeof V4_ADDRESSES.baseSepolia
export type V4Market = typeof V4_MARKETS[number]
