import { CheckCircle, AlertTriangle } from 'lucide-react';
import { Address } from 'viem';
import { cn } from '../../lib/utils';

interface AddressSelectorProps {
    label: string;
    icon: any; // LucideIcon
    options: any[];
    selectedMode: 'registry' | 'custom';
    setSelectedMode: (m: 'registry' | 'custom') => void;
    selectedRegistryId: string;
    setSelectedRegistryId: (id: string) => void;
    customAddress: string;
    setCustomAddress: (addr: string) => void;
    userAddress?: Address;
}

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
    userAddress
}: AddressSelectorProps) => {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-slate-300 flex items-center gap-2">
                    <Icon className="w-4 h-4 text-cyan-400" />
                    {label}
                </label>
                <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
                    <button
                        onClick={() => setSelectedMode('registry')}
                        className={cn(
                            "px-3 py-1 text-xs font-bold rounded-md transition-all",
                            selectedMode === 'registry' ? "bg-cyan-500/20 text-cyan-400 shadow-sm" : "text-slate-500 hover:text-slate-300"
                        )}
                    >
                        Registry (Recommended)
                    </button>
                    <button
                        onClick={() => setSelectedMode('custom')}
                        className={cn(
                            "px-3 py-1 text-xs font-bold rounded-md transition-all",
                            selectedMode === 'custom' ? "bg-amber-500/20 text-amber-400 shadow-sm" : "text-slate-500 hover:text-slate-300"
                        )}
                    >
                        Custom
                    </button>
                </div>
            </div>

            {selectedMode === 'registry' ? (
                <div className="grid sm:grid-cols-2 gap-3">
                    {options.map((opt) => (
                        <div
                            key={opt.id}
                            onClick={() => {
                                setSelectedRegistryId(opt.id);
                                if (opt.address !== 'SELF') setCustomAddress(opt.address);
                                else if (userAddress) setCustomAddress(userAddress);
                            }}
                            className={cn(
                                "cursor-pointer p-4 rounded-xl border transition-all hover:bg-slate-800/50 relative overflow-hidden group",
                                selectedRegistryId === opt.id
                                    ? "bg-cyan-500/10 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.1)]"
                                    : "bg-slate-900/40 border-slate-800 hover:border-slate-700"
                            )}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className="font-bold text-sm text-white group-hover:text-cyan-400 transition-colors">{opt.name}</span>
                                {opt.badge && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">{opt.badge}</span>}
                            </div>
                            <p className="text-xs text-slate-400 leading-relaxed">{opt.desc}</p>
                            {selectedRegistryId === opt.id && (
                                <div className="absolute top-2 right-2 text-cyan-500 animate-in zoom-in duration-200">
                                    <CheckCircle className="w-4 h-4 fill-cyan-500/20" />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                    <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs font-bold text-amber-500 mb-1">Advanced Mode Warning</p>
                            <p className="text-xs text-amber-200/80 leading-relaxed">
                                Using a custom address bypasses safety checks. Ensure the address is a valid contract or EOA.
                            </p>
                        </div>
                    </div>
                    <input
                        type="text"
                        value={customAddress}
                        onChange={(e) => setCustomAddress(e.target.value)}
                        placeholder={`0x... (${label} Address)`}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 font-mono transition-all"
                    />
                </div>
            )}
        </div>
    );
};
