import { useState } from 'react';
import { useLaunchpadFactory } from '../../hooks/v5/useLaunchpadFactory';
import { useDeployments } from '../../hooks/useDeployments';
import { useNavigationStore } from '../../store/useNavigationStore';
import { parseUnits, formatUnits } from 'viem';

export const CreateLaunchpadMarket = () => {
    const { setView } = useNavigationStore();
    const {
        createMarket, isPending, isConfirmed, txHash, tierDeposits, deployedMarketAddress,
        allowance, approveUSDC, isApprovePending, usdcBalance
    } = useLaunchpadFactory();
    const { config } = useDeployments();

    const [name, setName] = useState('');
    const [symbol, setSymbol] = useState('');
    const [description, setDescription] = useState('');
    const [tier, setTier] = useState(0);
    const [isFixed, setIsFixed] = useState(false);
    const [duration, setDuration] = useState('86400'); // 1 day default

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !symbol) return;

        // Convert duration to seconds if needed, already in seconds str
        const durationSec = parseInt(duration);
        createMarket(name, symbol, description, tier, !isFixed, durationSec);
    };

    return (
        <div className="p-6 max-w-2xl mx-auto text-slate-300">
            <button
                onClick={() => setView('dapp')}
                className="mb-4 text-sm text-gray-400 hover:text-white flex items-center"
            >
                ← Back to App
            </button>
            <h1 className="text-3xl font-bold mb-6">Create New Market</h1>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Info */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Market Question (Name)</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full p-2 border rounded bg-gray-800 border-gray-700"
                            placeholder="e.g. Will ETH fit $10k in 2025?"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Ticker Symbol</label>
                        <input
                            type="text"
                            value={symbol}
                            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                            className="w-full p-2 border rounded bg-gray-800 border-gray-700"
                            placeholder="ETH10K"
                            maxLength={6}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full p-2 border rounded bg-gray-800 border-gray-700 h-24"
                            placeholder="Resolution criteria details..."
                        />
                    </div>
                </div>

                {/* Liquidity Tier */}
                <div className="space-y-4">
                    <label className="block text-sm font-medium mb-1">Initial Liquidity Tier</label>
                    <div className="grid grid-cols-2 gap-4">
                        {[0, 1, 2, 3].map((t) => {
                            const deposit = tierDeposits[t];
                            const displayAmt = deposit ? formatUnits(deposit, 6) : '...';
                            return (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setTier(t)}
                                    className={`p-4 border rounded ${tier === t ? 'border-blue-500 bg-blue-900/20' : 'border-gray-700'}`}
                                >
                                    <div className="font-bold">Tier {t}</div>
                                    <div className="text-sm text-gray-400">
                                        Deposit: ${Number(displayAmt).toLocaleString()} USDC
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Duration / Open-End */}
                <div className="space-y-4">
                    <div className="flex items-center space-x-4">
                        <label className="flex items-center">
                            <input
                                type="radio"
                                checked={!isFixed}
                                onChange={() => setIsFixed(false)}
                                className="mr-2"
                            />
                            Open-Ended
                        </label>
                        <label className="flex items-center">
                            <input
                                type="radio"
                                checked={isFixed}
                                onChange={() => setIsFixed(true)}
                                className="mr-2"
                            />
                            Fixed Duration
                        </label>
                    </div>

                    {isFixed && (
                        <div>
                            <label className="block text-sm font-medium mb-1">Duration (Seconds)</label>
                            <input
                                type="number"
                                value={duration}
                                onChange={(e) => setDuration(e.target.value)}
                                className="w-full p-2 border rounded bg-gray-800 border-gray-700"
                            />
                        </div>
                    )}
                </div>

                {/* Submit */}
                {(() => {
                    const requiredDeposit = tierDeposits[tier] || 0n;
                    const displayAmt = requiredDeposit ? formatUnits(requiredDeposit, 6) : '0';
                    const isApproved = allowance && allowance >= requiredDeposit;
                    const hasBalance = usdcBalance && usdcBalance >= requiredDeposit;

                    if (!hasBalance) {
                        return (
                            <div className="space-y-2">
                                <button
                                    disabled
                                    className="w-full py-3 bg-red-900/50 border border-red-500 text-red-200 rounded font-bold cursor-not-allowed"
                                >
                                    Insufficient USDC Balance
                                </button>
                                <p className="text-xs text-center text-red-400">
                                    You need ${Number(displayAmt).toLocaleString()} USDC. Your balance: ${usdcBalance ? Number(formatUnits(usdcBalance, 6)).toFixed(2) : '0.00'}
                                </p>
                            </div>
                        )
                    }

                    if (!isApproved) {
                        return (
                            <div className="space-y-2">
                                <button
                                    type="button"
                                    onClick={approveUSDC}
                                    disabled={isApprovePending}
                                    className="w-full py-3 bg-yellow-600 hover:bg-yellow-500 rounded font-bold disabled:opacity-50"
                                >
                                    {isApprovePending ? 'Approving USDC...' : `Step 1: Approve USDC ($${Number(displayAmt).toLocaleString()})`}
                                </button>
                                <p className="text-xs text-center text-gray-500">You must approve the launchpad to spend USDC for the initial liquidity.</p>
                            </div>
                        );
                    }

                    return (
                        <button
                            type="submit"
                            disabled={isPending}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded font-bold disabled:opacity-50"
                        >
                            {isPending ? 'Step 2: Creating Market...' : 'Step 2: Create Market'}
                        </button>
                    );
                })()}

                {txHash && (
                    <div className="mt-4 p-4 bg-gray-900 rounded">
                        <div className="text-sm text-gray-400">Transaction Hash:</div>
                        <div className="font-mono text-xs break-all mb-4">{txHash}</div>

                        {isConfirmed && deployedMarketAddress && (
                            <div className="space-y-2">
                                <div className="text-green-400 font-bold">Market Created Successfully!</div>
                                <button
                                    type="button"
                                    onClick={() => setView('launchpad-market', deployedMarketAddress)}
                                    className="w-full py-2 bg-gradient-to-r from-green-600 to-teal-600 text-white font-bold rounded hover:scale-105 transition-transform"
                                >
                                    View Market →
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </form>
        </div>
    );
};
