import { useState } from 'react';
import { CheckCircle, AlertTriangle, ChevronDown, ChevronUp, Shield } from 'lucide-react';
import { Address } from 'viem';
import { cn } from '../../lib/utils';
import {
    AdjudicatorOption,
    GuardianOption,
    getTrustColor,
    getTrustBgColor
} from '../../config/registries';

interface AddressSelectorProps {
    label: string;
    icon: any;
    options: (AdjudicatorOption | GuardianOption)[];
    selectedMode: 'registry' | 'custom';
    setSelectedMode: (m: 'registry' | 'custom') => void;
    selectedRegistryId: string;
    setSelectedRegistryId: (id: string) => void;
    customAddress: string;
    setCustomAddress: (addr: string) => void;
    userAddress?: Address;
    showTrustSpectrum?: boolean;
}

const isAdjudicatorOption = (opt: AdjudicatorOption | GuardianOption): opt is AdjudicatorOption => {
    return 'trustModel' in opt;
};

export const AddressSelector = ({
    label,
    icon: Icon,
    options,
    selectedMode,
    setSelectedMode,
    selectedRegistryId,
    setSelectedRegistryId,
    customAddress,
    setCustomAddress,
    userAddress,
    showTrustSpectrum = false
}: AddressSelectorProps) => {
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const selectedOption = options.find(o => o.id === selectedRegistryId);
    const isAdjudicator = options.length > 0 && isAdjudicatorOption(options[0]);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-white/70 flex items-center gap-2">
                    <Icon className="w-4 h-4 text-cyan-400" />
                    {label}
                </label>
                <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                    <button
                        onClick={() => setSelectedMode('registry')}
                        className={cn(
                            "px-3 py-1.5 text-xs font-bold rounded-lg transition-all",
                            selectedMode === 'registry'
                                ? "bg-cyan-500/20 text-cyan-400 shadow-sm"
                                : "text-white/40 hover:text-white/60"
                        )}
                    >
                        Registry
                    </button>
                    <button
                        onClick={() => setSelectedMode('custom')}
                        className={cn(
                            "px-3 py-1.5 text-xs font-bold rounded-lg transition-all",
                            selectedMode === 'custom'
                                ? "bg-amber-500/20 text-amber-400 shadow-sm"
                                : "text-white/40 hover:text-white/60"
                        )}
                    >
                        Custom
                    </button>
                </div>
            </div>

            {showTrustSpectrum && isAdjudicator && selectedOption && isAdjudicatorOption(selectedOption) && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-center gap-2 text-xs text-white/50">
                        <Shield className="w-3 h-3" />
                        <span className="uppercase font-bold tracking-wider">Trust Model</span>
                    </div>
                    <span className={cn("text-sm font-bold", getTrustColor(selectedOption.trustModel))}>
                        {selectedOption.trustModel}
                    </span>
                </div>
            )}

            {selectedMode === 'registry' ? (
                <div className="space-y-2">
                    {options.map((opt) => {
                        const isSelected = selectedRegistryId === opt.id;
                        const isExpanded = expandedId === opt.id;
                        const isAdj = isAdjudicatorOption(opt);
                        const OptIcon = isAdj ? opt.icon : Icon;

                        return (
                            <div
                                key={opt.id}
                                className={cn(
                                    "rounded-xl border transition-all overflow-hidden",
                                    isSelected
                                        ? "bg-cyan-500/10 border-cyan-500/30 shadow-lg shadow-cyan-500/10"
                                        : "bg-white/5 border-white/10 hover:bg-white/[0.07] hover:border-white/20"
                                )}
                            >
                                <button
                                    onClick={() => {
                                        setSelectedRegistryId(opt.id);
                                        if (opt.address !== 'SELF') {
                                            setCustomAddress(opt.address as string);
                                        } else if (userAddress) {
                                            setCustomAddress(userAddress);
                                        }
                                    }}
                                    className="w-full p-4 flex items-start gap-3 text-left"
                                >
                                    <div className={cn(
                                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                                        isSelected
                                            ? "bg-cyan-500/20"
                                            : isAdj
                                                ? getTrustBgColor(opt.trustModel)
                                                : "bg-white/10"
                                    )}>
                                        <OptIcon className={cn(
                                            "w-5 h-5",
                                            isSelected
                                                ? "text-cyan-400"
                                                : isAdj
                                                    ? getTrustColor(opt.trustModel)
                                                    : "text-white/50"
                                        )} />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={cn(
                                                "font-bold text-sm",
                                                isSelected ? "text-white" : "text-white/80"
                                            )}>
                                                {opt.name}
                                            </span>
                                            {opt.badge && (
                                                <span className={cn(
                                                    "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase",
                                                    isSelected
                                                        ? "bg-cyan-500/20 text-cyan-300"
                                                        : "bg-white/10 text-white/40"
                                                )}>
                                                    {opt.badge}
                                                </span>
                                            )}
                                            {isAdj && (
                                                <span className={cn(
                                                    "text-[10px] px-2 py-0.5 rounded-full font-bold",
                                                    getTrustBgColor(opt.trustModel),
                                                    getTrustColor(opt.trustModel)
                                                )}>
                                                    {opt.trustModel}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-white/50 mt-1 leading-relaxed">
                                            {opt.desc}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        {isSelected && (
                                            <CheckCircle className="w-5 h-5 text-cyan-400" />
                                        )}
                                        {isAdj && (
                                            <div
                                                role="button"
                                                tabIndex={0}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setExpandedId(isExpanded ? null : opt.id);
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        e.stopPropagation();
                                                        e.preventDefault();
                                                        setExpandedId(isExpanded ? null : opt.id);
                                                    }
                                                }}
                                                className="p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                                            >
                                                {isExpanded ? (
                                                    <ChevronUp className="w-4 h-4 text-white/40" />
                                                ) : (
                                                    <ChevronDown className="w-4 h-4 text-white/40" />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </button>

                                {isExpanded && isAdj && (
                                    <div className="px-4 pb-4">
                                        <div className={cn(
                                            "p-3 rounded-lg text-xs leading-relaxed",
                                            getTrustBgColor(opt.trustModel),
                                            "text-white/70"
                                        )}>
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="font-bold text-white">How it works:</span>
                                            </div>
                                            {opt.details}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    <button
                        onClick={() => {
                            if (userAddress) {
                                setCustomAddress(userAddress);
                            }
                        }}
                        className={cn(
                            "w-full p-4 rounded-xl border transition-all flex items-start gap-3 text-left",
                            customAddress === userAddress
                                ? "bg-cyan-500/10 border-cyan-500/30 shadow-lg shadow-cyan-500/10"
                                : "bg-white/5 border-white/10 hover:bg-white/[0.07] hover:border-white/20"
                        )}
                    >
                        <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                            customAddress === userAddress ? "bg-cyan-500/20" : "bg-white/10"
                        )}>
                            <Icon className={cn(
                                "w-5 h-5",
                                customAddress === userAddress ? "text-cyan-400" : "text-white/50"
                            )} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className={cn(
                                    "font-bold text-sm",
                                    customAddress === userAddress ? "text-white" : "text-white/80"
                                )}>
                                    Self (Creator)
                                </span>
                                <span className={cn(
                                    "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase",
                                    customAddress === userAddress
                                        ? "bg-cyan-500/20 text-cyan-300"
                                        : "bg-white/10 text-white/40"
                                )}>
                                    Default
                                </span>
                            </div>
                            {userAddress && (
                                <p className="text-xs text-white/50 font-mono mt-1 truncate">
                                    {userAddress}
                                </p>
                            )}
                        </div>
                        {customAddress === userAddress && (
                            <CheckCircle className="w-5 h-5 text-cyan-400 shrink-0" />
                        )}
                    </button>

                    <div className="space-y-3">
                        <label className="text-xs font-bold text-white/60 uppercase tracking-wider">
                            Or Custom Address
                        </label>
                        <input
                            type="text"
                            value={customAddress === userAddress ? '' : customAddress}
                            onChange={(e) => setCustomAddress(e.target.value)}
                            placeholder="0x..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500/50 transition-all placeholder:text-white/20 font-mono text-sm"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
