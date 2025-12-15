import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { ArrowLeft, Zap } from 'lucide-react';

export const About = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Simple Header */}
      <header className="h-16 border-b border-slate-800/50 bg-slate-950/90 backdrop-blur-xl sticky top-0 z-40">
        <div className="container mx-auto max-w-7xl h-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="p-2 rounded-lg border border-slate-700 hover:border-cyan-500/50 transition-all">
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </Link>
            <div className="flex items-center gap-3">
              <img src="/sooth-logo.svg" alt="Sooth" className="w-8 h-8" />
              <span className="font-heading font-bold text-xl text-white">SOOTH</span>
            </div>
          </div>
          <Link
            to="/markets"
            className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-sm rounded-lg transition-all"
          >
            <Zap className="w-4 h-4" />
            Launch App
          </Link>
        </div>
      </header>
      <div className="min-h-screen pb-16">
        {/* Hero Section */}
        <section className="relative py-20 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-indigo-600/20 blur-[120px] rounded-full pointer-events-none" />

          <div className="container mx-auto max-w-7xl px-6 relative z-10">
            <div className="grid lg:grid-cols-2 gap-12 items-start">
              {/* Left Column - Main Content */}
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 mb-6">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-medium text-emerald-300 tracking-wide uppercase">Open-End, Truth-Driven Prediction Protocol</span>
                </div>

                <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6 leading-tight">
                  Prediction markets that <span className="text-emerald-400">terminate on truth</span>, not on time.
                </h1>

                <p className="text-lg text-slate-300 leading-relaxed mb-8">
                  Sooth is a fully on-chain protocol for <strong className="text-white">open-end prediction markets</strong> that use <strong className="text-indigo-400">retroactive finality</strong> to neutralize latency arbitrage and protect LPs, backed by a unified vault and <strong className="text-amber-400">multi-class adjudication</strong>.
                </p>

                <div className="flex flex-wrap gap-4 mb-8">
                  <a href="#sample" className="btn-primary">Explore Sample Markets</a>
                  <a href="#architecture" className="btn-secondary">View Protocol Architecture</a>
                </div>

                <div className="flex flex-wrap gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-slate-700 flex items-center justify-center text-[10px] font-bold text-white">∞</div>
                    <span className="text-slate-400">Live until truth</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-indigo-500 flex items-center justify-center text-[10px] font-bold text-white">4</div>
                    <span className="text-slate-400">Adjudicator classes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-violet-500 flex items-center justify-center text-[10px] font-bold text-white">ZK</div>
                    <span className="text-slate-400">Verified settlement</span>
                  </div>
                </div>
              </div>

              {/* Right Column - Market Snapshot Card */}
              <div>
                <Card className="bg-slate-900/60 border-slate-700">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-white">Sooth · Market Snapshot</h3>
                    <Badge variant="outline" className="text-[10px]">Sample</Badge>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div>
                      <div className="text-slate-500 text-xs mb-1">Market</div>
                      <div className="font-medium text-white">BTC 7-day TWAP &gt; $100k</div>
                      <div className="text-xs text-emerald-400 mt-1">Open-End</div>
                    </div>

                    <div className="pt-3 border-t border-slate-800">
                      <div className="text-slate-500 text-xs mb-1">Adjudicator: Oracle+ZK</div>
                    </div>

                    <div className="pt-3 border-t border-slate-800">
                      <div className="text-slate-500 text-xs mb-1">Current Implied Probability</div>
                      <div className="text-slate-500 text-xs mb-1">Vault-backed LMSR</div>
                      <div className="font-mono text-white text-lg">62% YES · 38% NO</div>
                    </div>

                    <div className="pt-3 border-t border-slate-800 space-y-1">
                      <div className="text-xs text-emerald-400">✓ Retroactive Finality</div>
                      <div className="text-xs text-slate-400">T* = Truth Time</div>
                      <div className="text-xs text-slate-400">Free-option resistant</div>
                      <div className="text-xs text-slate-400">Latency-agnostic</div>
                    </div>

                    <div className="text-[10px] text-slate-600 pt-3 border-t border-slate-800">
                      If the condition is met at T*, all trades after T* are economically rewound via ZK-verified settlement. No rollbacks. No LP bleed from stale quotes.
                    </div>

                    <div className="text-[10px] text-slate-500 pt-2">
                      Unified vault · Bounded-loss LMSR · Multi-adjudicator
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Sample Markets Section */}
        <section id="sample" className="py-16 bg-slate-950/30">
          <div className="container mx-auto max-w-7xl px-6">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-white mb-3">Sample Markets</h2>
              <p className="text-slate-400">
                Example Sooth-style open-end markets. These are mock datasets demonstrating how markets, adjudicators, and cooldown states appear in a UI.
              </p>
            </div>

            <div className="mb-6">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Unified Vault · LMSR vAMM</h3>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
              {/* Markets Table */}
              <div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-slate-500 border-b border-slate-800">
                        <th className="text-left pb-3 font-medium">Market</th>
                        <th className="text-left pb-3 font-medium">Adjudicator</th>
                        <th className="text-left pb-3 font-medium">Status</th>
                        <th className="text-right pb-3 font-medium">Implied YES</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-300">
                      <tr className="border-b border-slate-800/50">
                        <td className="py-3">BTC 7-day TWAP &gt; $100k</td>
                        <td className="py-3">
                          <Badge className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">Oracle+ZK</Badge>
                        </td>
                        <td className="py-3">
                          <span className="text-emerald-400 text-xs">Live · Open-End</span>
                        </td>
                        <td className="py-3 text-right font-mono">62%</td>
                      </tr>
                      <tr className="border-b border-slate-800/50">
                        <td className="py-3">"Protocol X hacked &gt; $1M?"</td>
                        <td className="py-3">
                          <Badge className="text-[10px] bg-violet-500/10 text-violet-400 border-violet-500/30">ZK Rule</Badge>
                        </td>
                        <td className="py-3">
                          <span className="text-amber-400 text-xs">Cooldown · T* pending</span>
                        </td>
                        <td className="py-3 text-right font-mono">41%</td>
                      </tr>
                      <tr className="border-b border-slate-800/50">
                        <td className="py-3">"UN Announces Confirmation of Alien Life"</td>
                        <td className="py-3">
                          <Badge className="text-[10px] bg-indigo-500/10 text-indigo-400 border-indigo-500/30">Optimistic</Badge>
                        </td>
                        <td className="py-3">
                          <span className="text-emerald-400 text-xs">Live · Open-End</span>
                        </td>
                        <td className="py-3 text-right font-mono">54%</td>
                      </tr>
                      <tr className="border-b border-slate-800/50">
                        <td className="py-3">"Stablecoin Z depegs &lt; 0.90"</td>
                        <td className="py-3">
                          <Badge className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">Oracle+ZK</Badge>
                        </td>
                        <td className="py-3">
                          <span className="text-slate-500 text-xs">Settled</span>
                        </td>
                        <td className="py-3 text-right font-mono">0%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 space-y-3 text-xs text-slate-500">
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5" />
                    <div>
                      <strong className="text-slate-400">Open-End, truth-driven termination</strong>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5" />
                    <div>
                      <strong className="text-slate-400">Cooldown enforced · Guardian mark</strong>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-500 mt-1.5" />
                    <div>
                      <strong className="text-slate-400">Settled via adjudicator + ZK accounting</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Adjudicator Classes */}
              <div>
                <Card className="h-full">
                  <h3 className="font-semibold text-white mb-4">Adjudicator classes</h3>

                  <div className="space-y-4 mb-6">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-slate-300">A</span>
                        <Badge className="text-[10px] bg-indigo-500/10 text-indigo-400 border-indigo-500/30">Optimistic (UMA / Reality-style)</Badge>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-slate-300">B</span>
                        <Badge className="text-[10px] bg-violet-500/10 text-violet-400 border-violet-500/30">ZK Rule (pure on-chain logic)</Badge>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-slate-300">C</span>
                        <Badge className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">Oracle + ZK enhancement</Badge>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-slate-300">D</span>
                        <Badge className="text-[10px] bg-slate-500/10 text-slate-400 border-slate-500/30">Attestation-based</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800 mb-6">
                    <h4 className="text-sm font-medium text-white mb-3">Open-End behavior</h4>
                    <p className="text-xs text-slate-400">
                      Markets do not expire on a fixed date. They remain live until an adjudicator reports a truth and a termination time T*. Settlement is computed back from T*, rewinding any latency-driven trades.
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-800">
                    <h4 className="text-sm font-medium text-white mb-3">LP perspective</h4>
                    <p className="text-xs text-slate-400">
                      LPs deposit into a singleton vault and earn fees and yield across all markets sharing that adjudicator class. LMSR ensures bounded loss; ZK settlement avoids loss-vs-rebalancing from stale quotes.
                    </p>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Protocol Architecture */}
        <section id="architecture" className="py-16">
          <div className="container mx-auto max-w-7xl px-6">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-white mb-3">Protocol Architecture</h2>
              <p className="text-slate-400">
                Sooth separates concerns across market, adjudication, liquidity, settlement, and account layers. Each layer is replaceable and governance-tunable.
              </p>
            </div>

            <div className="mb-6">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Layered Design · ZK-Ready</h3>
            </div>

            <div className="grid lg:grid-cols-3 gap-6 mb-12">
              <Card>
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">1 · Market Layer</div>
                <h3 className="font-semibold text-white mb-3">Open-End Markets</h3>
                <p className="text-sm text-slate-400 mb-4">
                  Markets are not tied to an expiry timestamp. They terminate solely on adjudicated truth, using a precise T* to define when an event became true. This structurally removes free-option attacks and latency arbitrage around resolution.
                </p>
                <ul className="text-xs text-slate-500 space-y-1">
                  <li>• Event-driven lifecycle</li>
                  <li>• Guardian-driven cooldown</li>
                  <li>• Retroactive settlement on T*</li>
                </ul>
              </Card>

              <Card>
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">2 · Liquidity Layer</div>
                <h3 className="font-semibold text-white mb-3">Singleton Vault + LMSR vAMM</h3>
                <p className="text-sm text-slate-400 mb-4">
                  A unified vault per (chain, adjudicator class) powers an LMSR vAMM that prices outcome exposure. Virtual liquidity can be weighted per market while preserving bounded vault loss.
                </p>
                <ul className="text-xs text-slate-500 space-y-1">
                  <li>• Unified LP exposure</li>
                  <li>• Virtual liquidity routing</li>
                  <li>• Bounded-loss LMSR curve</li>
                </ul>
              </Card>

              <Card>
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">3 · Settlement & Account Layer</div>
                <h3 className="font-semibold text-white mb-3">ZK-Verified PnL</h3>
                <p className="text-sm text-slate-400 mb-4">
                  Trades, positions, and T* feed into an off-chain ZK engine (e.g. Brevis) that computes per-account delta-PnL. A settlement batch with proof is posted on-chain and applied to Smart Accounts.
                </p>
                <ul className="text-xs text-slate-500 space-y-1">
                  <li>• Merkle-root settlement</li>
                  <li>• Proof-verified accounting</li>
                  <li>• Local PnL application per account</li>
                </ul>
              </Card>
            </div>

            {/* Landscape Positioning */}
            <Card className="bg-slate-900/40">
              <div className="mb-6">
                <h3 className="font-semibold text-white mb-3">Landscape Positioning</h3>
                <p className="text-sm text-slate-400 mb-2">
                  Sooth complements existing platforms like Polymarket, Kalshi, Omen, and HIP-4 by focusing on open-end, vault-backed, ZK-verifiable markets.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-800">
                      <th className="text-left pb-3 pr-4">Axis</th>
                      <th className="text-left pb-3 px-4">
                        <div className="font-semibold text-emerald-400">Sooth</div>
                        <div className="text-[10px] text-slate-500 font-normal">Event-perpetual · Truth-first</div>
                      </th>
                      <th className="text-left pb-3 px-4">Polymarket</th>
                      <th className="text-left pb-3 px-4">Kalshi</th>
                      <th className="text-left pb-3 px-4">Omen</th>
                      <th className="text-left pb-3 px-4">HIP-4</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-400">
                    <tr className="border-b border-slate-800/50">
                      <td className="py-3 pr-4 text-slate-500">Market Type</td>
                      <td className="py-3 px-4 text-white">Open-End, T*-driven</td>
                      <td className="py-3 px-4">Fixed event markets</td>
                      <td className="py-3 px-4">Fixed event contracts</td>
                      <td className="py-3 px-4">Fixed Q&A markets</td>
                      <td className="py-3 px-4">Event perps</td>
                    </tr>
                    <tr className="border-b border-slate-800/50">
                      <td className="py-3 pr-4 text-slate-500">Liquidity</td>
                      <td className="py-3 px-4 text-white">Vault + LMSR vAMM</td>
                      <td className="py-3 px-4">Hybrid CLOB / on-chain</td>
                      <td className="py-3 px-4">Centralized CLOB</td>
                      <td className="py-3 px-4">Per-market AMM pools</td>
                      <td className="py-3 px-4">On-chain CLOB</td>
                    </tr>
                    <tr className="border-b border-slate-800/50">
                      <td className="py-3 pr-4 text-slate-500">Resolution</td>
                      <td className="py-3 px-4 text-white">Multi-class + ZK settlement</td>
                      <td className="py-3 px-4">Oracle + optimistic</td>
                      <td className="py-3 px-4">Centralized oracle</td>
                      <td className="py-3 px-4">Reality.eth + arbitration</td>
                      <td className="py-3 px-4">Chosen oracle</td>
                    </tr>
                    <tr className="border-b border-slate-800/50">
                      <td className="py-3 pr-4 text-slate-500">Decentralization</td>
                      <td className="py-3 px-4 text-white">Fully on-chain protocol</td>
                      <td className="py-3 px-4">Hybrid infra</td>
                      <td className="py-3 px-4">Centralized exchange</td>
                      <td className="py-3 px-4">Fully on-chain</td>
                      <td className="py-3 px-4">Custom L1, semi-decentralized</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-slate-600 mt-6">
                Sooth is deliberately narrow: it aims to be the most expressive and secure base layer for truth-terminated, open-end markets, while remaining neutral infrastructure for any front-end or ecosystem that wants to build on top.
              </p>
            </Card>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 border-t border-slate-800/50 mt-16">
          <div className="container mx-auto max-w-7xl px-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-500 font-mono">
              <div>© 2025 Sooth Protocol</div>
              <div className="flex gap-6">
                <a href="#" className="hover:text-cyan-400 transition-colors">Whitepaper</a>
                <a href="#" className="hover:text-cyan-400 transition-colors">Docs</a>
                <a href="#" className="hover:text-cyan-400 transition-colors">GitHub</a>
                <Link to="/markets" className="hover:text-cyan-400 transition-colors">Launch App</Link>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};
