// V4.6 Contract Addresses - Base Sepolia
// Deployed: 2025-12-12 (Lock-on-Sell)

export const V4_ADDRESSES = {
    baseSepolia: {
        chainId: 84532,
        // Phase 1: Infrastructure (V4.6 Lock-on-Sell)
        usdc: '0x53d34066A316AE1699d434753B70593A6D59Fec1',
        newUsdc: '0x53d34066A316AE1699d434753B70593A6D59Fec1',
        governorVault: '0x2A2DfA1B3B3F4db798b759d07064Bb800BD10fB1',
        traderVault: '0xa8aDE73124B3256F98f510F6A9E7C1e3Aa71d20B',
        feeController: '0x1a646107e7E88aa01Fadff3145Af08156679198e',
    },
} as const

export const V4_MARKETS = [
    {
        id: '1',
        name: 'UN Confirms Alien Life',
        address: '0x107aF8183a2761dcaA28ac89b85e09A3b63d7C31',
        outcomeToken: '0xc893D7b4A3b86Edc5C40F3F552d6D2180Dbb3214',
        bParam: '10000000000000000000000', // 10000 * 1e18
        initialQYes: '0',
        initialQNo: '0',
        description: 'Will the UN officially confirm extraterrestrial life?',
        image: '/images/alien.png',
        category: 'Science',
        status: 'live' as const,
    },
    {
        id: '2',
        name: 'BTC 7-day TWAP >= $100k',
        address: '0xf7696D23edd93B81386323175fF8c9aCe5441333',
        outcomeToken: '0x6c3A38D04F14bdd955ad2E2992B47947CEDd2886',
        bParam: '15000000000000000000000', // 15000 * 1e18
        initialQYes: '0',
        initialQNo: '0',
        description: 'Will BTC 7-day TWAP reach or exceed $100k?',
        image: '/images/btc.png',
        category: 'Crypto',
        status: 'live' as const,
    }
] as const

export type V4Address = typeof V4_ADDRESSES.baseSepolia
export type V4Market = typeof V4_MARKETS[number]
