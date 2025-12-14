// V4 Contract Addresses - Base Sepolia
export const V4_ADDRESSES = {
    baseSepolia: {
        chainId: 84532,
        usdc: '0x53d34066A316AE1699d434753B70593A6D59Fec1',
        governorVault: '0x2A2DfA1B3B3F4db798b759d07064Bb800BD10fB1',
        traderVault: '0xa8aDE73124B3256F98f510F6A9E7C1e3Aa71d20B',
        feeController: '0x1a646107e7E88aa01Fadff3145Af08156679198e',
    },
} as const

export const V4_MARKETS = [
    {
        id: 1,
        name: 'UN Confirms Alien Life',
        description: 'Will the United Nations officially confirm the existence of extraterrestrial life?',
        marketAddress: '0xd2A266c2081C0f2c7c86b5541B9e9b255dde91F9',
        outcomeTokenAddress: '0xBf2866f71A082446DA6919C92C477d9D1608E4B7',
        bBase: '10000000000000000000000',
        initialTick: 500,
        status: 'live' as const,
    },
    {
        id: 2,
        name: 'BTC 7-day TWAP >= $100k',
        description: "Will Bitcoin's 7-day time-weighted average price reach or exceed $100,000?",
        marketAddress: '0x3423223043A6815547c0E83ec5c4aE1AeCb0eE02',
        outcomeTokenAddress: '0xe2A82254C7B831F87e659d3dc3D4dbe2B7De977f',
        bBase: '15000000000000000000000',
        initialTick: 700,
        status: 'live' as const,
    },
] as const

export type V4Market = typeof V4_MARKETS[number]
