// AMMTradePanel.tsx - AMM trading with lock warnings
import { useState } from 'react'
import { useAMMTrade } from '../../hooks/v4'
import { useBalances } from '../../hooks/v4'

interface AMMTradePanelProps {
    marketAddress: `0x${string}`
    outcomeTokenAddress: `0x${string}`
}

export function AMMTradePanel({ marketAddress, outcomeTokenAddress }: AMMTradePanelProps) {
    const [outcome, setOutcome] = useState<0 | 1>(1) // 0=NO, 1=YES
    const [shares, setShares] = useState('')
    const [slippage, setSlippage] = useState('5') // 5%
    const [isBuy, setIsBuy] = useState(true)

    const { executeTrade, isLoading, isSuccess, error } = useAMMTrade()
    const { available, yesShares, noShares, isLocked, unlockTime } = useBalances(
        marketAddress,
        outcomeTokenAddress
    )

    const handleTrade = async () => {
        if (!shares) return

        // Calculate limit with slippage
        const sharesNum = parseFloat(shares)
        const slippageMultiplier = isBuy
            ? 1 + parseFloat(slippage) / 100
            : 1 - parseFloat(slippage) / 100

        // TODO: Get actual cost estimate from market.calculateAMMTradeCost
        const estimatedCost = sharesNum * 0.5 // Placeholder
        const limit = (estimatedCost * slippageMultiplier).toFixed(6)

        await executeTrade({
            marketAddress,
            outcome,
            shares,
            limit,
            isBuy,
        })
    }

    const canSell = outcome === 1 ? parseFloat(yesShares) >= parseFloat(shares || '0')
        : parseFloat(noShares) >= parseFloat(shares || '0')

    return (
        <div className="space-y-4">
            {/* Buy/Sell Toggle */}
            <div className="flex gap-2">
                <button
                    onClick={() => setIsBuy(true)}
                    className={`flex-1 py-2 px-4 rounded ${isBuy ? 'bg-green-500 text-white' : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                >
                    Buy
                </button>
                <button
                    onClick={() => setIsBuy(false)}
                    className={`flex-1 py-2 px-4 rounded ${!isBuy ? 'bg-red-500 text-white' : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                >
                    Sell
                </button>
            </div>

            {/* Outcome Selection */}
            <div className="flex gap-2">
                <button
                    onClick={() => setOutcome(1)}
                    className={`flex-1 py-2 px-4 rounded ${outcome === 1 ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                >
                    YES
                </button>
                <button
                    onClick={() => setOutcome(0)}
                    className={`flex-1 py-2 px-4 rounded ${outcome === 0 ? 'bg-orange-500 text-white' : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                >
                    NO
                </button>
            </div>

            {/* Shares Input */}
            <div>
                <label className="block text-sm font-medium mb-1">Shares</label>
                <input
                    type="number"
                    value={shares}
                    onChange={(e) => setShares(e.target.value)}
                    placeholder="10"
                    className="w-full p-2 border rounded dark:bg-gray-800"
                />
            </div>

            {/* Slippage */}
            <div>
                <label className="block text-sm font-medium mb-1">Slippage %</label>
                <input
                    type="number"
                    value={slippage}
                    onChange={(e) => setSlippage(e.target.value)}
                    className="w-full p-2 border rounded dark:bg-gray-800"
                />
            </div>

            {/* Lock Warning for Buys */}
            {isBuy && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        ⏳ <strong>Lock Warning:</strong> Shares will be locked for 24 hours after purchase
                    </p>
                </div>
            )}

            {/* Sell Lock Status */}
            {!isBuy && isLocked && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded">
                    <p className="text-sm text-red-800 dark:text-red-200">
                        🔒 Position still locked. Wait {Math.ceil((unlockTime - Date.now() / 1000) / 3600)} hours
                    </p>
                </div>
            )}

            {/* Trade Button */}
            <button
                onClick={handleTrade}
                disabled={isLoading || (!isBuy && (!canSell || isLocked))}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded font-medium"
            >
                {isLoading ? 'Processing...' : isBuy ? 'Buy Shares' : 'Sell Shares'}
            </button>

            {/* Results */}
            {isSuccess && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-300 rounded">
                    <p className="text-sm text-green-800 dark:text-green-200">✅ Trade successful!</p>
                </div>
            )}
            {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-300 rounded">
                    <p className="text-sm text-red-800 dark:text-red-200">❌ {error.message}</p>
                </div>
            )}
        </div>
    )
}
