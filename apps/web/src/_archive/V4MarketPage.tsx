// @ts-nocheck
// V4MarketPage.tsx - Main trading page for V4
import { useEffect, useMemo, useState } from 'react'
import { useAccount, useChainId } from 'wagmi'
import {
    VenueSelector,
    AMMTradePanel,
    OrderbookPanel,
    PortfolioView,
    MarketCard,
} from '../components/v4'
import marketsConfig from '../config/markets.json'
import type { MarketConfig } from '../types'

type Venue = 'amm' | 'orderbook'

export function V4MarketPage() {
    const { address, isConnected } = useAccount()
    const chainId = useChainId()

    const markets = useMemo(() => {
        return (marketsConfig.markets as MarketConfig[]).filter(
            (m) => m.mode === 'real' && m.chainId === chainId
        )
    }, [chainId])

    const [selectedMarket, setSelectedMarket] = useState<MarketConfig | null>(markets[0] ?? null)
    const [venue, setVenue] = useState<Venue>('amm')

    useEffect(() => {
        // Reset selection when chain changes
        setSelectedMarket(markets[0] ?? null)
    }, [markets])

    if (!isConnected) {
        return (
            <div className="max-w-4xl mx-auto p-6">
                <div className="text-center p-12 border rounded-lg dark:border-gray-700">
                    <h2 className="text-2xl font-bold mb-4">Connect Wallet</h2>
                    <p className="text-gray-600 dark:text-gray-400">
                        Please connect your wallet to trade on V4 markets
                    </p>
                </div>
            </div>
        )
    }

    if (!selectedMarket) {
        return (
            <div className="max-w-4xl mx-auto p-6">
                <div className="text-center p-12 border rounded-lg dark:border-gray-700">
                    <h2 className="text-2xl font-bold mb-4">No V4 markets on this network</h2>
                    <p className="text-gray-600 dark:text-gray-400">
                        Switch your wallet to a supported network (e.g. Base Sepolia or BNB Testnet).
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-7xl mx-auto p-6">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Sooth Protocol V4</h1>
                <p className="text-gray-600 dark:text-gray-400">
                    Dual-venue prediction markets with lock-on-sell AMM and lock-free orderbook
                </p>
            </div>

            {/* Market Selector */}
            <div className="mb-6">
                <h2 className="text-xl font-bold mb-4">Select Market</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {markets.map((market) => (
                        <button
                            key={market.id}
                            onClick={() => setSelectedMarket(market)}
                            className={`text-left ${selectedMarket.id === market.id ? 'ring-2 ring-blue-500' : ''
                                }`}
                        >
                            <MarketCard market={market} />
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Trading Panel */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="p-6 border rounded-lg dark:border-gray-700">
                        <h2 className="text-2xl font-bold mb-4">{selectedMarket.name}</h2>

                        {/* Venue Selector */}
                        <VenueSelector selected={venue} onChange={setVenue} />

                        {/* Trade Panel Based on Venue */}
                        <div className="mt-6">
                            {venue === 'amm' ? (
                                <AMMTradePanel
                                    marketId={selectedMarket.id}
                                    marketAddress={selectedMarket.contractAddress as `0x${string}`}
                                    outcomeTokenAddress={selectedMarket.outcomeTokenAddress as `0x${string}`}
                                />
                            ) : (
                                <OrderbookPanel marketAddress={selectedMarket.contractAddress as `0x${string}`} />
                            )}
                        </div>
                    </div>
                </div>

                {/* Portfolio Sidebar */}
                <div className="lg:col-span-1">
                    <div className="p-6 border rounded-lg dark:border-gray-700 sticky top-6">
                        <h2 className="text-xl font-bold mb-4">Your Portfolio</h2>
                        <PortfolioView
                            marketAddress={selectedMarket.contractAddress as `0x${string}`}
                            outcomeTokenAddress={selectedMarket.outcomeTokenAddress as `0x${string}`}
                        />
                    </div>
                </div>
            </div>

            {/* Info Footer */}
            <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h3 className="font-bold mb-2">V4 Features</h3>
                <ul className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
                    <li>• <strong>AMM:</strong> Instant execution with 24h lock on sell proceeds</li>
                    <li>• <strong>Orderbook:</strong> Set your price, get ERC1155 tokens, no locks</li>
                    <li>• <strong>Dynamic Liquidity:</strong> Market-performance based `b` parameter</li>
                </ul>
            </div>
        </div>
    )
}
