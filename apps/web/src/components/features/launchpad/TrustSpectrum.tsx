import { useState } from 'react';
import { Lock, Zap, Users, User, ChevronDown, ChevronUp, Shield } from 'lucide-react';
import { cn } from '../../../lib/utils';

export type AdjudicatorType = 'zk-rule' | 'zk-oracle' | 'optimistic' | 'multisig' | 'self';

interface TrustLevel {
    id: AdjudicatorType;
    name: string;
    icon: typeof Lock;
    trustLabel: string;
    trustColor: string;
    description: string;
    details: string;
    position: number;
}

const TRUST_LEVELS: TrustLevel[] = [
    {
        id: 'zk-rule',
        name: 'ZK-Rule',
        icon: Lock,
        trustLabel: 'Trustless',
        trustColor: 'text-emerald-400',
        description: 'Pure math. Proves on-chain conditions.',
        details: 'Uses ZK proofs to verify on-chain data like price feeds or events. No human involvement. Example: "BTC > $100k" via Chainlink.',
        position: 0
    },
    {
        id: 'zk-oracle',
        name: 'ZK-Oracle',
        icon: Lock,
        trustLabel: 'Trustless',
        trustColor: 'text-emerald-400',
        description: 'Aggregated data + ZK proof.',
        details: 'Computes complex conditions off-chain (like 7-day TWAP), then proves result. Still trustless - math verifies everything.',
        position: 1
    },
    {
        id: 'optimistic',
        name: 'Optimistic',
        icon: Zap,
        trustLabel: 'Challengeable',
        trustColor: 'text-yellow-400',
        description: 'Fast resolution + challenge window.',
        details: 'Resolution posted quickly, then 24h challenge period. If disputed, falls back to ZK proof. Good for subjective events.',
        position: 2
    },
    {
        id: 'multisig',
        name: 'Multisig',
        icon: Users,
        trustLabel: '3-of-5 Signers',
        trustColor: 'text-orange-400',
        description: 'Human committee decides.',
        details: 'Trusted committee of 5 members. Requires 3 signatures to resolve. Best for off-chain data or private outcomes.',
        position: 3
    },
    {
        id: 'self',
        name: 'Self',
        icon: User,
        trustLabel: 'Creator Trust',
        trustColor: 'text-red-400',
        description: 'You resolve your own market.',
        details: 'Full control but requires your reputation. Traders must trust you to resolve honestly. Best for community/personal markets.',
        position: 4
    }
];

interface TrustSpectrumProps {
    selected: AdjudicatorType;
    onSelect: (type: AdjudicatorType) => void;
    compact?: boolean;
}

export const TrustSpectrum = ({ selected, onSelect, compact = false }: TrustSpectrumProps) => {
    const [expanded, setExpanded] = useState<AdjudicatorType | null>(null);
    const selectedLevel = TRUST_LEVELS.find(l => l.id === selected) || TRUST_LEVELS[0];

    if (compact) {
        return (
            <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                    <span className="text-white/50 uppercase font-bold tracking-wider flex items-center gap-2">
                        <Shield className="w-3 h-3" />
                        Trust Model
                    </span>
                    <span className={cn("font-bold", selectedLevel.trustColor)}>
                        {selectedLevel.trustLabel}
                    </span>
                </div>
                
                <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
                    <div 
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 via-yellow-500 to-red-500 rounded-full"
                        style={{ width: '100%' }}
                    />
                    <div 
                        className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg border-2 border-white transition-all duration-300"
                        style={{ left: `${(selectedLevel.position / 4) * 100}%`, transform: 'translate(-50%, -50%)' }}
                    />
                </div>
                
                <div className="flex justify-between text-[10px] text-white/40">
                    <span>Trustless</span>
                    <span>Trust Required</span>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white/70 uppercase tracking-wider flex items-center gap-2">
                    <Shield className="w-4 h-4 text-cyan-400" />
                    Trust Spectrum
                </h4>
                <span className={cn("text-sm font-bold", selectedLevel.trustColor)}>
                    {selectedLevel.trustLabel}
                </span>
            </div>

            <div className="relative">
                <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full w-full bg-gradient-to-r from-emerald-500 via-yellow-500 to-red-500 opacity-30" />
                </div>
                
                <div className="absolute inset-0 flex justify-between items-center px-1">
                    {TRUST_LEVELS.map((level) => (
                        <button
                            key={level.id}
                            onClick={() => onSelect(level.id)}
                            className={cn(
                                "w-5 h-5 rounded-full border-2 transition-all duration-300",
                                selected === level.id
                                    ? "bg-white border-white scale-125 shadow-lg"
                                    : "bg-white/20 border-white/40 hover:bg-white/40 hover:scale-110"
                            )}
                            title={level.name}
                        />
                    ))}
                </div>
            </div>

            <div className="flex justify-between text-[10px] text-white/40 px-1">
                <span>TRUSTLESS</span>
                <span>TRUST REQUIRED</span>
            </div>

            <div className="space-y-2">
                {TRUST_LEVELS.map((level) => {
                    const Icon = level.icon;
                    const isSelected = selected === level.id;
                    const isExpanded = expanded === level.id;

                    return (
                        <div
                            key={level.id}
                            className={cn(
                                "rounded-xl border transition-all duration-300",
                                isSelected
                                    ? "bg-white/10 border-white/30"
                                    : "bg-white/5 border-white/10 hover:bg-white/[0.07]"
                            )}
                        >
                            <button
                                onClick={() => {
                                    onSelect(level.id);
                                    setExpanded(isExpanded ? null : level.id);
                                }}
                                className="w-full p-3 flex items-center gap-3"
                            >
                                <div className={cn(
                                    "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                                    isSelected ? "bg-white/20" : "bg-white/10"
                                )}>
                                    <Icon className={cn("w-4 h-4", level.trustColor)} />
                                </div>
                                
                                <div className="flex-1 text-left">
                                    <div className="flex items-center gap-2">
                                        <span className={cn(
                                            "font-bold text-sm",
                                            isSelected ? "text-white" : "text-white/70"
                                        )}>
                                            {level.name}
                                        </span>
                                        <span className={cn(
                                            "text-[10px] px-2 py-0.5 rounded-full",
                                            isSelected 
                                                ? `${level.trustColor} bg-white/10` 
                                                : "text-white/40 bg-white/5"
                                        )}>
                                            {level.trustLabel}
                                        </span>
                                    </div>
                                    <p className="text-xs text-white/50 mt-0.5">{level.description}</p>
                                </div>

                                <div className={cn(
                                    "w-5 h-5 rounded-full flex items-center justify-center",
                                    isSelected ? "bg-white/20" : "bg-transparent"
                                )}>
                                    {isExpanded ? (
                                        <ChevronUp className="w-4 h-4 text-white/50" />
                                    ) : (
                                        <ChevronDown className="w-4 h-4 text-white/50" />
                                    )}
                                </div>
                            </button>

                            {isExpanded && (
                                <div className="px-3 pb-3 pt-0">
                                    <div className="p-3 rounded-lg bg-white/5 text-xs text-white/60 leading-relaxed">
                                        {level.details}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
