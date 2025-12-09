// V4 Contract Addresses - Base Sepolia
export const V4_ADDRESSES = {
    baseSepolia: {
        chainId: 84532,
        usdc: '0xd2C6903C7311C7EC6F2f09DA7A0d417A59CB04ab',
        governorVault: '0x0C96BcCa40f5D45D0a000C91276E3b5ac3A45e6f',
        traderVault: '0xee91e05f95cBaACD46f58432DF72CB5C451e98E0',
        feeController: '0xa367B312Ca1845B7c6076345cB5cd529F935B4FA',
    },
} as const

export const V4_MARKETS = [
    {
        id: 1,
        name: 'UN Confirms Alien Life',
        description: 'Will the United Nations officially confirm the existence of extraterrestrial life?',
        marketAddress: '0xf17f4863aeeecdd5db8d0eb2a81a5435987267db',
        outcomeTokenAddress: '0x7f7a84196dc38b054a6f31b2efcd7142860b37c6',
        bBase: '10000000000000000000000',
        initialTick: 500,
        status: 'live' as const,
    },
    {
        id: 2,
        name: 'BTC 7-day TWAP >= $100k',
        description: "Will Bitcoin's 7-day time-weighted average price reach or exceed $100,000?",
        marketAddress: '0xb6cfef7a8128eb236362c4f60a9b4f0aa7784ef7',
        outcomeTokenAddress: '0xd1385686a408e629271bddcc9b918c284134c069',
        bBase: '15000000000000000000000',
        initialTick: 700,
        status: 'live' as const,
    },
] as const

export type V4Market = typeof V4_MARKETS[number]
