import React from 'react';
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
    const feeLabel = isGraduated ? 'Graduated — no LP minting on trades' : 'Bonding — trades mint LP';

    return (
        <Card className="bg-slate-950/50 border-slate-800 p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                    <CircleDollarSign className="w-5 h-5 text-emerald-500" />
                    <h2 className="text-lg font-heading font-bold text-white">LP Holders</h2>
                </div>
                <HelpCircle className="w-4 h-4 text-slate-600" />
            </div>

            {/* Phase Note */}
            <div className="text-[9px] text-slate-400 bg-slate-900/20 border border-slate-800/60 rounded-lg px-3 py-2 leading-snug">
                <div className="flex items-center justify-between gap-3">
                    <span className="uppercase tracking-wider font-bold text-slate-500">Fee Mode</span>
                    <span className={cn("font-mono text-[9px] whitespace-nowrap", isGraduated ? "text-emerald-400" : "text-cyan-400")}>
                        {feeLabel}
                    </span>
                </div>
                <div className="mt-1 text-slate-500">
                    {isGraduated ? (
                        <span>
                            Fees go to <strong>b-growth</strong>, <strong>LP yield</strong>, and <strong>protocol</strong>. LP changes only from bonding LP or redemptions.
                        </span>
                    ) : (
                        <span>
                            Fees mint LP to the <strong>trader</strong>. Trade during bonding to earn LP.
                        </span>
                    )}
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
                        </div>
                        <div className="text-slate-500 font-mono">
                            {fmtUsd(userCeilingVal)}
                        </div>
                    </div>
                </div>
            )}

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
