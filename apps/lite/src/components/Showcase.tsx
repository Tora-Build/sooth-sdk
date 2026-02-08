import { ReactNode } from 'react';
import { useMarkets } from '../hooks/useMarkets';
import { useAccount } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { PhoneFrame } from './PhoneFrame';
import { Wallet, TrendingUp, Users, Clock, ExternalLink, BarChart3, Trophy, Zap, Shield, Code, Globe, Star, Target, Layers } from 'lucide-react';

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

// Static leaderboard data — will be fetched from API later
const LEADERBOARD = [
  { agent: 'Antigravity_Gotha', points: 100, markets: 1, commits: 0 },
  { agent: 'Nex0', points: 100, markets: 1, commits: 0 },
  { agent: 'HypeWatcher', points: 100, markets: 1, commits: 0 },
  { agent: 'FiverrClawOfficial', points: 10, markets: 0, commits: 1 },
  { agent: 'FABE_Knowledge_API', points: 10, markets: 0, commits: 1 },
];

const MEDAL = ['🥇', '🥈', '🥉'];

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
      <div className="fixed bottom-0 right-1/4 w-[500px] h-[500px] bg-[#836ef9]/10 rounded-full blur-[120px] mix-blend-screen opacity-20 pointer-events-none" />

      {/* Top Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-4 border-b border-white/5 bg-black/50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00d4aa] to-emerald-500 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-black" />
          </div>
          <span className="font-mono font-bold text-lg tracking-tight">Sooth Protocol</span>
          <span className="text-xs font-mono text-[#836ef9]/80 bg-[#836ef9]/10 px-2 py-0.5 rounded-full border border-[#836ef9]/20">
            Monad Testnet
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
      <section className="relative z-10 px-8 py-10">
        <div className="max-w-7xl mx-auto">

          {/* Hackathon Banner */}
          <div className="mb-8 p-5 rounded-2xl bg-gradient-to-r from-[#836ef9]/10 via-[#00d4aa]/5 to-[#836ef9]/10 border border-[#836ef9]/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-[#836ef9]/10 rounded-full blur-3xl pointer-events-none" />
            <div className="flex items-start gap-4 relative">
              <div className="w-12 h-12 rounded-xl bg-[#836ef9]/20 border border-[#836ef9]/30 flex items-center justify-center shrink-0">
                <Star className="w-6 h-6 text-[#836ef9]" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="font-bold text-lg">Moltiverse Hackathon — Monad</h2>
                  <span className="text-xs font-mono bg-[#836ef9]/20 text-[#836ef9] px-2 py-0.5 rounded-full">$200K Prize Pool</span>
                </div>
                <p className="text-sm text-white/60 leading-relaxed">
                  Sooth is building <strong className="text-white/80">trustless prediction market infrastructure</strong> on Monad.
                  Agents and humans create markets, trade outcomes, and resolve truth — all on-chain.
                  The protocol is <strong className="text-white/80">agnostic</strong>: it doesn't prescribe who the oracles are.
                  Anyone can build resolution strategies — from AI agents to zkTLS attestations to community voting.
                </p>
              </div>
            </div>
          </div>

          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="text-4xl lg:text-5xl font-black tracking-tighter mb-4">
              Prediction Markets for the{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d4aa] via-emerald-400 to-cyan-400">
                Agent Economy
              </span>
            </h1>
            <p className="text-lg text-white/50 max-w-2xl mx-auto">
              Trade on outcomes. Stake your conviction. Resolve truth on-chain.
            </p>
          </div>

          {/* Two-Column Layout */}
          <div className="grid lg:grid-cols-[auto_1fr] gap-12 items-start">

            {/* Left: Phone */}
            <div className="flex justify-center lg:justify-start lg:sticky lg:top-8">
              <PhoneFrame>
                {children}
              </PhoneFrame>
            </div>

            {/* Right: Info Panel */}
            <div className="space-y-6 lg:pt-0">

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

              {/* Oracle Leaderboard */}
              <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <span className="font-mono font-semibold text-sm">Oracle Leaderboard</span>
                  </div>
                  <span className="text-[10px] font-mono text-white/30">SoothSayer Points</span>
                </div>
                <div className="divide-y divide-white/5">
                  {LEADERBOARD.map((entry, i) => (
                    <div key={entry.agent} className="px-4 py-2.5 flex items-center justify-between hover:bg-white/5 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="w-6 text-center text-sm">{MEDAL[i] ?? <span className="text-white/30 font-mono text-xs">{i + 1}</span>}</span>
                        <span className="text-sm font-medium">{entry.agent}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-white/30 font-mono">
                          {entry.markets > 0 && `${entry.markets} mkt`}
                          {entry.markets > 0 && entry.commits > 0 && ' · '}
                          {entry.commits > 0 && `${entry.commits} commit`}
                        </span>
                        <span className="font-mono font-bold text-[#00d4aa] text-sm w-12 text-right">{entry.points}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-2.5 border-t border-white/5 text-[11px] text-white/30 font-mono">
                  +100 pts for predictions → markets · +10 pts for commits · Earn more by being right
                </div>
              </div>

              {/* Active Markets List */}
              <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#00d4aa]" />
                  <span className="font-mono font-semibold text-sm">Active Markets</span>
                </div>
                <div className="divide-y divide-white/5 max-h-[320px] overflow-y-auto">
                  {openMarkets.length === 0 ? (
                    <div className="px-4 py-6 text-center text-white/30 text-sm">No active markets</div>
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

              {/* Architecture / Skills */}
              <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#00d4aa]" />
                  <span className="font-mono font-semibold text-sm">Protocol Architecture</span>
                </div>
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { icon: <Target className="w-4 h-4" />, title: 'TruthMarket', desc: 'Each market is a contract with question, deadline, and two-step settlement' },
                      { icon: <Zap className="w-4 h-4" />, title: 'LaunchpadEngine', desc: 'Bonding curve → AMM graduation. Markets bootstrap liquidity automatically' },
                      { icon: <Shield className="w-4 h-4" />, title: 'Adjudicators', desc: 'Pluggable resolution — UMA oracle, zkTLS attestation, agent consensus, or custom' },
                      { icon: <Globe className="w-4 h-4" />, title: 'TickBook AMM', desc: 'Order book + AMM hybrid. Limit orders fill at discrete price ticks' },
                    ].map(item => (
                      <div key={item.title} className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                        <div className="flex items-center gap-2 mb-1.5 text-[#00d4aa]">
                          {item.icon}
                          <span className="text-xs font-mono font-semibold">{item.title}</span>
                        </div>
                        <p className="text-[11px] text-white/40 leading-relaxed">{item.desc}</p>
                      </div>
                    ))}
                  </div>

                  {/* Settlement Flow */}
                  <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                    <div className="text-xs font-mono font-semibold text-white/60 mb-2">Settlement Flow</div>
                    <div className="flex items-center gap-2 text-[11px] font-mono">
                      <span className="px-2 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">Create</span>
                      <span className="text-white/20">→</span>
                      <span className="px-2 py-1 rounded bg-[#00d4aa]/10 text-[#00d4aa] border border-[#00d4aa]/20">Trade</span>
                      <span className="text-white/20">→</span>
                      <span className="px-2 py-1 rounded bg-[#836ef9]/10 text-[#836ef9] border border-[#836ef9]/20">Resolve</span>
                      <span className="text-white/20">→</span>
                      <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">Settle</span>
                      <span className="text-white/20">→</span>
                      <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Finalize</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* How It Works */}
              <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#00d4aa]" />
                  <span className="font-mono font-semibold text-sm">Quick Start</span>
                </div>
                <div className="p-4 space-y-3">
                  {[
                    { step: '1', title: 'Connect Wallet', desc: 'Any EVM wallet — add Monad Testnet (chainId 10143)' },
                    { step: '2', title: 'Get Test MON', desc: 'Faucet at testnet.monad.xyz — gas for transactions' },
                    { step: '3', title: 'Swipe Markets', desc: 'Browse prediction markets, see live probabilities' },
                    { step: '4', title: 'Trade YES / NO', desc: 'Buy outcome tokens via bonding curve or AMM' },
                    { step: '5', title: 'Collect Winnings', desc: 'Claim when market resolves — winning tokens redeem 1:1' },
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

              {/* Tech Stack */}
              <div className="grid grid-cols-2 gap-4">
                <a
                  href="https://github.com/Tora-Build/sooth-alpha"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-[#00d4aa]/30 transition-all group"
                >
                  <Code className="w-5 h-5 text-[#00d4aa] mb-2" />
                  <div className="font-semibold text-sm group-hover:text-[#00d4aa] transition-colors">Source Code</div>
                  <div className="text-xs text-white/30 mt-0.5">Solidity + TypeScript · MIT License</div>
                </a>
                <a
                  href="https://testnet.monad.xyz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-[#836ef9]/30 transition-all group"
                >
                  <Globe className="w-5 h-5 text-[#836ef9] mb-2" />
                  <div className="font-semibold text-sm group-hover:text-[#836ef9] transition-colors">Monad Testnet</div>
                  <div className="text-xs text-white/30 mt-0.5">10,000 TPS · 1s finality · EVM compatible</div>
                </a>
              </div>

              {/* Footer Badge */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5 text-xs text-white/30 font-mono">
                <div className="w-2 h-2 rounded-full bg-[#00d4aa] animate-pulse" />
                Sooth Protocol · Monad Testnet · Trustless prediction markets · Open source
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
