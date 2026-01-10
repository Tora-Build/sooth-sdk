/**
 * TradingHeader - Wrapper around MarketDetailHeader with YES/NO outcome tabs
 *
 * Features:
 * - All MarketDetailHeader features (name, symbol, status, addresses)
 * - YES/NO outcome toggle tabs for trading view
 */
import React from 'react';
import { MarketDetailHeader } from '../launchpad/MarketDetailHeader';
import { cn } from '../../../lib/utils';

interface TradingHeaderProps {
    // MarketDetailHeader props
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
    // Trading-specific props
    viewOutcome: 'yes' | 'no';
    onOutcomeChange: (outcome: 'yes' | 'no') => void;
}

export const TradingHeader: React.FC<TradingHeaderProps> = ({
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
    viewOutcome,
    onOutcomeChange,
}) => {
    return (
        <div className="space-y-4">
            {/* Reuse MarketDetailHeader for the main header */}
            <MarketDetailHeader
                name={name}
                description={description}
                symbol={symbol}
                address={address}
                creator={creator}
                adjudicator={adjudicator}
                deadline={deadline}
                isGraduated={isGraduated}
                isExpired={isExpired}
                isLive={isLive}
                chainId={chainId}
            />

            {/* YES/NO Outcome Tabs */}
            <div className="flex rounded-lg overflow-hidden border border-slate-800 bg-slate-900/50 w-fit">
                <button
                    onClick={() => onOutcomeChange('yes')}
                    className={cn(
                        "px-10 py-2.5 text-sm font-semibold transition-all relative",
                        viewOutcome === 'yes'
                            ? "text-white bg-slate-800"
                            : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                    )}
                >
                    YES
                    {viewOutcome === 'yes' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />
                    )}
                </button>
                <button
                    onClick={() => onOutcomeChange('no')}
                    className={cn(
                        "px-10 py-2.5 text-sm font-semibold transition-all relative",
                        viewOutcome === 'no'
                            ? "text-white bg-slate-800"
                            : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                    )}
                >
                    NO
                    {viewOutcome === 'no' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-500" />
                    )}
                </button>
            </div>
        </div>
    );
};

export default TradingHeader;
