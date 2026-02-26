import React from 'react';

const FeatureCard = ({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) => {
  return (
    <div className="group p-6 rounded-xl border bg-zinc-900/10 border-white/[0.04] hover:border-amber-500/20 shadow-amber-500/5 backdrop-blur-sm transition-all duration-300 hover:bg-zinc-900/30 flex flex-col items-start text-left">
      <div className="flex items-center gap-4 mb-4">
        <div className="p-2.5 rounded-lg bg-zinc-950/50 border border-white/[0.06] group-hover:border-amber-500/30 transition-colors text-amber-500/50 group-hover:text-amber-400">
          {icon}
        </div>
        <h3 className="text-base font-medium text-zinc-100 tracking-tight">{title}</h3>
      </div>
      <p className="text-[13px] text-zinc-400 leading-relaxed font-sans">{description}</p>
    </div>
  );
};

export const AboutSection = () => {
  return (
    <div>
      <div className="text-zinc-500 font-mono text-xs uppercase tracking-widest px-2 flex items-center gap-2 select-none mb-6">
        About Sooth Registry
      </div>
      <div className="w-full bg-zinc-900/10 pb-8 rounded-xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <FeatureCard
          icon={
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="3" y1="9" x2="21" y2="9"></line>
              <line x1="9" y1="21" x2="9" y2="9"></line>
            </svg>
          }
          title="SoothBook"
          description="On-chain Central Limit Order Book with 1,000 ticks spreading, auto matching, and constant-time discovery."
        />
        <FeatureCard
          icon={
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="7.5 4.21 12 6.81 16.5 4.21"></polyline>
              <polyline points="7.5 19.79 7.5 14.6 3 12"></polyline>
              <polyline points="21 12 16.5 14.6 16.5 19.79"></polyline>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
          }
          title="Multi-Chain"
          description="Operators can deploy on any EVM-compatible chain. Unified market aggregation across all networks."
        />
        <FeatureCard
          icon={
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
          }
          title="Graduated Markets"
          description="Only high-conviction markets that pass initial bonding curve phases appear here."
        />
        <FeatureCard
          icon={
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
          }
          title="Permissionless"
          description="Anyone can create, trade, or resolve markets using ZK-verified autonomous rules."
        />
      </div>
        <p className="text-zinc-400 text-sm max-w-3xl font-sans leading-relaxed mt-8 mx-auto text-center">
          The central directory for graduated Sooth Protocol markets. Markets listed here have met the liquidity thresholds on SoothBook and are actively resolving.
        </p>
      </div>
    </div>
  );
};
