// CreateMarketDrawer.tsx - Drawer-style market creation form
// Styled like OrderbookForm drawer with mock adjudicator selection

import React, { useState } from 'react';
import { useLaunchpadFactory } from '../../../hooks/v5/useLaunchpadFactory';
import { useDeployments } from '../../../hooks/useDeployments';
import { useNavigationStore } from '../../../store/useNavigationStore';
import { parseUnits, formatUnits } from 'viem';
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { MOCK_ERC20_ABI } from '../../../config/abis';
import { Coins, Zap, Clock, Shield, Check, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Drawer } from '../../ui/Drawer';
import { Button } from '../../ui/Button';

interface CreateMarketDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

// Mock adjudicator options
const ADJUDICATORS = [
    { id: 'manual', label: 'Manual Resolution', description: 'Market creator resolves', icon: '👤' },
    { id: 'chainlink', label: 'Chainlink Oracle', description: 'Price feed based', icon: '🔗', disabled: true },
    { id: 'uma', label: 'UMA Optimistic', description: 'Community verified', icon: '⚖️', disabled: true },
];

export const CreateMarketDrawer: React.FC<CreateMarketDrawerProps> = ({ isOpen, onClose }) => {
    const { setView } = useNavigationStore();
    const {
        createMarket, isPending, isConfirmed, txHash, tierDeposits, deployedMarketAddress,
        allowance, approveUSDC, isApprovePending, usdcBalance
    } = useLaunchpadFactory();
    const { config } = useDeployments();
    const { address: user } = useAccount();

    // Faucet Logic
    const { writeContract: mint, data: mintHash, isPending: isMintPending } = useWriteContract();
    const { isLoading: isMintConfirming } = useWaitForTransactionReceipt({ hash: mintHash });

    const [name, setName] = useState('');
    const [symbol, setSymbol] = useState('');
    const [description, setDescription] = useState('');
    const [tier, setTier] = useState(0);
    const [isFixed, setIsFixed] = useState(false);
    const [duration, setDuration] = useState('86400');
    const [adjudicator, setAdjudicator] = useState('manual');

    // MockUSDC has 18 decimals
    const DECIMALS = 18;

    const handleFaucet = () => {
        if (!config.contracts.MockUSDC || !user) return;
        mint({
            address: config.contracts.MockUSDC as `0x${string}`,
            abi: MOCK_ERC20_ABI,
            functionName: 'mint',
            args: [user, parseUnits('100000', DECIMALS)]
        });
        toast.promise(
            new Promise((resolve) => setTimeout(resolve, 5000)),
            { loading: 'Minting 100k USDC...', success: 'Minted!', error: 'Error' }
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !symbol) return;
        const durationSec = parseInt(duration);
        createMarket(name, symbol, description, tier, !isFixed, durationSec);
    };

    const handleViewMarket = () => {
        if (deployedMarketAddress) {
            setView('launchpad-market', deployedMarketAddress);
            onClose();
        }
    };

    const requiredDeposit = tierDeposits[tier] || 0n;
    const displayAmt = requiredDeposit ? Number(formatUnits(requiredDeposit, DECIMALS)).toLocaleString() : '0';
    const isApproved = allowance && allowance >= requiredDeposit;
    const hasBalance = usdcBalance && usdcBalance >= requiredDeposit;

    return (
        <Drawer isOpen={isOpen} onClose={onClose} title="🚀 Create Market" className="max-w-lg">
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Balance & Faucet Header */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-800">
                    <div>
                        <div className="text-xs text-slate-500 uppercase tracking-wide">Your Balance</div>
                        <div className="text-lg font-mono font-bold text-white">
                            ${usdcBalance ? Number(formatUnits(usdcBalance, DECIMALS)).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0.00'}
                        </div>
                    </div>
                    {(!usdcBalance || usdcBalance < parseUnits('10000', DECIMALS)) && (
                        <button
                            type="button"
                            onClick={handleFaucet}
                            disabled={isMintPending || isMintConfirming}
                            className="flex items-center gap-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/50 text-blue-300 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
                        >
                            <Coins size={16} />
                            <span className="text-sm font-medium">Faucet</span>
                        </button>
                    )}
                </div>

                {/* Market Question */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400">Market Question</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                        placeholder="Will ETH hit $10k in 2025?"
                        required
                    />
                </div>

                {/* Symbol */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400">Ticker Symbol</label>
                    <input
                        type="text"
                        value={symbol}
                        onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                        className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                        placeholder="ETH10K"
                        maxLength={6}
                        required
                    />
                </div>

                {/* Description */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400">Resolution Criteria</label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 h-20 resize-none"
                        placeholder="Market resolves YES if ETH spot price on Coinbase exceeds $10,000..."
                    />
                </div>

                {/* Adjudicator Selection (Mock) */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                        <Shield size={14} />
                        Resolution Method
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                        {ADJUDICATORS.map((adj) => (
                            <button
                                key={adj.id}
                                type="button"
                                onClick={() => !adj.disabled && setAdjudicator(adj.id)}
                                disabled={adj.disabled}
                                className={`flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${adjudicator === adj.id
                                    ? 'border-indigo-500 bg-indigo-500/10'
                                    : adj.disabled
                                        ? 'border-slate-800 bg-slate-900/30 opacity-50 cursor-not-allowed'
                                        : 'border-slate-700 bg-slate-900/50 hover:border-slate-600'
                                    }`}
                            >
                                <span className="text-2xl">{adj.icon}</span>
                                <div className="flex-1">
                                    <div className="font-medium text-white text-sm">{adj.label}</div>
                                    <div className="text-xs text-slate-500">{adj.description}</div>
                                </div>
                                {adjudicator === adj.id && <Check size={16} className="text-indigo-400" />}
                                {adj.disabled && <span className="text-[10px] text-slate-500">Coming Soon</span>}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Liquidity Tier */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                        <Zap size={14} />
                        Initial Liquidity
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        {[0, 1, 2, 3].map((t) => {
                            const deposit = tierDeposits[t];
                            const amt = deposit ? Number(formatUnits(deposit, DECIMALS)).toLocaleString() : '...';
                            return (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setTier(t)}
                                    className={`p-3 rounded-lg border transition-all ${tier === t
                                        ? 'border-emerald-500 bg-emerald-500/10'
                                        : 'border-slate-700 bg-slate-900/50 hover:border-slate-600'
                                        }`}
                                >
                                    <div className="font-bold text-white text-sm">Tier {t}</div>
                                    <div className="text-xs text-slate-400">${amt}</div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Duration */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                        <Clock size={14} />
                        Market Duration
                    </label>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setIsFixed(false)}
                            className={`flex-1 p-3 rounded-lg border transition-all ${!isFixed
                                ? 'border-indigo-500 bg-indigo-500/10'
                                : 'border-slate-700 bg-slate-900/50 hover:border-slate-600'
                                }`}
                        >
                            <div className="font-medium text-white text-sm">Open-Ended</div>
                            <div className="text-xs text-slate-500">No deadline</div>
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsFixed(true)}
                            className={`flex-1 p-3 rounded-lg border transition-all ${isFixed
                                ? 'border-indigo-500 bg-indigo-500/10'
                                : 'border-slate-700 bg-slate-900/50 hover:border-slate-600'
                                }`}
                        >
                            <div className="font-medium text-white text-sm">Fixed</div>
                            <div className="text-xs text-slate-500">Set deadline</div>
                        </button>
                    </div>
                    {isFixed && (
                        <select
                            value={duration}
                            onChange={(e) => setDuration(e.target.value)}
                            className="w-full p-3 mt-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                        >
                            <option value="3600">1 Hour</option>
                            <option value="86400">1 Day</option>
                            <option value="604800">1 Week</option>
                            <option value="2592000">1 Month</option>
                        </select>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="pt-4 border-t border-slate-800 space-y-3">
                    {!hasBalance ? (
                        <Button disabled className="w-full bg-red-900/50 border border-red-500/50 text-red-300">
                            Insufficient Balance (Need ${displayAmt})
                        </Button>
                    ) : !isApproved ? (
                        <Button
                            type="button"
                            onClick={approveUSDC}
                            disabled={isApprovePending}
                            className="w-full bg-yellow-600 hover:bg-yellow-500"
                        >
                            {isApprovePending ? (
                                <><Loader2 size={16} className="animate-spin mr-2" /> Approving...</>
                            ) : (
                                `Approve ${displayAmt} USDC`
                            )}
                        </Button>
                    ) : (
                        <Button
                            type="submit"
                            disabled={isPending || !name || !symbol}
                            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500"
                        >
                            {isPending ? (
                                <><Loader2 size={16} className="animate-spin mr-2" /> Creating Market...</>
                            ) : (
                                '🚀 Create Market'
                            )}
                        </Button>
                    )}

                    {/* Success State */}
                    {isConfirmed && deployedMarketAddress && (
                        <div className="p-4 rounded-lg bg-emerald-900/20 border border-emerald-500/50 text-center space-y-2">
                            <div className="text-emerald-400 font-bold">✓ Market Created!</div>
                            <Button
                                type="button"
                                onClick={handleViewMarket}
                                className="w-full bg-emerald-600 hover:bg-emerald-500"
                            >
                                View Market →
                            </Button>
                        </div>
                    )}
                </div>
            </form>
        </Drawer>
    );
};
