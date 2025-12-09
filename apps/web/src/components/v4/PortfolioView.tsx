// PortfolioView.tsx - Display all user positions
import { useBalances } from '../../hooks/v4'
import { UnlockTimer } from './UnlockTimer'

interface PortfolioViewProps {
    marketAddress: `0x${string}`
    outcomeTokenAddress: `0x${string}`
}

export function PortfolioView({ marketAddress, outcomeTokenAddress }: PortfolioViewProps) {
    const {
        available,
        pending,
        yesShares,
        noShares,
        isLocked,
        unlockTime,
        yesTokens,
        noTokens,
    } = useBalances(marketAddress, outcomeTokenAddress)

    return (
        <div className="space-y-6">
            {/* USDC Balances */}
            <div className="p-4 border rounded-lg dark:border-gray-700">
                <h3 className="font-bold mb-3">USDC Balance</h3>
                <div className="space-y-2">
                    <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Available:</span>
                        <span className="font-mono">{parseFloat(available).toFixed(2)} USDC</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Pending:</span>
                        <span className="font-mono">{parseFloat(pending).toFixed(2)} USDC</span>
                    </div>
                </div>
            </div>

            {/* AMM Positions */}
            <div className="p-4 border rounded-lg dark:border-gray-700">
                <h3 className="font-bold mb-3">AMM Positions</h3>
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
                <h3 className="font-bold mb-3">Orderbook Tokens (ERC1155)</h3>
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
