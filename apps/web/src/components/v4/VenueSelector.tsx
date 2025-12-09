// VenueSelector.tsx - Choose between AMM and Orderbook
import { useState } from 'react'

type Venue = 'amm' | 'orderbook'

interface VenueSelectorProps {
    selected: Venue
    onChange: (venue: Venue) => void
}

export function VenueSelector({ selected, onChange }: VenueSelectorProps) {
    return (
        <div className="flex gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <button
                onClick={() => onChange('amm')}
                className={`flex-1 p-4 rounded-lg border-2 transition-all ${selected === 'amm'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-300 dark:border-gray-700 hover:border-gray-400'
                    }`}
            >
                <div className="text-left">
                    <h3 className="font-bold text-lg mb-2">AMM</h3>
                    <ul className="text-sm space-y-1 text-gray-600 dark:text-gray-400">
                        <li>✅ Instant execution</li>
                        <li>⏳ 24h lock on buy</li>
                        <li>💰 Lower gas</li>
                    </ul>
                </div>
            </button>

            <button
                onClick={() => onChange('orderbook')}
                className={`flex-1 p-4 rounded-lg border-2 transition-all ${selected === 'orderbook'
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                        : 'border-gray-300 dark:border-gray-700 hover:border-gray-400'
                    }`}
            >
                <div className="text-left">
                    <h3 className="font-bold text-lg mb-2">Orderbook</h3>
                    <ul className="text-sm space-y-1 text-gray-600 dark:text-gray-400">
                        <li>📊 Set your price</li>
                        <li>🔓 No locks</li>
                        <li>🎫 Get ERC1155 tokens</li>
                    </ul>
                </div>
            </button>
        </div>
    )
}
