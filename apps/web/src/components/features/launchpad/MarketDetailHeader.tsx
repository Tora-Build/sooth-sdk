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
    // V11: Trial period props
    isInTrialPeriod?: boolean;
    trialTimeRemaining?: number;
    isDismissed?: boolean;
    // Settlement status
    isSettled?: boolean;
    isFinalized?: boolean;
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
    // V11: Trial period props
    isInTrialPeriod,
    trialTimeRemaining,
    isDismissed,
    // Settlement status
    isSettled,
    isFinalized,
}) => {
    const truncate = (addr: string | undefined) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '...';

    // V11: Format trial time remaining
    const formatTrialTime = (seconds: number) => {
        if (seconds <= 0) return '';
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        if (days > 0) return `${days}d ${hours}h`;
        const mins = Math.floor((seconds % 3600) / 60);
        if (hours > 0) return `${hours}h ${mins}m`;
        return `${mins}m`;
    };

    // Status determination - check settlement status first
    const getStatus = () => {
        // V11: Dismissed market
        if (isDismissed) return { label: 'Dismissed', variant: 'danger' as const, emoji: '✗' };
        // Settlement status takes priority over graduated
        if (isFinalized) return { label: 'Finalized', variant: 'success' as const, emoji: '✓' };
        if (isSettled) return { label: 'Settled', variant: 'outline' as const, emoji: '✓' };
        if (isGraduated) return { label: 'Graduated', variant: 'success' as const, emoji: '✓' };
        if (isExpired) return { label: 'Expired', variant: 'danger' as const, emoji: '' };
        // V11: Trial period
        if (isInTrialPeriod) return { label: `Trial · ${formatTrialTime(trialTimeRemaining || 0)} left`, variant: 'warning' as const, emoji: '⏱' };
        return { label: 'Bonding', variant: 'live' as const, emoji: '⚡' };
    };

    const status = getStatus();

    // Determine fee based on status
    const getFee = () => {
        if (isSettled || isFinalized) return '1%';
        if (isGraduated) return '1%';
        return '5%';
    };

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
        <Card className="px-4 py-3 bg-slate-900/60 border-slate-700/50">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                <Badge variant={status.variant} className="px-2 py-0.5 text-xs">
                    {status.label} · {getFee()} Fee
                </Badge>

                {deadline && deadline > 0 && (
                    <div className="flex items-center gap-1.5">
                        <Calendar size={11} />
                        <span className="font-mono">
                            {deadline > 4102444800
                                ? 'No expiry'
                                : new Date(deadline * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        {timeRemaining && !isGraduated && !isExpired && deadline <= 4102444800 && (
                            <span className="text-slate-400">({timeRemaining})</span>
                        )}
                    </div>
                )}

                <a href={getAddressExplorerUrl(chainId, address)} target="_blank" rel="noopener noreferrer" title="View market on explorer">
                    <Badge variant="outline" className="font-mono text-xs px-2 py-0.5 hover:border-slate-500 transition-colors cursor-pointer">
                        ${symbol || address.slice(2, 10).toUpperCase()}
                    </Badge>
                </a>

                <a href={getAddressExplorerUrl(chainId, creator)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-slate-300 transition-colors" title="View creator">
                    <User size={11} />
                    <span className="font-mono">{truncate(creator)}</span>
                </a>

                {adjudicator && (
                    <a href={getAddressExplorerUrl(chainId, adjudicator)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-slate-300 transition-colors" title="View adjudicator">
                        <Shield size={11} />
                        <span className="font-mono">{truncate(adjudicator)}</span>
                    </a>
                )}
            </div>
        </Card>
    );
};
