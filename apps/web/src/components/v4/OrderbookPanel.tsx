// OrderbookPanel.tsx - Limit order trading (no locks)
import { useState } from 'react'
import { useOrderbook } from '../../hooks/v4'

interface OrderbookPanelProps {
    marketAddress: `0x${string}`
}

export function OrderbookPanel({ marketAddress }: OrderbookPanelProps) {
    const [outcome, setOutcome] = useState<0 | 1>(1)
    const [isBuy, setIsBuy] = useState(true)
    const [price, setPrice] = useState('0.6') // 60%
    const [amount, setAmount] = useState('')

    const { placeOrder, isLoading, isSuccess, error } = useOrderbook()

    const handlePlaceOrder = async () => {
        if (!price || !amount) return

        await placeOrder({
            marketAddress,
            outcome,
            price,
            amount,
            isBuy,
        })
    }

    return (
        <div className="space-y-4">
            {/* Buy/Sell Side */}
            <div className="flex gap-2">
                <button
                    onClick={() => setIsBuy(true)}
                    className={`flex-1 py-2 px-4 rounded font-medium transition-colors ${isBuy ? 'bg-green-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
                >
                    Buy
                </button>
                <button
                    onClick={() => setIsBuy(false)}
                    className={`flex-1 py-2 px-4 rounded font-medium transition-colors ${!isBuy ? 'bg-red-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
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

            {/* Price Input */}
            <div>
                <label className="block text-sm font-medium mb-1">
                    Price (0-1) <span className="text-gray-500">e.g., 0.6 = 60%</span>
                </label>
                <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full p-2 border rounded dark:bg-gray-800"
                />
            </div>

            {/* Amount Input */}
            <div>
                <label className="block text-sm font-medium mb-1">Amount (Shares)</label>
                <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="10"
                    className="w-full p-2 border rounded dark:bg-gray-800"
                />
            </div>

            {/* No Lock Info */}
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded">
                <p className="text-sm text-green-800 dark:text-green-200">
                    🔓 <strong>No locks!</strong> Orderbook trades mint/burn ERC1155 outcome tokens immediately
                </p>
            </div>

            {/* Place Order Button */}
            <button
                onClick={handlePlaceOrder}
                disabled={isLoading}
                className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded font-medium"
            >
                {isLoading ? 'Processing...' : 'Place Limit Order'}
            </button>

            {/* Results */}
            {isSuccess && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-300 rounded">
                    <p className="text-sm text-green-800 dark:text-green-200">
                        ✅ Order placed! ERC1155 tokens minted
                    </p>
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
