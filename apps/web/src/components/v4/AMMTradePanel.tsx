// AMMTradePanel.tsx - AMM trading (Refactored for V4 Stability)
import { useState } from 'react'
import { useAMMTrade } from '../../hooks/v4'
import { useBalances } from '../../hooks/v4'
import { useV4Quote } from '../../hooks/useV4Quote'

interface AMMTradePanelProps {
    marketId: string
    marketAddress: `0x${string}`
    outcomeTokenAddress: `0x${string}`
}

export function AMMTradePanel({ marketId, marketAddress, outcomeTokenAddress }: AMMTradePanelProps) {
    const [outcome, setOutcome] = useState<0 | 1>(1) // 0=NO, 1=YES
    const [shares, setShares] = useState('')
    const [slippage, setSlippage] = useState('50') // basis points
    const [isBuy, setIsBuy] = useState(true)

    // Trade Execution Hook
    const { executeTrade, isLoading: isTradeLoading, isSuccess, error: tradeError } = useAMMTrade()

    // Balances
    const { yesShares, noShares, isLocked } = useBalances(marketAddress, outcomeTokenAddress)

    // Pricing Hook (Handles debouncing internally)
    // Note: shares is passed directly. Hook handles strict sync.
    const { quote, isLoading: isQuoteLoading, error: quoteError } = useV4Quote(
        marketId,
        outcome,
        shares,
        isBuy
    )

    const handleTrade = async () => {
        if (!shares || !quote) return

        // Use quote.totalCost or maxWithSlippage logic here?
        // Typically maxCost is calculated from cost + slippage
        // For V4, maxCost is signed. 
        // Let's rely on standard logic: calculate max cost based on expected cost + slippage

        // Re-calculate limit here or use quote prop?
        // useV4Quote doesn't return maxWithSlippage explicitly to keep interface clean.
        // Let's simple-calc it here:
        const BPS = 10000;
        const limitFloat = isBuy
            ? quote.expectedCost * (1 + (parseInt(slippage) + 10) / BPS)
            : quote.expectedCost * (1 - (parseInt(slippage) + 10) / BPS);

        const limitStr = limitFloat.toString(); // API expects string

        await executeTrade({
            marketAddress,
            outcome,
            shares,
            limit: limitStr,
            isBuy,
        })
    }

    const canSell = outcome === 1
        ? parseFloat(yesShares || '0') >= parseFloat(shares || '0')
        : parseFloat(noShares || '0') >= parseFloat(shares || '0')

    const potentialReturn = quote && isBuy
        ? (parseFloat(shares) - quote.expectedCost) / quote.expectedCost * 100
        : 0

    const showQuotePanel = parseFloat(shares) > 0;

    return (
        <div className="space-y-4">
            {/* Buy/Sell Toggle */}
            <div className="flex gap-2 relative">
                <span className="absolute -top-6 right-0 text-xs text-gray-400">v4.1 Rebuild</span>
                <button
                    onClick={() => setIsBuy(true)}
                    className={`flex-1 py-2 px-4 rounded font-medium transition-colors ${isBuy ? 'bg-green-600 text-white' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                >
                    Buy
                </button>
                <button
                    onClick={() => setIsBuy(false)}
                    className={`flex-1 py-2 px-4 rounded font-medium transition-colors ${!isBuy ? 'bg-red-600 text-white' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                >
                    Sell
                </button>
            </div>

            {/* Outcome Selection */}
            <div className="flex gap-2">
                <button
                    onClick={() => setOutcome(1)}
                    className={`flex-1 py-2 px-4 rounded font-medium transition-colors ${outcome === 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
                >
                    YES
                </button>
                <button
                    onClick={() => setOutcome(0)}
                    className={`flex-1 py-2 px-4 rounded font-medium transition-colors ${outcome === 0 ? 'bg-orange-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
                >
                    NO
                </button>
            </div>

            {/* Shares Input */}
            <div>
                <label className="block text-sm font-medium mb-1">Shares</label>
                <div className="relative">
                    <input
                        type="number"
                        value={shares}
                        onChange={(e) => setShares(e.target.value)}
                        placeholder="0.0"
                        className="w-full p-3 border rounded dark:bg-gray-800 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <span className="absolute right-3 top-3 text-gray-500">Shares</span>
                </div>
            </div>

            {/* Quote Details Panel */}
            {showQuotePanel && (
                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded space-y-2 text-sm">
                    {/* Avg Price */}
                    <div className="flex justify-between items-center h-6">
                        <span className="text-gray-500">Avg Price:</span>
                        {isQuoteLoading || !quote ? (
                            <div className="w-24 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                        ) : (
                            <span className="font-medium">
                                {(quote.expectedCost / quote.inputAmount).toFixed(4)} USDC
                            </span>
                        )}
                    </div>

                    {/* Expected Cost */}
                    <div className="flex justify-between items-center h-6">
                        <span className="text-gray-500">{isBuy ? 'Est. Cost:' : 'Est. Receive:'}</span>
                        {isQuoteLoading || !quote ? (
                            <div className="w-20 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                        ) : (
                            <span className="font-medium">
                                {quote.expectedCost.toFixed(2)} USDC
                            </span>
                        )}
                    </div>

                    {/* Price Impact */}
                    <div className="flex justify-between items-center h-6">
                        <span className="text-gray-500">Price Impact:</span>
                        {isQuoteLoading || !quote ? (
                            <div className="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                        ) : (
                            <span className={`font-medium ${quote.priceImpact > 5 ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`}>
                                {quote.priceImpact.toFixed(2)}%
                            </span>
                        )}
                    </div>

                    {/* Network Fee */}
                    <div className="flex justify-between items-center h-6">
                        <span className="text-gray-500">Network Fee:</span>
                        {isQuoteLoading || !quote ? (
                            <div className="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                        ) : (
                            <span className="font-medium">{quote.fee.toFixed(4)} USDC</span>
                        )}
                    </div>

                    {/* Potential Return (Buy Only) */}
                    {isBuy && (
                        <div className="flex justify-between items-center h-6 border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                            <span className="text-gray-500">Potential Return:</span>
                            {isQuoteLoading || !quote ? (
                                <div className="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                            ) : (
                                <span className="font-medium text-green-600">
                                    +{potentialReturn.toFixed(2)}%
                                </span>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Slippage Settings */}
            <div className="flex items-center gap-2 text-sm">
                <label className="text-gray-500">Slippage:</label>
                <select
                    value={slippage}
                    onChange={(e) => setSlippage(e.target.value)}
                    className="bg-transparent border rounded p-1 dark:border-gray-700"
                >
                    <option value="10">0.1%</option>
                    <option value="50">0.5%</option>
                    <option value="100">1.0%</option>
                    <option value="500">5.0%</option>
                </select>
            </div>

            {/* Lock Warning */}
            {isBuy && parseFloat(shares) > 0 && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded flex items-start gap-2">
                    <span className="text-lg">⏳</span>
                    <p className="text-sm text-yellow-800 dark:text-yellow-200 leading-tight pt-1">
                        Shares will be locked for <strong>24 hours</strong>. You cannot sell them until the lock expires.
                    </p>
                </div>
            )}

            {/* Trade Button */}
            <button
                onClick={handleTrade}
                disabled={isTradeLoading || isQuoteLoading || !quote || parseFloat(shares) <= 0 || (!isBuy && (!canSell || isLocked))}
                className={`w-full py-3 px-4 rounded font-medium text-white transition-opacity ${isTradeLoading || isQuoteLoading || !quote || parseFloat(shares) <= 0 || (!isBuy && (!canSell || isLocked))
                    ? 'bg-gray-400 cursor-not-allowed'
                    : isBuy ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'
                    }`}
            >
                {isTradeLoading ? 'Processing...'
                    : isQuoteLoading ? 'Refining Quote...'
                        : isBuy
                            ? `Buy for ~${quote?.expectedCost.toFixed(2) || '0.00'} USDC`
                            : `Sell for ~${quote?.expectedCost.toFixed(2) || '0.00'} USDC`
                }
            </button>

            {/* Errors/Success */}
            {isSuccess && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-300 rounded text-center">
                    <p className="text-sm text-green-800 dark:text-green-200">✅ Trade executed successfully!</p>
                </div>
            )}
            {(tradeError || quoteError) && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-300 rounded text-center">
                    <p className="text-sm text-red-800 dark:text-red-200">
                        ❌ {tradeError?.message || quoteError || 'An error occurred'}
                    </p>
                </div>
            )}
        </div>
    )
}
