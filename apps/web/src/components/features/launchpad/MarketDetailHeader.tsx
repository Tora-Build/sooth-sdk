// MarketDetailHeader.tsx - Card-style header for market detail pages
// Shows market identity, status, and key addresses (contract, creator, adjudicator)

import React from 'react';
import { ExternalLink, Clock, Shield, User, FileText, Calendar } from 'lucide-react';
import { Badge } from '../../ui/Badge';
import { Card } from '../../ui/Card';
import { getAddressExplorerUrl } from '../../../lib/chains';

interface MarketDetailHeaderProps {
    name: string;
    description?: string;
    symbol?: string;
    address: string;
    creator: string;
    adjudicator?: string;
    deadline?: number;
    isGraduated: boolean;
    isExpired: boolean;
    isLive: boolean;
    chainId: number;
}

export const MarketDetailHeader: React.FC<MarketDetailHeaderProps> = ({
    name,
    description,
    symbol,
    address,
    creator,
    adjudicator,
    deadline,
    isGraduated,
    isExpired,
    isLive,
    chainId,
}) => {
    const truncate = (addr: string | undefined) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '...';

    // Status determination
    const getStatus = () => {
        if (isGraduated) return { label: 'Graduated', variant: 'success' as const, emoji: '🎓' };
        if (isExpired) return { label: 'Expired', variant: 'danger' as const, emoji: '⏰' };
        if (!isLive) return { label: 'Settled', variant: 'outline' as const, emoji: '✓' };
        return { label: 'Bonding', variant: 'live' as const, emoji: '🔥' };
    };

    const status = getStatus();

    // Time remaining calculation
    const getTimeRemaining = () => {
        if (!deadline || deadline === 0) return null;
        const now = Date.now() / 1000;
        const remaining = deadline - now;
        if (remaining <= 0) return null;

        const days = Math.floor(remaining / 86400);
        const hours = Math.floor((remaining % 86400) / 3600);
        const mins = Math.floor((remaining % 3600) / 60);

        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${mins}m`;
        return `${mins}m`;
    };

    const timeRemaining = getTimeRemaining();

    return (
        <Card className="p-5 bg-slate-900/60 border-slate-700/50 relative overflow-hidden">
            {/* Subtle gradient accent at top */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />

            {/* Row 1: $TOKEN + Title + Status badge in one line */}
            <div className="flex items-center gap-3 mb-2">
                {/* Token badge */}
                {symbol && (
                    <a
                        href={getAddressExplorerUrl(chainId, address)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="View market on explorer"
                        className="flex-shrink-0"
                    >
                        <Badge variant="outline" className="font-mono text-xs px-2.5 py-1 hover:border-slate-500 transition-colors cursor-pointer">
                            ${symbol}
                        </Badge>
                    </a>
                )}

                {/* Title */}
                <h1 className="font-heading font-bold text-xl text-white leading-tight flex-1 truncate">
                    {name || 'Untitled Market'}
                </h1>

                {/* Status badge */}
                <Badge variant={status.variant} className="flex items-center gap-1.5 px-2.5 py-1 flex-shrink-0">
                    <span>{status.emoji}</span>
                    <span>{status.label}</span>
                </Badge>
            </div>

            {/* Row 2: Description/Question */}
            {description && (
                <p className="text-sm text-slate-400 leading-relaxed mb-3">
                    {description}
                </p>
            )}

            {/* Divider */}
            <div className="border-t border-slate-800/50 my-3" />

            {/* Row 3: Expiration time + countdown */}
            {deadline && deadline > 0 && (
                <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
                    <div className="flex items-center gap-1.5">
                        <Calendar size={12} />
                        <span className="text-slate-600">Expires:</span>
                        <span className="font-mono">
                            {new Date(deadline * 1000).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                            })}
                        </span>
                    </div>
                    {timeRemaining && !isGraduated && !isExpired && (
                        <div className="flex items-center gap-1.5 text-slate-400 bg-slate-800/50 px-2 py-0.5 rounded">
                            <Clock size={11} />
                            <span className="font-mono">{timeRemaining} left</span>
                        </div>
                    )}
                </div>
            )}

            {/* Row 4: All addresses */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-500">
                {/* Market Address */}
                <a
                    href={getAddressExplorerUrl(chainId, address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 hover:text-slate-300 transition-colors"
                    title="View market on explorer"
                >
                    <FileText size={12} />
                    <span className="text-slate-600">Market:</span>
                    <span className="font-mono">{truncate(address)}</span>
                    <ExternalLink size={10} className="opacity-50" />
                </a>

                {/* Creator */}
                <a
                    href={getAddressExplorerUrl(chainId, creator)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 hover:text-slate-300 transition-colors"
                    title="View creator on explorer"
                >
                    <User size={12} />
                    <span className="text-slate-600">Creator:</span>
                    <span className="font-mono">{truncate(creator)}</span>
                    <ExternalLink size={10} className="opacity-50" />
                </a>

                {/* Adjudicator */}
                {adjudicator && (
                    <a
                        href={getAddressExplorerUrl(chainId, adjudicator)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 hover:text-slate-300 transition-colors"
                        title="View adjudicator on explorer"
                    >
                        <Shield size={12} />
                        <span className="text-slate-600">Adjudicator:</span>
                        <span className="font-mono">{truncate(adjudicator)}</span>
                        <ExternalLink size={10} className="opacity-50" />
                    </a>
                )}
            </div>
        </Card>
    );
};
