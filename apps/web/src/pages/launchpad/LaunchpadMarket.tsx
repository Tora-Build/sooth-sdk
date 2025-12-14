import { useLaunchpadMarket } from '../../hooks/v5/useLaunchpadMarket';
import { useNavigationStore } from '../../store/useNavigationStore';
import { useAmmMarket } from '../../hooks/useAmmMarket';
import { formatUnits, formatEther } from 'viem';
import { useAccount } from 'wagmi';
import { useState, useEffect } from 'react';
import { LaunchpadTradeForm } from './LaunchpadTradeForm';

export const LaunchpadMarket = () => {
    const { setView, activeMarketAddress } = useNavigationStore();
    const { address: userAddress } = useAccount();

    // Fetch Standard Market Data (Price, etc) - assuming we can pass address as ID for now or need ID lookup?
    // useAmmMarket expects an ID. We might need to find the ID from the address loopup or just rely on address if supported.
    // For now, let's assume activeMarketAddress IS the ID if passing from dashboard, OR we need a lookup.
    // Actually, Launchpad markets are likely NOT in the config file yet.
    // We need a way to load dynamic markets. useAmmMarket might fail if it's not in config.
    // This is a known limitation. For V5, we might need a `useDynamicMarket(address)` hook or update `useAmmMarket` to handle direct addresses.
    // Let's implement a basic view first that just shows Launchpad specific data.

    const {
        isGraduated,
        graduationThreshold,
        bBase,
        deadline,
        creator,
        isLive,
        graduate,
        expire,
        claimRefund,
        isGraduatePending,
        isExpirePending,
        isRefundPending
    } = useLaunchpadMarket(activeMarketAddress as `0x${string}`);

    if (!activeMarketAddress) return <div>No market selected</div>;

    // Calc Progress
    const thresholdVal = graduationThreshold ? parseFloat(formatEther(graduationThreshold)) : 10000; // Default fallback
    const currentLiq = bBase ? parseFloat(formatEther(bBase)) : 0;
    const progressPercent = Math.min((currentLiq / thresholdVal) * 100, 100);

    const isExpired = deadline && Date.now() / 1000 > deadline && !isGraduated;

    return (
        <div className="p-6 max-w-7xl mx-auto text-slate-300">
            <button
                onClick={() => setView('dapp')}
                className="mb-4 text-sm text-gray-400 hover:text-white flex items-center"
            >
                ← Back to App
            </button>

            {/* Header */}
            <div className="flex justify-between items-start mb-8">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-3xl font-bold break-all">{activeMarketAddress}</h1>
                        {isGraduated ? (
                            <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm font-bold border border-green-500/50">
                                🎓 GRADUATED
                            </span>
                        ) : isExpired ? (
                            <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-sm font-bold border border-red-500/50">
                                ❌ EXPIRED
                            </span>
                        ) : (
                            <span className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-sm font-bold border border-blue-500/50">
                                🚀 LAUNCHPAD
                            </span>
                        )}
                    </div>
                    <p className="text-gray-400">Created by {creator}</p>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                    {!isGraduated && !isExpired && progressPercent >= 100 && (
                        <button
                            onClick={graduate}
                            disabled={isGraduatePending}
                            className="px-6 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold rounded shadow-lg hover:scale-105 transition-all"
                        >
                            {isGraduatePending ? 'Graduating...' : '🎓 Graduate Market!'}
                        </button>
                    )}

                    {isExpired && userAddress === creator && (
                        <button
                            onClick={claimRefund}
                            disabled={isRefundPending}
                            className="px-6 py-2 bg-red-600 text-white font-bold rounded hover:bg-red-700"
                        >
                            {isRefundPending ? 'Claiming...' : 'Claim Refund'}
                        </button>
                    )}
                </div>
            </div>

            {/* Bonding Curve Progress */}
            <div className="mb-8 bg-gray-900 border border-gray-800 p-6 rounded-xl">
                <div className="flex justify-between mb-2">
                    <span className="font-bold text-gray-400">Graduation Progress</span>
                    <span className="font-mono text-blue-400">{progressPercent.toFixed(1)}%</span>
                </div>
                <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-blue-600 to-purple-600 transition-all duration-500"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
                <div className="flex justify-between mt-2 text-xs text-gray-500">
                    <span>Current: ${currentLiq.toFixed(2)}</span>
                    <span>Target: ${thresholdVal.toFixed(2)}</span>
                </div>
            </div>

            {/* Trading & Chart Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-8 bg-gray-900 rounded-xl p-6 min-h-[400px] flex items-center justify-center border border-gray-800">
                    {/* Placeholder for Chart - Real chart needs UseMarket hook which currently needs config ID */}
                    <div className="text-center">
                        <p className="text-xl font-bold mb-2">Adding Liquidity...</p>
                        <p className="text-gray-500">Charts require market indexing.</p>
                        <p className="text-gray-500 text-sm mt-4">Address: {activeMarketAddress}</p>
                    </div>
                </div>

                <div className="lg:col-span-4">
                    <LaunchpadTradeForm
                        marketAddress={activeMarketAddress as `0x${string}`}
                        bBase={bBase || 0n}
                    />
                </div>
            </div>
        </div>
    );
};
