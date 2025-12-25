import React from 'react';
import { Link } from 'react-router-dom';
import { Coins, ExternalLink, Sparkles } from 'lucide-react';
import { useLPPositions } from '../../../hooks/useLPPositions';
import { formatCurrency } from '../../../utils/format';
import { PortfolioCard } from './PortfolioCard';
import uiContent from '../../../config/ui-content.json';

export const LPPositionsCard: React.FC = () => {
    const { positions, totalLPValueFormatted, isLoading } = useLPPositions();
    const totalValueNum = parseFloat(totalLPValueFormatted || '0');
    const t = uiContent.lp;

    return (
        <PortfolioCard
            title="LP Equity"
            icon={<Coins size={16} className="text-emerald-400" />}
            variant="emerald"
            badge={
                <div className="flex flex-col items-end">
                    <div className="text-xs font-black text-emerald-400 font-mono">
                        {isLoading && positions.length === 0 ? '--' : formatCurrency(totalValueNum)}
                    </div>
                    <div className="text-[7px] text-slate-500 font-black uppercase tracking-tighter leading-none mt-0.5">
                        AMM Rewards
                    </div>
                </div>
            }
            itemCount={positions.length}
            isLoading={isLoading && positions.length === 0}
            emptyState={
                <div className="py-6 text-center flex flex-col items-center justify-center opacity-40">
                    <Sparkles size={24} className="text-slate-600 mb-1" />
                    <p className="text-[10px] font-mono">{uiContent.common.noPositions}</p>
                </div>
            }
        >
                {positions.map((position) => (
                    <Link
                        key={position.marketAddress}
                        to={`/trade/${position.marketAddress}`}
                    className="block p-2.5 rounded-lg bg-slate-900/40 border border-slate-800/50 hover:bg-slate-800/40 transition-all group"
                    >
                    <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-bold text-[11px] text-white group-hover:text-emerald-300 transition-colors truncate">
                                    {position.marketName}
                                </span>
                            <ExternalLink size={8} className="text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        <div className="flex items-center gap-1 shrink-0">
                                {position.isGraduated ? (
                                <div className="text-[7px] px-1 py-0 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-black uppercase">Grad</div>
                                ) : (
                                <div className="text-[7px] px-1 py-0 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-black uppercase">Bond</div>
                                )}
                            </div>
                        </div>

                    <div className="grid grid-cols-4 gap-1.5 border-t border-slate-700/20 pt-1.5">
                            <div>
                            <div className="text-[7px] text-slate-500 uppercase font-black tracking-widest">LP</div>
                            <div className="font-mono text-[9px] text-white leading-none">
                                {parseFloat(position.lpBalanceFormatted).toFixed(2)}
                                </div>
                            </div>
                            <div>
                            <div className="text-[7px] text-slate-500 uppercase font-black tracking-widest">{t.floor}</div>
                            <div className="font-mono text-[9px] text-emerald-400 font-bold leading-none">
                                    {formatCurrency(parseFloat(position.floorValueFormatted))}
                            </div>
                                </div>
                            <div>
                            <div className="text-[7px] text-slate-500 uppercase font-black tracking-widest">{t.ceiling}</div>
                            <div className="font-mono text-[9px] text-slate-400 leading-none">
                                    {formatCurrency(parseFloat(position.ceilingValueFormatted))}
                            </div>
                                </div>
                        <div className="text-right">
                            <div className="text-[7px] text-slate-500 uppercase font-black tracking-widest">Own</div>
                            <div className="font-mono text-[9px] text-white font-bold leading-none">
                                {position.sharePercent.toFixed(1)}%
                                </div>
                            </div>
                        </div>
                    </Link>
                ))}
        </PortfolioCard>
    );
};
