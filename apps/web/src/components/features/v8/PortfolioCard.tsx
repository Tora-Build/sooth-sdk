import React, { useState, useMemo } from 'react';
import { Card } from '../../ui/Card';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../../../lib/utils';

type CardVariant = 'indigo' | 'emerald' | 'default';

const variantStyles: Record<CardVariant, { card: string; header: string; title: string; button: string }> = {
    indigo: {
        card: 'border-indigo-500/20 bg-indigo-950/30',
        header: 'bg-indigo-900/40',
        title: 'text-indigo-300',
        button: 'border-indigo-500/10 hover:bg-indigo-900/30',
    },
    emerald: {
        card: 'border-emerald-500/20 bg-emerald-950/30',
        header: 'bg-emerald-900/40',
        title: 'text-emerald-300',
        button: 'border-emerald-500/10 hover:bg-emerald-900/30',
    },
    default: {
        card: 'border-slate-800 bg-slate-900/40',
        header: 'bg-slate-800/30',
        title: 'text-slate-300',
        button: 'border-slate-800/50 hover:bg-slate-800/30',
    },
};

interface PortfolioCardProps {
    title: string;
    icon: React.ReactNode;
    badge?: React.ReactNode;
    children: React.ReactNode;
    itemCount: number;
    isLoading?: boolean;
    emptyState?: React.ReactNode;
    maxVisibleItems?: number;
    foldable?: boolean;
    variant?: CardVariant;
    className?: string;
}

export const PortfolioCard: React.FC<PortfolioCardProps> = ({
    title,
    icon,
    badge,
    children,
    itemCount,
    isLoading,
    emptyState,
    maxVisibleItems = 3,
    foldable = true,
    variant = 'default',
    className
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const styles = variantStyles[variant];
    
    const childArray = useMemo(() => React.Children.toArray(children), [children]);
    const hasMore = foldable && itemCount > maxVisibleItems && childArray.length > 1;
    
    const visibleChildren = useMemo(() => {
        if (!foldable || isExpanded || childArray.length <= 1) {
            return children;
        }
        return childArray.slice(0, maxVisibleItems);
    }, [foldable, isExpanded, childArray, children, maxVisibleItems]);

    return (
        <Card className={cn("flex flex-col backdrop-blur-sm overflow-hidden", styles.card, className)}>
            <div className={cn("mx-1.5 mt-1.5 px-2.5 py-1.5 rounded-lg flex items-center justify-between", styles.header)}>
                <div className="flex items-center gap-1.5">
                    {icon}
                    <h3 className={cn("font-black text-[10px] uppercase tracking-widest", styles.title)}>{title}</h3>
                </div>
                {badge && <div>{badge}</div>}
            </div>

            <div className="p-2 flex-1">
                {isLoading ? (
                    <div className="py-4 text-center text-slate-500 animate-pulse font-mono text-[10px]">// loading...</div>
                ) : itemCount === 0 ? (
                    emptyState
                ) : (
                    <div className="space-y-1.5">
                        {visibleChildren}
                    </div>
                )}
            </div>

            {hasMore && !isLoading && itemCount > 0 && (
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className={cn("w-full py-1 border-t text-[9px] font-black text-slate-500 hover:text-slate-300 transition-all flex items-center justify-center gap-1.5 uppercase tracking-widest", styles.button)}
                >
                    {isExpanded ? (
                        <>Collapse <ChevronUp size={9} /></>
                    ) : (
                        <>See All ({itemCount}) <ChevronDown size={9} /></>
                    )}
                </button>
            )}
        </Card>
    );
};
