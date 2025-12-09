// MarketCard.tsx - Display market info
import { useMarketV4 } from '../../hooks/v4'
import type { V4Market } from '../../config/v4-addresses'

interface MarketCardProps {
    market: V4Market
}

export function MarketCard({ market }: MarketCardProps) {
    const { probability, liquidity, tick } = useMarketV4(market.marketAddress as `0x${string}`)

    const yesPercent = (probability * 100).toFixed(1)
    const noPercent = ((1 - probability) * 100).toFixed(1)

    return (
        <div className="p-6 border rounded-lg hover:shadow-lg transition-shadow dark:border-gray-700">
            <h2 className="text-xl font-bold mb-2">{market.name}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {market.description}
            </p>

            {/* Probability Bars */}
            <div className="space-y-2 mb-4">
                <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                        <span className="text-blue-600 font-medium">YES</span>
                        <span>{yesPercent}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-500 transition-all"
                            style={{ width: `${yesPercent}%` }}
                        />
                    </div>
                </div>

                <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                        <span className="text-orange-600 font-medium">NO</span>
                        <span>{noPercent}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-orange-500 transition-all"
                            style={{ width: `${noPercent}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                <div>
                    <span className="font-medium">Liquidity:</span> {parseFloat(liquidity).toFixed(0)}
                </div>
                <div>
                    <span className="font-medium">Tick:</span> {tick}
                </div>
            </div>
        </div>
    )
}
