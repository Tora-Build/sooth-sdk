import React, { useState } from 'react';
import { Card } from '../../ui/Card';
import { useLaunchpadMarketDirect, useV8DirectRead, readContractSafe } from '../../../hooks/v8';
import { useMarketStatsMath } from '../../../hooks/v8/useMarketStatsMath';
import { useDeployments } from '../../../hooks/useDeployments';
import { ERC20_ABI, V8_ABIS } from '../../../config/abis';
import { formatUnits } from 'viem';
import { CircleDollarSign, HelpCircle } from 'lucide-react';
import { useChainStore } from '../../../store/useChainStore';
import { useAccount, useReadContract } from 'wagmi';
import { cn } from '../../../lib/utils';
import { Badge } from '../../ui/Badge';

const GRADUATED_HINT = `In graduated mode, trading fees are split three ways: (1) b-growth increases liquidity depth, (2) LP yield accrues to existing LP holders, and (3) protocol fee. No new LP tokens are minted from trades — your LP share only changes if you bond more LP or redeem.`;

const BONDING_HINT = `In bonding mode, every trade you make earns you LP tokens as a reward. The more you trade during bonding, the larger your LP position becomes. Once the market graduates, LP minting stops and your position is locked in. Early traders get the biggest LP allocation.`;

interface LPHoldersProps {
    marketAddress: `0x${string}`;
}

export const LPHolders: React.FC<LPHoldersProps> = ({ marketAddress }) => {
    const { selectedChainId } = useChainStore();
    const { address } = useAccount();
    const chainId = typeof selectedChainId === 'number' ? selectedChainId : Number(selectedChainId);
    const deployments = useDeployments();
    const ammEngineAddress = deployments?.contracts?.AMMEngine as `0x${string}`;

    // 1. Get Launchpad Data (includes userLpBalance)
    const { launchpad } = useLaunchpadMarketDirect(marketAddress);

    // 1.5. Fetch creator's actual LP balance
    const launchpadEngineAddress = deployments?.contracts?.LaunchpadEngine as `0x${string}`;
    const { data: creatorLpBalance } = useV8DirectRead({
        queryKey: ['v8', 'creatorLpBalance', chainId, launchpadEngineAddress, marketAddress, launchpad?.creator],
        enabled: !!marketAddress && !!chainId && !!launchpadEngineAddress && !!launchpad?.creator,
        chainId,
        read: async (client) => {
            const balance = await readContractSafe<bigint>(client, {
                address: launchpadEngineAddress!,
                abi: V8_ABIS.LaunchpadEngine,
                functionName: 'getLPBalance',
                args: [marketAddress, launchpad!.creator as `0x${string}`],
            });
            return balance ?? 0n;
        },
    });

    // 2. USDC Decimals
    const { data: usdcDecimals } = useReadContract({
        address: deployments?.contracts?.MockUSDC as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'decimals',
        query: { enabled: !!deployments?.contracts?.MockUSDC, staleTime: Infinity, refetchInterval: false },
    });
    const decimals = Number(usdcDecimals ?? 18);

    // 3. Get AMM State (qYes, qNo for Ceiling Calc)
    const { data: ammState } = useV8DirectRead({
        queryKey: ['v8', 'ammState', chainId, ammEngineAddress, marketAddress],
        enabled: !!marketAddress && !!chainId && !!ammEngineAddress,
        chainId,
        read: async (client) => {
            const [qYes, qNo, price] = await readContractSafe<readonly [bigint, bigint, bigint]>(client, {
                address: ammEngineAddress!,
                abi: V8_ABIS.AMMEngine,
                functionName: 'getMarketState',
                args: [marketAddress],
            });
            return { qYes, qNo, price };
        },
    });

    // 4. Math
    const stats = useMarketStatsMath(launchpad as any, ammState, decimals);

    // Hint state - must be before early return to satisfy Rules of Hooks
    const [showHint, setShowHint] = useState(false);

    if (!launchpad || !stats) {
        return null;
    }

    // User LP
    const hasUserLp = launchpad.userLpBalance && launchpad.userLpBalance > 0n;
    const userLP = launchpad.userLpBalance ?? 0n;
    const userLpNum = Number(formatUnits(userLP, 18));
    const userFloorVal = userLpNum * stats.floorRate;
    const userCeilingVal = userLpNum * stats.ceilingRate;

    // Creator LP - use actual fetched balance, not total supply
    const creatorLP = creatorLpBalance ?? 0n;
    const creatorLpNum = Number(formatUnits(creatorLP, 18));
    const creatorFloorVal = creatorLpNum * stats.floorRate;
    const creatorCeilingVal = creatorLpNum * stats.ceilingRate;
    
    // Total LP for market floor/ceiling display
    const totalLpNum = Number(formatUnits(launchpad.lpSupply, 18));
    const marketFloorVal = totalLpNum * stats.floorRate;
    const marketCeilingVal = totalLpNum * stats.ceilingRate;

    // Share percentages (now that all values are defined)
    const userSharePct = totalLpNum > 0 ? (userLpNum / totalLpNum) * 100 : 0;
    const creatorSharePct = totalLpNum > 0 ? (creatorLpNum / totalLpNum) * 100 : 0;

    // LP Yield Pool (USDC decimals) - only accrues post-graduation
    const lpYieldPool = launchpad.lpYieldPool ?? 0n;
    const lpYieldPoolNum = Number(formatUnits(lpYieldPool, decimals));
    const userYieldShare = totalLpNum > 0 ? (userLpNum / totalLpNum) * lpYieldPoolNum : 0;
    const creatorYieldShare = totalLpNum > 0 ? (creatorLpNum / totalLpNum) * lpYieldPoolNum : 0;

    // Formatters
    const fmtUsd = (val: number) => {
        if (val > 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(2)}B`;
        if (val > 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
        return val.toLocaleString('en-US', { 
            style: 'currency', 
            currency: 'USD',
            maximumFractionDigits: 0 
        });
    };
    const fmtLp = (val: number) => val.toLocaleString(undefined, { 
        minimumFractionDigits: 0, 
        maximumFractionDigits: 0 
    });

    const isCreator = address && launchpad.creator.toLowerCase() === address.toLowerCase();
    const isGraduated = !!launchpad.isGraduated;
    const feeLabel = isGraduated ? 'Graduated' : 'Bonding';

    return (
        <Card className="bg-slate-950/50 border-slate-800 p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                    <CircleDollarSign className="w-5 h-5 text-emerald-500" />
                    <h2 className="text-lg font-heading font-bold text-white">LP Holders</h2>
                </div>
                
                {/* Fee Mode Badge + Hint */}
                <div className="flex items-center gap-2">
                    <span className={cn(
                        "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider",
                        isGraduated 
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
                            : "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                    )}>
                        {feeLabel}
                    </span>
                    
                    {/* Hint icon */}
                    <div className="relative">
                        <button
                            onMouseEnter={() => setShowHint(true)}
                            onMouseLeave={() => setShowHint(false)}
                            onClick={() => setShowHint(!showHint)}
                            className="p-1 rounded-full text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-colors"
                        >
                            <HelpCircle className="w-3.5 h-3.5" />
                        </button>
                        
                        {showHint && (
                            <div className="absolute right-0 top-full mt-2 z-50 w-72 p-3 bg-slate-900 border border-slate-700 rounded-lg shadow-xl">
                                <p className="text-[10px] text-slate-300 leading-relaxed">
                                    {isGraduated ? GRADUATED_HINT : BONDING_HINT}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Header Row */}
            <div className="flex justify-between text-[10px] uppercase font-bold text-slate-500 tracking-wider px-2">
                <div>LP Holder / Share</div>
                <div>Floor / Ceiling</div>
            </div>

            {/* Creator Row (Always show if it's the primary holder) */}
            <div className="bg-slate-900/40 rounded-lg p-4 border border-slate-800/50 group hover:border-emerald-500/30 transition-colors">
                <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                        <span className="font-mono text-white text-sm">
                            {launchpad.creator.slice(0, 6)}...{launchpad.creator.slice(-4)}
                        </span>
                        <Badge variant="warning" className="text-[10px] h-5 py-0">Creator</Badge>
                        {isCreator && <Badge variant="success" className="text-[10px] h-5 py-0 bg-emerald-950 text-emerald-400 border-emerald-900">You</Badge>}
                    </div>
                    <div className="text-right">
                        <div className="font-mono text-emerald-400 font-bold">{fmtUsd(creatorFloorVal)}</div>
                    </div>
                </div>

                <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2 text-slate-400">
                        <span>{fmtLp(creatorLpNum)} LP</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-emerald-500 font-bold">{creatorSharePct.toFixed(0)}%</span>
                        {creatorYieldShare > 0 && (
                            <>
                                <span className="text-slate-600">•</span>
                                <span className="text-amber-500">+{fmtUsd(creatorYieldShare)} yield</span>
                            </>
                        )}
                    </div>
                    <div className="text-slate-500 font-mono">
                        {fmtUsd(creatorCeilingVal)}
                    </div>
                </div>
            </div>

            {/* User Row (Only if user is NOT the creator but has balance) */}
            {hasUserLp && !isCreator && (
                <div className="bg-slate-900/40 rounded-lg p-4 border border-slate-800/50 group hover:border-emerald-500/30 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-white text-sm">
                                {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Unknown'}
                            </span>
                            <Badge variant="success" className="text-[10px] h-5 py-0 bg-emerald-950 text-emerald-400 border-emerald-900">You</Badge>
                        </div>
                        <div className="text-right">
                            <div className="font-mono text-emerald-400 font-bold">{fmtUsd(userFloorVal)}</div>
                        </div>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2 text-slate-400">
                            <span>{fmtLp(userLpNum)} LP</span>
                            <span className="text-slate-600">•</span>
                            <span className="text-emerald-500 font-bold">{userSharePct.toFixed(0)}%</span>
                            {userYieldShare > 0 && (
                                <>
                                    <span className="text-slate-600">•</span>
                                    <span className="text-amber-500">+{fmtUsd(userYieldShare)} yield</span>
                                </>
                            )}
                        </div>
                        <div className="text-slate-500 font-mono">
                            {fmtUsd(userCeilingVal)}
                        </div>
                    </div>
                </div>
            )}

            {/* LP Yield Pool */}
            <div className="bg-gradient-to-r from-amber-950/30 to-slate-900/30 rounded-lg p-4 border border-amber-900/30">
                <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-amber-500 uppercase tracking-wider">LP Yield Pool</span>
                        {!isGraduated && (
                            <span className="text-[9px] text-slate-500 bg-slate-800/50 px-1.5 py-0.5 rounded">
                                Accrues post-grad
                            </span>
                        )}
                    </div>
                    <span className={cn(
                        "text-lg font-bold font-mono",
                        lpYieldPoolNum > 0 ? "text-amber-400" : "text-slate-600"
                    )}>
                        {fmtUsd(lpYieldPoolNum)}
                    </span>
                </div>
                
                {/* User's yield share */}
                {(hasUserLp || isCreator) && lpYieldPoolNum > 0 && (
                    <div className="flex justify-between items-center text-xs pt-2 border-t border-amber-900/20">
                        <span className="text-slate-400">Your share ({(isCreator ? creatorSharePct : userSharePct).toFixed(1)}%)</span>
                        <span className="text-amber-400 font-mono font-bold">
                            {fmtUsd(isCreator ? creatorYieldShare : userYieldShare)}
                        </span>
                    </div>
                )}
                
                {lpYieldPoolNum === 0 && (
                    <div className="text-[10px] text-slate-500 italic">
                        {isGraduated 
                            ? 'No yield accrued yet — yield accumulates from post-graduation trading fees.'
                            : 'Yield pool is empty during bonding. LP yield accrues only after graduation.'}
                    </div>
                )}
            </div>

            {/* Stats Summary - Shows TOTAL market values, not just creator */}
            <div className="bg-slate-900/20 rounded-lg p-4 border border-slate-800/30">
                <div className="flex justify-between items-baseline mb-1">
                    <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Market Floor</span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">Ceiling Value</span>
                </div>
                <div className="flex justify-between items-baseline mb-4">
                    <span className="text-2xl font-bold text-emerald-400 tracking-tight">{fmtUsd(marketFloorVal)}</span>
                    <span className="text-xl font-bold text-white tracking-tight">{fmtUsd(marketCeilingVal)}</span>
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-slate-800/50 text-xs font-mono">
                    <span className="text-slate-400">Total: {fmtLp(totalLpNum)} LP</span>
                    <span className="text-emerald-500">100% Accounted</span>
                </div>
            </div>

        </Card>
    );
};
