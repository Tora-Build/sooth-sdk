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
        id: 'market1',
        name: 'UN Confirms Alien Life',
        description: 'Will the United Nations officially confirm the existence of extraterrestrial life?',
        address: '0x5c8c3621b0606f8b42ab17c3e33057948e587ee7',
        outcomeToken: '0x1c9cc0704b4da8b8f766ec05c16be2c336d19423',
        bParam: '10000000000000000000000', // 10000 * 1e18
        initialQYes: '0',
        initialQNo: '0',
        status: 'live' as const,
    },
    {
        id: 'market2',
        name: 'BTC >= $100k',
        description: "Will Bitcoin's 7-day time-weighted average price reach or exceed $100,000?",
        address: '0x00da96600863a4f26e8a9cb5ca5524c3d7115403',
        outcomeToken: '0xbc433f98780d6fef61331d51606269457818c720',
        bParam: '15000000000000000000000', // 15000 * 1e18
        initialQYes: '0',
        initialQNo: '0',
        status: 'live' as const,
    }
] as const

export type V4Address = typeof V4_ADDRESSES.baseSepolia
export type V4Market = typeof V4_MARKETS[number]
