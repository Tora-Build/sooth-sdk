// V4 Contract Addresses - Base Sepolia
// Deployed: 2025-12-09 (Continuous LMSR - no ticks)

export const V4_ADDRESSES = {
    baseSepolia: {
        chainId: 84532,
        // Phase 0: Utilities
        usdc: '0xd2C6903C7311C7EC6F2f09DA7A0d417A59CB04ab',        // Original USDC (keep for compatibility)
        newUsdc: '0xa0eEa05Cc350Ac218683815e85Cac4A1a1eF36dd',    // New MockUSDC from Phase 0

        // Phase 1: Infrastructure
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
        marketAddress: '0xbF669983b1054809cF6860B5Afe192b03b0bea73',
        outcomeTokenAddress: '0x4D1c7DdfA51d6686F3B3B26eC9bE2AF9d98c934A',
        bBase: '10000000000000000000000',
        // Continuous LMSR: qYes/qNo start at 0 for 50% initial probability
        initialQYes: '0',
        initialQNo: '0',
        status: 'live' as const,
    },
    {
        id: 2,
        name: 'BTC 7-day TWAP >= $100k',
        description: "Will Bitcoin's 7-day time-weighted average price reach or exceed $100,000?",
        marketAddress: '0xD5C8b0FaA0CD924D9805577c77B50aC3493d04a1',
        outcomeTokenAddress: '0x506D40d3ec2C7BE66db3F4509EEFd4aA880D6eE0',
        bBase: '15000000000000000000000',
        initialQYes: '0',
        initialQNo: '0',
        status: 'live' as const,
    },
] as const

export type V4Address = typeof V4_ADDRESSES.baseSepolia
export type V4Market = typeof V4_MARKETS[number]

