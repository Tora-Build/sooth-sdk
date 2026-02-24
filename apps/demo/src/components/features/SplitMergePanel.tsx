/**
 * SplitMergePanel - Token transformation interface
 * 
 * Split: USDC → YES + NO (1:1:1 ratio)
 * Merge: YES + NO → USDC (requires equal amounts)
 * 
 * Design: Precision-instrument aesthetic with visual transformation metaphors
 */
import { useState, useEffect, useMemo } from 'react';
import { ArrowRight, ArrowDownUp, Zap, Loader2 } from 'lucide-react';
import { useAccount, useWriteContract, usePublicClient, useReadContract } from 'wagmi';
import { formatUnits, parseUnits, erc20Abi } from 'viem';
import toast from 'react-hot-toast';
import { cn } from '../../lib/utils';
import { useDeployments } from '../../hooks/useDeployments';
import { ABIS } from '../../config/abis';

interface SplitMergePanelProps {
    marketAddress: `0x${string}` | undefined;
    yesBalance: bigint;
    noBalance: bigint;
    vaultAvailable: bigint;
    onSuccess?: () => void;
}

type Mode = 'split' | 'merge';

export function SplitMergePanel({
    marketAddress,
    yesBalance,
    noBalance,
    vaultAvailable,
    onSuccess,
}: SplitMergePanelProps) {
    const { address, isConnected } = useAccount();
    const publicClient = usePublicClient();
    const deployments = useDeployments();
    const collateralizerAddress = deployments?.contracts?.Collateralizer as `0x${string}` | undefined;
    const usdcAddress = deployments?.contracts?.MockUSDC as `0x${string}` | undefined;

    const { writeContractAsync, isPending } = useWriteContract();
    const [mode, setMode] = useState<Mode>('split');
    const [inputValue, setInputValue] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Calculate max mergeable (minimum of YES and NO)
    const maxMergeable = useMemo(() => {
        return yesBalance < noBalance ? yesBalance : noBalance;
    }, [yesBalance, noBalance]);

    // Parse input amount
    const inputAmount = useMemo(() => {
        try {
            return inputValue ? parseUnits(inputValue, 18) : 0n;
        } catch {
            return 0n;
        }
    }, [inputValue]);

    // Read Allowance
    const { data: allowance, refetch: refetchAllowance } = useReadContract({
        address: usdcAddress,
        abi: erc20Abi,
        functionName: 'allowance',
        args: address && collateralizerAddress ? [address, collateralizerAddress] : undefined,
        query: { enabled: !!address && !!collateralizerAddress && !!usdcAddress },
    });

    const needsApproval = mode === 'split' && inputAmount > 0n && (allowance ?? 0n) < inputAmount;

    // Validation
    const isValidAmount = inputAmount > 0n;
    const canSplit = mode === 'split' && inputAmount <= vaultAvailable && isValidAmount;
    const canMerge = mode === 'merge' && inputAmount <= maxMergeable && isValidAmount;
    const canExecute = mode === 'split' ? canSplit : canMerge;

    // Handle approval
    const handleApprove = async () => {
        if (!usdcAddress || !collateralizerAddress) return;
        setIsSubmitting(true);
        const toastId = toast.loading('Approving USDC...');
        try {
            const hash = await writeContractAsync({
                address: usdcAddress,
                abi: erc20Abi,
                functionName: 'approve',
                args: [collateralizerAddress, inputAmount],
            });
            toast.loading('Confirming approval...', { id: toastId });
            if (publicClient) {
                await publicClient.waitForTransactionReceipt({ hash });
            }
            await refetchAllowance();
            toast.success('USDC Approved', { id: toastId });
        } catch (e: any) {
            toast.error(e?.shortMessage || 'Approval failed', { id: toastId });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle split
    const handleSplit = async () => {
        if (!marketAddress || !collateralizerAddress || !canSplit) return;

        setIsSubmitting(true);
        const toastId = toast.loading('Splitting into outcome tokens...');

        try {
            const hash = await writeContractAsync({
                address: collateralizerAddress,
                abi: ABIS.Collateralizer,
                functionName: 'split',
                args: [marketAddress, inputAmount],
            });

            toast.loading('Confirming...', { id: toastId });

            if (publicClient) {
                const receipt = await publicClient.waitForTransactionReceipt({ hash });
                if (receipt.status === 'reverted') {
                    toast.error('Transaction reverted', { id: toastId });
                    return;
                }
            }

            const formatted = parseFloat(formatUnits(inputAmount, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 });
            toast.success(
                <div className="flex flex-col">
                    <span className="font-semibold">Split complete</span>
                    <span className="text-xs opacity-80">${formatted} → {formatted} YES + {formatted} NO</span>
                </div>,
                { id: toastId }
            );
            setInputValue('');
            onSuccess?.();
        } catch (e: any) {
            const msg = e?.shortMessage || e?.message || 'Split failed';
            toast.error(msg, { id: toastId });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle merge
    const handleMerge = async () => {
        if (!marketAddress || !collateralizerAddress || !canMerge) return;

        setIsSubmitting(true);
        const toastId = toast.loading('Merging tokens into USDC...');

        try {
            const hash = await writeContractAsync({
                address: collateralizerAddress,
                abi: ABIS.Collateralizer,
                functionName: 'merge',
                args: [marketAddress, inputAmount],
            });

            toast.loading('Confirming...', { id: toastId });

            if (publicClient) {
                const receipt = await publicClient.waitForTransactionReceipt({ hash });
                if (receipt.status === 'reverted') {
                    toast.error('Transaction reverted', { id: toastId });
                    return;
                }
            }

            const formatted = parseFloat(formatUnits(inputAmount, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 });
            toast.success(
                <div className="flex flex-col">
                    <span className="font-semibold">Merge complete</span>
                    <span className="text-xs opacity-80">{formatted} YES + {formatted} NO → ${formatted}</span>
                </div>,
                { id: toastId }
            );
            setInputValue('');
            onSuccess?.();
        } catch (e: any) {
            const msg = e?.shortMessage || e?.message || 'Merge failed';
            toast.error(msg, { id: toastId });
        } finally {
            setIsSubmitting(false);
        }
    };

    const isLoading = isPending || isSubmitting;
    const maxAmount = mode === 'split' ? vaultAvailable : maxMergeable;
    const maxFormatted = parseFloat(formatUnits(maxAmount, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 });

    return (
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-slate-950/90 border border-slate-800/60">
            {/* Subtle background pattern */}
            <div className="absolute inset-0 opacity-[0.02]" style={{
                backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
                backgroundSize: '24px 24px',
            }} />

            <div className="relative p-4">
                {/* Header with mode toggle */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <ArrowDownUp className="w-4 h-4 text-slate-500" />
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Token Transform</span>
                    </div>

                    {/* Mode toggle - glass pill */}
                    <div className="flex bg-slate-800/40 rounded-full p-0.5 backdrop-blur-sm border border-slate-700/30">
                        <button
                            onClick={() => { setMode('split'); setInputValue(''); }}
                            className={cn(
                                "px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200",
                                mode === 'split'
                                    ? "bg-gradient-to-r from-cyan-500/90 to-blue-500/90 text-white shadow-lg shadow-cyan-500/20"
                                    : "text-slate-500 hover:text-slate-300"
                            )}
                        >
                            Split
                        </button>
                        <button
                            onClick={() => { setMode('merge'); setInputValue(''); }}
                            className={cn(
                                "px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200",
                                mode === 'merge'
                                    ? "bg-gradient-to-r from-violet-500/90 to-purple-500/90 text-white shadow-lg shadow-violet-500/20"
                                    : "text-slate-500 hover:text-slate-300"
                            )}
                        >
                            Merge
                        </button>
                    </div>
                </div>

                {/* Transformation visualization */}
                <div className="mb-4">
                    <div className={cn(
                        "flex items-center justify-center gap-3 py-4 px-4 rounded-lg transition-all duration-300",
                        mode === 'split'
                            ? "bg-gradient-to-r from-cyan-950/30 via-slate-900/50 to-emerald-950/30 border border-cyan-900/20"
                            : "bg-gradient-to-r from-emerald-950/30 via-slate-900/50 to-violet-950/30 border border-violet-900/20"
                    )}>
                        {mode === 'split' ? (
                            <>
                                {/* USDC source */}
                                <div className="flex flex-col items-center">
                                    <div className="text-2xl font-mono font-bold text-white">
                                        ${inputValue ? Math.floor(parseFloat(inputValue)).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0'}
                                    </div>
                                    <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-1">USDC</div>
                                </div>

                                {/* Arrow with pulse */}
                                <div className="flex flex-col items-center">
                                    <div className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                                        isValidAmount
                                            ? "bg-cyan-500/20 text-cyan-400 animate-pulse"
                                            : "bg-slate-800/50 text-slate-600"
                                    )}>
                                        <ArrowRight className="w-4 h-4" />
                                    </div>
                                </div>

                                {/* YES + NO destination */}
                                <div className="flex items-center gap-2">
                                    <div className="flex flex-col items-center">
                                        <div className="text-lg font-mono font-bold text-emerald-400">
                                            {inputValue ? Math.floor(parseFloat(inputValue)).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0'}
                                        </div>
                                        <div className="text-[10px] uppercase tracking-wider text-emerald-500/70 mt-1">YES</div>
                                    </div>
                                    <span className="text-slate-600 text-lg">+</span>
                                    <div className="flex flex-col items-center">
                                        <div className="text-lg font-mono font-bold text-rose-400">
                                            {inputValue ? Math.floor(parseFloat(inputValue)).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0'}
                                        </div>
                                        <div className="text-[10px] uppercase tracking-wider text-rose-500/70 mt-1">NO</div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* YES + NO source */}
                                <div className="flex items-center gap-2">
                                    <div className="flex flex-col items-center">
                                        <div className="text-lg font-mono font-bold text-emerald-400">
                                            {inputValue ? Math.floor(parseFloat(inputValue)).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0'}
                                        </div>
                                        <div className="text-[10px] uppercase tracking-wider text-emerald-500/70 mt-1">YES</div>
                                    </div>
                                    <span className="text-slate-600 text-lg">+</span>
                                    <div className="flex flex-col items-center">
                                        <div className="text-lg font-mono font-bold text-rose-400">
                                            {inputValue ? Math.floor(parseFloat(inputValue)).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0'}
                                        </div>
                                        <div className="text-[10px] uppercase tracking-wider text-rose-500/70 mt-1">NO</div>
                                    </div>
                                </div>

                                {/* Arrow with pulse */}
                                <div className="flex flex-col items-center">
                                    <div className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                                        isValidAmount
                                            ? "bg-violet-500/20 text-violet-400 animate-pulse"
                                            : "bg-slate-800/50 text-slate-600"
                                    )}>
                                        <ArrowRight className="w-4 h-4" />
                                    </div>
                                </div>

                                {/* USDC destination */}
                                <div className="flex flex-col items-center">
                                    <div className="text-2xl font-mono font-bold text-white">
                                        ${inputValue ? Math.floor(parseFloat(inputValue)).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0'}
                                    </div>
                                    <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-1">USDC</div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Input section */}
                <div className="space-y-3">
                    <div className="relative">
                        <input
                            type="number"
                            placeholder="0"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            disabled={isLoading}
                            className={cn(
                                "w-full px-4 py-3 pr-20 rounded-lg font-mono text-lg",
                                "bg-slate-950/70 border transition-all focus:outline-none",
                                inputValue && !canExecute
                                    ? "border-rose-500/50 focus:border-rose-500"
                                    : "border-slate-700/50 focus:border-slate-500",
                                "placeholder:text-slate-700"
                            )}
                        />
                        <button
                            onClick={() => setInputValue(Math.floor(parseFloat(formatUnits(maxAmount, 18))).toString())}
                            disabled={isLoading || maxAmount === 0n}
                            className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 text-xs font-bold rounded bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-50"
                        >
                            MAX
                        </button>
                    </div>

                    {/* Max available hint */}
                    <div className="flex justify-between text-xs text-slate-500">
                        <span>
                            {mode === 'split' ? 'Available:' : 'Max mergeable:'}
                        </span>
                        <span className="font-mono">
                            {maxFormatted} {mode === 'split' ? 'USDC' : 'pairs'}
                        </span>
                    </div>

                    {/* Execute button */}
                    <button
                        onClick={needsApproval ? handleApprove : (mode === 'split' ? handleSplit : handleMerge)}
                        disabled={(!needsApproval && !canExecute) || isLoading || !isConnected}
                        className={cn(
                            "w-full py-3 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2",
                            ((!needsApproval && !canExecute) || isLoading || !isConnected)
                                ? "bg-slate-800/50 text-slate-600 cursor-not-allowed"
                                : needsApproval
                                    ? "bg-slate-700 hover:bg-slate-600 text-white"
                                    : mode === 'split'
                                        ? "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20"
                                        : "bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-lg shadow-violet-500/20"
                        )}
                    >
                        {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : needsApproval ? (
                            'Approve USDC'
                        ) : (
                            <>
                                <Zap className="w-4 h-4" />
                                {mode === 'split' ? 'Split into Tokens' : 'Merge to USDC'}
                            </>
                        )}
                    </button>
                </div>

                {/* Info footer */}
                <div className="mt-4 pt-3 border-t border-slate-800/50">
                    <p className="text-[10px] text-slate-600 text-center">
                        {mode === 'split'
                            ? '1 USDC mints 1 YES and 1 NO token. Use to acquire positions without trading.'
                            : 'Requires equal amounts of YES and NO. Returns 1 USDC per pair.'
                        }
                    </p>
                </div>
            </div>
        </div>
    );
}
