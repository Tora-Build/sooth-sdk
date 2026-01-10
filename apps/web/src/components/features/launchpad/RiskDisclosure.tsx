import { useState } from 'react';
import { AlertTriangle, Shield, TrendingDown, Bug, Calculator, CheckCircle, ChevronDown } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface RiskItem {
    id: string;
    title: string;
    description: string;
    likelihood: 'low' | 'medium' | 'high';
    impact: 'low' | 'medium' | 'high' | 'critical';
    mitigation: string;
}

const CREATOR_RISKS: RiskItem[] = [
    {
        id: 'low-volume',
        title: 'Low Volume Risk',
        description: 'Your market may not attract sufficient traders.',
        likelihood: 'medium',
        impact: 'high',
        mitigation: 'Choose trending topics and promote your market actively.'
    },
    {
        id: 'settlement',
        title: 'Settlement Imbalance',
        description: 'LP value depends on the distribution of YES/NO positions at settlement.',
        likelihood: 'low',
        impact: 'medium',
        mitigation: 'LP floor formula guarantees a minimum redemption value.'
    },
    {
        id: 'smart-contract',
        title: 'Smart Contract Risk',
        description: 'All DeFi protocols carry inherent smart contract risk.',
        likelihood: 'low',
        impact: 'critical',
        mitigation: 'Sooth Protocol has been audited. Only deposit what you can afford to lose.'
    }
];

const getLikelihoodColor = (likelihood: string) => {
    switch (likelihood) {
        case 'low': return 'text-emerald-400 bg-emerald-500/10';
        case 'medium': return 'text-yellow-400 bg-yellow-500/10';
        case 'high': return 'text-red-400 bg-red-500/10';
        default: return 'text-white/50 bg-white/5';
    }
};

const getImpactColor = (impact: string) => {
    switch (impact) {
        case 'low': return 'text-emerald-400';
        case 'medium': return 'text-yellow-400';
        case 'high': return 'text-orange-400';
        case 'critical': return 'text-red-400';
        default: return 'text-white/50';
    }
};

interface RiskDisclosureProps {
    className?: string;
    collapsed?: boolean;
}

export const RiskDisclosure = ({ className, collapsed = false }: RiskDisclosureProps) => {
    const [isOpen, setIsOpen] = useState(!collapsed);
    
    return (
        <div className={cn("", className)}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/30 flex items-center justify-center">
                        <AlertTriangle className="w-4 h-4 text-orange-400" />
                    </div>
                    <div className="text-left">
                        <h3 className="text-sm font-bold text-white">Risk Disclosure</h3>
                        <p className="text-[10px] text-white/50">Understand before you launch</p>
                    </div>
                </div>
                <ChevronDown className={cn(
                    "w-5 h-5 text-white/40 transition-transform",
                    isOpen && "rotate-180"
                )} />
            </button>

            {isOpen && (
                <div className="mt-3 space-y-3">
                    {CREATOR_RISKS.map((risk) => (
                        <div
                            key={risk.id}
                            className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        {risk.impact === 'critical' ? (
                                            <Bug className="w-4 h-4 text-red-400" />
                                        ) : risk.id === 'low-volume' ? (
                                            <TrendingDown className="w-4 h-4 text-yellow-400" />
                                        ) : (
                                            <Shield className="w-4 h-4 text-blue-400" />
                                        )}
                                        <span className="font-bold text-white text-sm">{risk.title}</span>
                                    </div>
                                    <p className="text-xs text-white/60 mt-1">{risk.description}</p>
                                </div>
                                
                                <div className="flex flex-col items-end gap-1 shrink-0">
                                    <span className={cn(
                                        "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase",
                                        getLikelihoodColor(risk.likelihood)
                                    )}>
                                        {risk.likelihood}
                                    </span>
                                    <span className={cn(
                                        "text-[10px] font-bold uppercase",
                                        getImpactColor(risk.impact)
                                    )}>
                                        {risk.impact} impact
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-start gap-2 p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                                <Shield className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                                <p className="text-[10px] text-emerald-300">
                                    <span className="font-bold">Mitigation:</span> {risk.mitigation}
                                </p>
                            </div>
                        </div>
                    ))}

                    <div className="p-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 space-y-3">
                        <div className="flex items-center gap-2">
                            <Calculator className="w-4 h-4 text-blue-400" />
                            <span className="font-bold text-white text-sm">LP Floor Protection</span>
                        </div>
                        
                        <p className="text-xs text-white/60">
                            Your LP tokens have a guaranteed minimum value based on the floor formula:
                        </p>

                        <div className="p-3 rounded-lg bg-black/30 font-mono text-sm">
                            <span className="text-blue-300">Floor</span>
                            <span className="text-white/50"> = </span>
                            <span className="text-emerald-300">Cash</span>
                            <span className="text-white/50"> - </span>
                            <span className="text-orange-300">max(qYes, qNo)</span>
                        </div>

                        <p className="text-xs text-white/50">
                            Even in the worst-case scenario (all winners redeem), LPs are guaranteed at least the floor value.
                        </p>
                    </div>

                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                        <p className="text-xs text-white/70 font-bold uppercase tracking-wider">
                            By launching a market, you acknowledge:
                        </p>
                        
                        <div className="space-y-1">
                            {[
                                "LP tokens are not guaranteed to profit",
                                "Your deposit seeds liquidity for traders",
                                "Smart contract risks exist despite audits"
                            ].map((item, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs text-white/60">
                                    <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
                                    <span>{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
