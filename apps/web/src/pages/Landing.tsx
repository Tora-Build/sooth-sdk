import React from 'react';

interface LandingProps {
  onEnter: () => void;
  onAbout: () => void;
}

export const Landing: React.FC<LandingProps> = ({ onEnter, onAbout }) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden py-12">
      {/* Background Effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-indigo-600/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[400px] bg-violet-600/10 blur-[100px] rounded-full pointer-events-none" />

      {/* Content Container */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center flex-1 flex flex-col justify-center">

        {/* Badges */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6 sm:mb-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/50 border border-slate-800 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-xs font-medium text-slate-300 tracking-wide uppercase">Base Sepolia</span>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/50 border border-slate-800 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            <span className="text-xs font-medium text-slate-300 tracking-wide uppercase">BNB Testnet</span>
          </div>
        </div>

        {/* Hero Title */}
        <h1 className="text-5xl sm:text-6xl md:text-8xl font-bold tracking-tight mb-4 sm:mb-6 animate-slide-up">
          <span className="bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-slate-400">
            Sooth Protocol
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-xl sm:text-2xl md:text-3xl font-semibold text-emerald-400 mb-4 sm:mb-6 animate-slide-up" style={{ animationDelay: '0.05s' }}>
          On-chain Truth Market
        </p>

        {/* Subtitle */}
        <p className="text-base sm:text-xl text-slate-400 mb-8 sm:mb-10 max-w-2xl mx-auto leading-relaxed animate-slide-up px-4" style={{ animationDelay: '0.1s' }}>
          The next generation of prediction markets.
          <span className="text-indigo-400"> Open-end</span>,
          <span className="text-violet-400"> retroactive finality</span>, and
          <span className="text-emerald-400"> ZK-verified settlement</span>.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 animate-slide-up px-4" style={{ animationDelay: '0.2s' }}>
          <button
            onClick={onEnter}
            className="btn-primary text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 shadow-indigo-500/25 hover:shadow-indigo-500/40 w-full sm:w-auto"
          >
            Launch App
          </button>
          <button
            onClick={onAbout}
            className="px-6 sm:px-8 py-3 sm:py-4 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800/50 transition-all w-full sm:w-auto font-medium text-base sm:text-lg"
          >
            About Protocol
          </button>
        </div>

      </div>

      {/* Footer */}
      <div className="relative z-10 text-slate-600 text-xs sm:text-sm py-6">
        &copy; 2025 Sooth Protocol.
      </div>
    </div>
  );
};
