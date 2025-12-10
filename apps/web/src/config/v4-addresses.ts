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
        traderVault: '0x9b9148e635d61f6771f66079c2d666c83a4b189b',
        feeController: '0x6184906a66e731b19dbb9634c16c10b3a168987e',
    },
} as const

export const V4_MARKETS = [
    {
        id: 'market1',
        name: 'UN Confirms Alien Life',
        description: 'Will the United Nations officially confirm the existence of extraterrestrial life?',
        address: '0x1c95b682b7c2589e9c16b8ee8742e359276ccab3',
        outcomeToken: '0xfebe82ccacc60f702a045a273b455b4d4ccc119b',
        bParam: '10000000000000000000000', // 10000 * 1e18
        initialQYes: '0',
        initialQNo: '0',
        status: 'live' as const,
    },
    {
        id: 'market2',
        name: 'BTC >= $100k',
        description: "Will Bitcoin's 7-day time-weighted average price reach or exceed $100,000?",
        address: '0xa4dc5b625fec5f39242f0f16d6d56d5fa847f6c8',
        outcomeToken: '0xabebdca7e7197296c7b7fa7344a4c05f1784f03d',
        bParam: '15000000000000000000000', // 15000 * 1e18
        initialQYes: '0',
        initialQNo: '0',
        status: 'live' as const,
    }
] as const

export type V4Address = typeof V4_ADDRESSES.baseSepolia
export type V4Market = typeof V4_MARKETS[number]
