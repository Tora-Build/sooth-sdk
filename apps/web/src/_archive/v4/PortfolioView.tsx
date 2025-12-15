// PortfolioView.tsx - Display all user positions (V4.6 Lock-on-Sell)
import { useBalances } from '../../hooks/v4'
import { useLockedFunds } from '../../hooks/useLockedFunds'
import { UnlockTimer } from './UnlockTimer'
import { useState } from 'react'

interface PortfolioViewProps {
    marketAddress: `0x${string}`
    outcomeTokenAddress: `0x${string}`
}

export function PortfolioView({ marketAddress, outcomeTokenAddress }: PortfolioViewProps) {
    const {
        yesShares,
        noShares,
        isLocked,
        unlockTime,
        yesTokens,
        noTokens,
    } = useBalances(marketAddress, outcomeTokenAddress)

    const {
        availableFormatted,
        pendingFormatted,
        lockedFormatted,
        claimableFormatted,
        totalFormatted,
        locked,
        hasClaimable,
        isClaiming,
        claim,
    } = useLockedFunds()

    const [claimError, setClaimError] = useState<string | null>(null)

    const handleClaim = async () => {
        setClaimError(null)
        try {
            await claim()
        } catch (error) {
            setClaimError(error instanceof Error ? error.message : 'Claim failed')
        }
    }

    return (
        <div className="space-y-6">
            {/* USDC Balances */}
            <div className="p-4 border rounded-lg dark:border-gray-700">
                <h3 className="font-bold mb-3">💰 USDC Balance</h3>
                <div className="space-y-2">
                    <div className="flex justify-between">
                        <span className="text-green-600 dark:text-green-400">Available:</span>
                        <span className="font-mono text-green-600">{availableFormatted}</span>
                    </div>

                    {/* Locked Funds Row (Lock-on-Sell) */}
                    {locked > 0n && (
                        <div className="flex justify-between items-center">
                            <span className="text-amber-600 dark:text-amber-400">🔒 Locked:</span>
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-amber-600">{lockedFormatted}</span>
                                {hasClaimable && (
                                    <button
                                        onClick={handleClaim}
                                        disabled={isClaiming}
                                        className="px-2 py-0.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isClaiming ? '...' : `Claim ${claimableFormatted}`}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">📋 Pending:</span>
                        <span className="font-mono">{pendingFormatted}</span>
                    </div>

                    <div className="border-t dark:border-gray-700 pt-2 mt-2 flex justify-between font-semibold">
                        <span>Total:</span>
                        <span className="font-mono">{totalFormatted}</span>
                    </div>

                    {claimError && (
                        <p className="text-xs text-red-500 mt-1">{claimError}</p>
                    )}
                </div>
            </div>

            {/* AMM Positions */}
            <div className="p-4 border rounded-lg dark:border-gray-700">
                <h3 className="font-bold mb-3">📈 AMM Positions</h3>
                {isLocked && <UnlockTimer unlockTime={unlockTime} />}
                <div className="space-y-2 mt-3">
                    <div className="flex justify-between">
                        <span className="text-blue-600">YES Shares:</span>
                        <span className="font-mono">{parseFloat(yesShares).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-orange-600">NO Shares:</span>
                        <span className="font-mono">{parseFloat(noShares).toFixed(2)}</span>
                    </div>
                </div>
                {parseFloat(yesShares) === 0 && parseFloat(noShares) === 0 && (
                    <p className="text-sm text-gray-500 mt-2">No AMM positions</p>
                )}
            </div>

            {/* Orderbook Tokens (ERC1155) */}
            <div className="p-4 border rounded-lg dark:border-gray-700">
                <h3 className="font-bold mb-3">🏷️ Orderbook Tokens (ERC1155)</h3>
                <div className="space-y-2">
                    <div className="flex justify-between">
                        <span className="text-blue-600">YES Tokens:</span>
                        <span className="font-mono">{parseFloat(yesTokens).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-orange-600">NO Tokens:</span>
                        <span className="font-mono">{parseFloat(noTokens).toFixed(2)}</span>
                    </div>
                </div>
                {parseFloat(yesTokens) === 0 && parseFloat(noTokens) === 0 && (
                    <p className="text-sm text-gray-500 mt-2">No orderbook tokens</p>
                )}
            </div>
        </div>
    )
}
