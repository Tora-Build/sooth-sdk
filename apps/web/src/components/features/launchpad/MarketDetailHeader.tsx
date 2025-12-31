// MarketDetailHeader.tsx - Header component for Launchpad market detail page

import React, { useState } from 'react';
import { ArrowLeft, Copy, Check, ExternalLink, Clock, Rocket, Trophy, AlertTriangle } from 'lucide-react';
import { Badge } from '../../ui/Badge';

interface MarketDetailHeaderProps {
    name: string;
    symbol?: string;
    address: string;
    creator: string;
    deadline?: number;
    isGraduated: boolean;
    isExpired: boolean;
    isLive: boolean;
    onBack: () => void;
}

export const MarketDetailHeader: React.FC<MarketDetailHeaderProps> = ({
    name,
    symbol,
    address,
    creator,
    deadline,
    isGraduated,
    isExpired,
    isLive,
    onBack
}) => {
    const [copied, setCopied] = useState<'address' | 'creator' | null>(null);

    const copyToClipboard = async (text: string, type: 'address' | 'creator') => {
        await navigator.clipboard.writeText(text);
        setCopied(type);
        setTimeout(() => setCopied(null), 2000);
    };

    const truncate = (addr: string | undefined) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '...';

    // Status determination
    const getStatus = () => {
        if (isGraduated) return { label: 'Graduated', variant: 'success' as const, icon: Trophy, emoji: '🎓' };
        if (isExpired) return { label: 'Expired', variant: 'danger' as const, icon: AlertTriangle, emoji: '⏰' };
        if (!isLive) return { label: 'Settled', variant: 'outline' as const, icon: Check, emoji: '✓' };
        return { label: 'Bonding', variant: 'live' as const, icon: Rocket, emoji: '🔥' };
    };

    const status = getStatus();

    // Time remaining calculation
    const getTimeRemaining = () => {
        if (!deadline || deadline === 0) return null;
        const now = Date.now() / 1000;
        const remaining = deadline - now;
        if (remaining <= 0) return 'Expired';

        const days = Math.floor(remaining / 86400);
        const hours = Math.floor((remaining % 86400) / 3600);
        const mins = Math.floor((remaining % 3600) / 60);

        if (days > 0) return `${days}d ${hours}h remaining`;
        if (hours > 0) return `${hours}h ${mins}m remaining`;
        return `${mins}m remaining`;
    };

    const timeRemaining = getTimeRemaining();

    return (
        <div className="space-y-4">
            {/* Back Button */}
            <button
                onClick={onBack}
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors group"
            >
                <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                Back to Markets
            </button>

            {/* Main Header */}
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="flex-1 min-w-0">
                    {/* Title Row */}
                    <div className="flex items-start gap-3 mb-3">
                        <h1 className="font-heading font-bold text-2xl md:text-3xl text-white break-words">
                            {name || 'Untitled Market'}
                        </h1>
                        {symbol && (
                            <Badge variant="outline" className="shrink-0 font-mono text-xs">
                                ${symbol}
                            </Badge>
                        )}
                    </div>

                    {/* Status & Info Row */}
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                        {/* Status Badge */}
                        <Badge variant={status.variant} className="flex items-center gap-1">
                            <span>{status.emoji}</span>
                            <span>{status.label}</span>
                        </Badge>

                        {/* Time Remaining */}
                        {timeRemaining && !isGraduated && !isExpired && (
                            <div className="flex items-center gap-1 text-slate-400">
                                <Clock size={14} />
                                <span>{timeRemaining}</span>
                            </div>
                        )}

                        {/* Creator */}
                        <button
                            onClick={() => copyToClipboard(creator, 'creator')}
                            className="flex items-center gap-1 text-slate-500 hover:text-slate-300 transition-colors"
                        >
                            <span>by</span>
                            <span className="font-mono">{truncate(creator)}</span>
                            {copied === 'creator' ? (
                                <Check size={12} className="text-emerald-400" />
                            ) : (
                                <Copy size={12} />
                            )}
                        </button>
                    </div>
                </div>

                {/* Contract Address */}
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={() => copyToClipboard(address, 'address')}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-lg text-sm transition-colors"
                    >
                        <span className="font-mono text-slate-400">{truncate(address)}</span>
                        {copied === 'address' ? (
                            <Check size={14} className="text-emerald-400" />
                        ) : (
                            <Copy size={14} className="text-slate-500" />
                        )}
                    </button>
                    <a
                        href={`https://sepolia.basescan.org/address/${address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors"
                    >
                        <ExternalLink size={16} className="text-slate-400" />
                    </a>
                </div>
            </div>
        </div>
    );
};
