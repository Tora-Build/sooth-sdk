import { ReactNode } from 'react';
import { useMarkets } from '../hooks/useMarkets';
import { useAccount } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { PhoneFrame } from './PhoneFrame';
import { Wallet, TrendingUp, Users, Clock, ExternalLink, BarChart3 } from 'lucide-react';

interface ShowcaseProps {
  children: ReactNode;
}

function formatTimeRemaining(deadline?: bigint): string {
  if (!deadline) return '--';
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (deadline <= now) return 'Ended';
  const diff = Number(deadline - now);
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h`;
  return `${Math.floor((diff % 3600) / 60)}m`;
}

/**
 * Desktop showcase wrapper.
 * Two-column: phone simulator (left) + protocol info & market stats (right).
 * Only rendered on desktop (md+). On mobile, children render directly.
 */
export function Showcase({ children }: ShowcaseProps) {
  const { data: markets } = useMarkets();
  const { isConnected, address } = useAccount();
  const { open } = useAppKit();

  const openMarkets = markets?.filter(m => m.stage === 'bonding' || m.stage === 'live') ?? [];
  const settledMarkets = markets?.filter(m => m.stage === 'settled' || m.stage === 'finalized') ?? [];
  const totalMarkets = markets?.length ?? 0;

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white overflow-x-hidden">
      {/* Grid Background */}
      <div
        className="fixed inset-0 z-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      />

      {/* Background Gradients */}
      <div className="fixed top-20 left-1/4 w-[500px] h-[500px] bg-[#00d4aa]/10 rounded-full blur-[120px] mix-blend-screen opacity-30 pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-[500px] h-[500px] bg-[#e01b24]/10 rounded-full blur-[120px] mix-blend-screen opacity-30 pointer-events-none" />

      {/* Top Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-4 border-b border-white/5 bg-black/50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00d4aa] to-emerald-500 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-black" />
          </div>
          <span className="font-mono font-bold text-lg tracking-tight">Sooth</span>
          <span className="text-xs font-mono text-[#00d4aa]/60 bg-[#00d4aa]/10 px-2 py-0.5 rounded-full border border-[#00d4aa]/20">
            TESTNET
          </span>
        </div>

        <div className="flex items-center gap-6 text-sm font-mono text-white/50">
          <a href="https://github.com/Tora-Build/sooth-alpha" target="_blank" rel="noopener noreferrer" className="hover:text-[#00d4aa] transition-colors flex items-center gap-1">
            GitHub <ExternalLink className="w-3 h-3" />
          </a>
          <button
            onClick={() => open()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:border-[#00d4aa]/50 hover:text-[#00d4aa] transition-all"
          >
            <Wallet className="w-4 h-4" />
            {isConnected ? `${address?.slice(0, 6)}...${address?.slice(-4)}` : 'Connect'}
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <section className="relative z-10 px-8 py-12">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl lg:text-5xl font-black tracking-tighter mb-4">
              Prediction Markets for the{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d4aa] via-emerald-400 to-cyan-400">
                Agent Economy
              </span>
            </h1>
            <p className="text-lg text-white/50 max-w-2xl mx-auto">
              Trade on outcomes. Stake your conviction. On-chain on Monad.
            </p>
          </div>

          {/* Two-Column Layout */}
          <div className="grid lg:grid-cols-[auto_1fr] gap-16 items-start">
            {/* Left: Phone */}
            <div className="flex justify-center lg:justify-start">
              <PhoneFrame>
                {children}
              </PhoneFrame>
            </div>

            {/* Right: Info Panel */}
            <div className="space-y-6 lg:pt-4">
              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-2xl font-bold font-mono text-[#00d4aa]">{totalMarkets}</div>
                  <div className="text-xs text-white/40 font-mono mt-1">Total Markets</div>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-2xl font-bold font-mono text-[#00d4aa]">{openMarkets.length}</div>
                  <div className="text-xs text-white/40 font-mono mt-1">Open</div>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-2xl font-bold font-mono text-[#00d4aa]">{settledMarkets.length}</div>
                  <div className="text-xs text-white/40 font-mono mt-1">Settled</div>
                </div>
              </div>

              {/* Active Markets List */}
              <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#00d4aa]" />
                  <span className="font-mono font-semibold text-sm">Active Markets</span>
                </div>
                <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto">
                  {openMarkets.length === 0 ? (
                    <div className="px-4 py-8 text-center text-white/30 text-sm">
                      No active markets
                    </div>
                  ) : (
                    openMarkets.map(market => (
                      <div key={market.address} className="px-4 py-3 hover:bg-white/5 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{market.question}</p>
                            <div className="flex items-center gap-3 mt-1">
                              <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                                market.stage === 'bonding' 
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                                  : 'bg-[#00d4aa]/10 text-[#00d4aa] border border-[#00d4aa]/20'
                              }`}>
                                {market.stage}
                              </span>
                              {market.deadline != null && (
                                <span className="text-xs text-white/30 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatTimeRemaining(market.deadline)}
                                </span>
                              )}
                            </div>
                          </div>
                          {market.yesProbability !== undefined && (
                            <div className="text-right shrink-0">
                              <div className={`text-lg font-mono font-bold ${
                                market.yesProbability >= 0.5 ? 'text-[#00d4aa]' : 'text-[#e01b24]'
                              }`}>
                                {(market.yesProbability * 100).toFixed(0)}%
                              </div>
                              <div className="text-[10px] text-white/30 font-mono">YES</div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Protocol Info */}
              <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#00d4aa]" />
                  <span className="font-mono font-semibold text-sm">How It Works</span>
                </div>
                <div className="p-4 space-y-3">
                  {[
                    { step: '1', title: 'Connect Wallet', desc: 'Any EVM wallet on Monad Testnet' },
                    { step: '2', title: 'Pick a Market', desc: 'Swipe through prediction markets' },
                    { step: '3', title: 'Trade YES / NO', desc: 'Buy outcome tokens at market price' },
                    { step: '4', title: 'Collect Winnings', desc: 'Claim when market resolves' },
                  ].map(item => (
                    <div key={item.step} className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-md bg-[#00d4aa]/10 border border-[#00d4aa]/30 flex items-center justify-center text-[#00d4aa] font-mono font-bold text-xs shrink-0">
                        {item.step}
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{item.title}</div>
                        <div className="text-xs text-white/40">{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chain Info */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5 text-xs text-white/30 font-mono">
                <div className="w-2 h-2 rounded-full bg-[#00d4aa] animate-pulse" />
                Monad Testnet • On-chain prediction markets • Powered by Sooth Protocol
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
