import { cn } from '../../../../lib/utils';
import React from 'react';

export const GlassPanel: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <div className={cn("glass-card p-0 overflow-hidden", className)}>
        {children}
    </div>
);

export const PanelHeader: React.FC<{ title: React.ReactNode; icon?: React.ElementType; action?: React.ReactNode }> = ({ title, icon: Icon, action }) => (
    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md">
        <div className="flex items-center gap-2 font-bold text-slate-100 uppercase tracking-wider text-xs">
            {Icon && <Icon className="w-4 h-4 text-cyan-400" />}
            {title}
        </div>
        {action}
    </div>
);
