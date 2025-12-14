import { useState } from 'react';
import { useTraderVault } from '../../hooks/useTraderVault';
import { useLaunchpadTradeQuote } from '../../hooks/v5/useLaunchpadTradeQuote';
import { useAccount } from 'wagmi';

interface LaunchpadTradeFormProps {
    marketAddress: `0x${string}`;
    bBase: bigint;
}

export const LaunchpadTradeForm = ({ marketAddress, bBase }: LaunchpadTradeFormProps) => {
    const { isConnected } = useAccount();
    const { executeAMMTrade, approveUSDC, allowance } = useTraderVault();

    // State
    const [outcome, setOutcome] = useState<0 | 1>(0); // 0 = YES, 1 = NO
    const [mode, setMode] = useState<'buy' | 'sell'>('buy');
    const [amount, setAmount] = useState('');
    const [slippage, setSlippage] = useState(50); // 0.5%

    // Quote
    // For Sell, amount is negative shares
    const sharesInput = mode === 'buy' ? amount : `-${amount}`;
    const { quote, isLoading, error } = useLaunchpadTradeQuote(
        marketAddress,
        outcome,
        sharesInput,
        slippage,
        bBase
    );

    // Trade Action
    const handleTrade = async () => {
        if (!quote || !amount) return;

        // Check allowance if Buying
        if (mode === 'buy' && quote.maxWithSlippage > Number(allowance) / 1e18) {
            // Need approve
            await approveUSDC(Math.ceil(quote.maxWithSlippage).toString());
            return;
        }

        /* 
         executeAMMTrade args:
         - market
         - outcome
         - deltaShares (string)
         - maxCost (string)
        */

        // Convert maxCost/minReceived to string for hook
        // quote.maxWithSlippage is strictly positive number representing the LIMIT.
        // For Buy: It is max we pay (positive).
        // For Sell: It is min we receive (positive magnitude in existing hook logic? Wait useTraderVault expects signed or unsigned?)

        // Let's check useTraderVault.tradeAMM:
        // const maxCostWad = parseUnits(maxCost, 18);
        // It parses the string directly.

        // If Buying: maxCost is positive limit (e.g. 105). Contract checks cost <= maxCost.
        // If Selling: cost is negative (e.g. -100). We set maxCost to -95 (must receive at least 95).
        // Since contract checks cost <= maxCost (-100 <= -95 is TRUE). 
        // So for Sell, maxCost param must be negative string.

        let limitParam = '';
        if (mode === 'buy') {
            limitParam = quote.maxWithSlippage.toString();
        } else {
            // maxWithSlippage in hook was Math.abs(). We need to flip sign.
            limitParam = (-quote.maxWithSlippage).toString();
        }

        await executeAMMTrade(marketAddress, outcome, sharesInput, limitParam);
        setAmount('');
    };

    if (!isConnected) {
        return (
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 text-center">
                <p className="text-gray-400">Connect Wallet to Trade</p>
            </div>
        )
    }

    return (
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <h3 className="text-xl font-bold mb-4 text-white">Trade</h3>

            {/* Buy/Sell Toggles */}
            <div className="flex bg-slate-900 rounded p-1 mb-4">
                <button
                    onClick={() => setMode('buy')}
                    className={`flex-1 py-1 text-sm font-bold rounded ${mode === 'buy' ? 'bg-green-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                    Buy
                </button>
                <button
                    onClick={() => setMode('sell')}
                    className={`flex-1 py-1 text-sm font-bold rounded ${mode === 'sell' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                    Sell
                </button>
            </div>

            {/* Outcome Toggles */}
            <div className="flex gap-2 mb-4">
                <button
                    onClick={() => setOutcome(0)}
                    className={`flex-1 py-3 text-lg font-bold rounded border ${outcome === 0
                            ? 'bg-green-500/20 text-green-400 border-green-500'
                            : 'bg-slate-900 text-slate-500 border-transparent hover:border-green-500/30'
                        }`}
                >
                    YES
                </button>
                <button
                    onClick={() => setOutcome(1)}
                    className={`flex-1 py-3 text-lg font-bold rounded border ${outcome === 1
                            ? 'bg-red-500/20 text-red-400 border-red-500'
                            : 'bg-slate-900 text-slate-500 border-transparent hover:border-red-500/30'
                        }`}
                >
                    NO
                </button>
            </div>

            {/* Amount Input */}
            <div className="mb-4">
                <label className="block text-xs text-slate-400 mb-1">
                    Shares Amount
                </label>
                <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.0"
                    className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white focus:outline-none focus:border-blue-500"
                />
            </div>

            {/* Quote Summary */}
            {isLoading && <div className="text-sm text-slate-400 animate-pulse mb-4">Calculating...</div>}
            {error && <div className="text-sm text-red-400 mb-4">{error}</div>}

            {quote && !isLoading && (
                <div className="mb-4 text-sm space-y-1 p-3 bg-slate-900 rounded border border-slate-800">
                    <div className="flex justify-between">
                        <span className="text-slate-400">Est. {mode === 'buy' ? 'Cost' : 'Receive'}</span>
                        <span className="text-white font-bold">${quote.expectedCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-400">Price after</span>
                        <span className={`${outcome === 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {(outcome === 0 ? quote.newPriceYes : quote.newPriceNo).toFixed(2)}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-400">Max / Slippage</span>
                        <span className="text-slate-300">${quote.maxWithSlippage.toFixed(2)}</span>
                    </div>
                </div>
            )}

            {/* Action Button */}
            <button
                onClick={handleTrade}
                disabled={!quote || isLoading}
                className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${!quote ? 'bg-slate-700 text-slate-500 cursor-not-allowed' :
                        mode === 'buy'
                            ? 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20'
                            : 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/20'
                    }`}
            >
                {mode === 'buy' ? `Buy ${outcome === 0 ? 'YES' : 'NO'}` : `Sell ${outcome === 0 ? 'YES' : 'NO'}`}
            </button>
        </div>
    );
}
