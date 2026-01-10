import { Link } from 'react-router-dom';
import { Zap, ArrowRight, Shield, Clock, TrendingUp, Gauge, PenTool, Gamepad2, RefreshCcw, Swords } from 'lucide-react';

export const Landing = () => {
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-[#020617]">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-grid opacity-[0.15]" />

      {/* Blueprint Snippets */}
      <div className="absolute top-20 left-10 opacity-5 font-mono text-[10px] text-cyan-400 pointer-events-none select-none hidden lg:block">
        <pre>{`// tickbook_matching.sol
function match_orders(uint256 orderId) external {
    uint16 tick = bitmap.find_best_tick();
    // O(1) discovery
    _execute_fill(tick, orderId);
}`}</pre>
      </div>
      <div className="absolute bottom-20 right-10 opacity-5 font-mono text-[10px] text-cyan-400 pointer-events-none select-none hidden lg:block text-right">
        <pre>{`// zk_finality.proto
message SettlementProof {
    bytes32 merkle_root = 1;
    bytes snark_proof = 2;
    uint64 truth_timestamp = 3; // T*
}`}</pre>
      </div>

      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-cyan-500/5 blur-[80px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-cyan-500/5 blur-[80px] rounded-full pointer-events-none" />

      {/* Navbar */}
      <header className="relative z-10 h-16 border-b border-slate-800/30 backdrop-blur-md">
        <div className="container mx-auto max-w-7xl h-full px-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative">
              <img src="/sooth-logo.svg" alt="Sooth" className="w-8 h-8" />
              <div className="absolute inset-0 bg-cyan-500/30 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <span className="font-heading font-bold text-lg text-white tracking-tight">SOOTH</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link
              to="/create"
              className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-sm rounded-lg transition-all"
            >
              <Zap className="w-4 h-4" />
              Launch App
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-20">
        <div className="max-w-4xl mx-auto text-center relative">
          {/* HUD Elements */}
          <div className="absolute -top-12 left-0 right-0 flex justify-between items-center px-4 opacity-20 pointer-events-none select-none">
            <div className="flex gap-4 font-mono text-[10px] text-slate-500">
              <span>TRUTH_ENGINE: [RUNNING]</span>
              <span>NETWORK: [BASE_SEPOLIA]</span>
            </div>
            <div className="flex gap-4 font-mono text-[10px] text-slate-500">
              <span>LATENCY: 40MS</span>
              <span>SYNC_V8.1: OK</span>
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
            <Badge color="cyan">v8.1 Modular</Badge>
            <Badge color="indigo">Base Sepolia</Badge>
            <Badge color="purple">Monad Testnet</Badge>
            <Badge color="emerald">Arc Testnet</Badge>
          </div>

          {/* Title - Fluid Typography */}
          <h1 className="text-6xl sm:text-8xl md:text-9xl 2xl:text-[10rem] font-heading font-bold tracking-tighter mb-8 leading-[0.9]">
            <span className="text-white">SOOTH</span>
            <br />
            <span className="bg-gradient-to-r from-cyan-400 via-cyan-400 to-cyan-400 bg-clip-text text-transparent animate-gradient-cycle">
              PROTOCOL
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-xl sm:text-2xl text-slate-400 mb-6">
            The Permissionless Prediction Market Launchpad
          </p>

          <p className="text-base sm:text-lg text-slate-500 mb-12 max-w-2xl mx-auto font-mono">
            <span className="text-cyan-400">creator_economics</span> •
            <span className="text-cyan-400"> retroactive_finality</span> •
            <span className="text-cyan-400"> onchain_clob</span>
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
            <Link
              to="/create"
              className="group shimmer-swipe flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-black font-bold text-xl rounded-xl transition-all hover:shadow-2xl hover:shadow-cyan-500/30"
            >
              <Zap className="w-6 h-6" />
              Launch App
              <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/about"
              className="px-10 py-5 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white font-bold text-xl rounded-xl transition-all backdrop-blur-sm"
            >
              Learn
            </Link>
          </div>
        </div>

        {/* Actor Paths */}
        <div className="mt-40 max-w-5xl mx-auto w-full px-4">
          <div className="flex flex-col items-start mb-12">
            <h2 className="text-3xl font-heading font-bold text-white mb-4 tracking-tight uppercase">Choose Your Path</h2>
            <div className="h-1 w-20 bg-cyan-500 mb-6" />
            <p className="text-slate-400 text-left max-w-xl font-mono text-base leading-relaxed">
              Sooth is a cooperative value creation network. Select your role to access specialized venues.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { role: "Creator", icon: <PenTool className="w-5 h-5" />, path: "/create", desc: "Monetize market-making expertise and community insight", color: "purple" },
              { role: "Gaming Trader", icon: <Gamepad2 className="w-5 h-5" />, path: "/trade", desc: "Predict events and earn protocol stakeholder rewards", color: "emerald" },
              { role: "Arbitrageur", icon: <RefreshCcw className="w-5 h-5" />, path: "/pro", desc: "Capture spreads and maintain cross-venue efficiency", color: "cyan" },
              { role: "PvP Trader", icon: <Swords className="w-5 h-5" />, path: "/pro", desc: "Pure conviction trading on the 10,000-tick CLOB", color: "indigo" }
            ].map((actor) => (
              <Link
                key={actor.role}
                to={actor.path}
                className="group p-8 rounded-xl border border-slate-800/50 bg-slate-900/10 hover:bg-slate-900/30 hover:border-slate-700 transition-all flex flex-col items-start text-left relative overflow-hidden"
              >
                {/* Subtle background glow */}
                <div className={`absolute -top-10 -right-10 w-24 h-24 blur-[40px] opacity-10 group-hover:opacity-20 transition-opacity bg-${actor.color}-500`} />

                <div className="flex items-center gap-4 mb-6 relative z-10">
                  <div className={`p-3 rounded-lg bg-slate-950/50 border border-slate-800/50 group-hover:border-slate-700 transition-colors text-slate-400 group-hover:text-white`}>
                    {actor.icon}
                  </div>
                  <h3 className="text-white font-bold tracking-tight uppercase text-lg">{actor.role}</h3>
                </div>
                <p className="text-sm text-slate-500 leading-relaxed font-mono relative z-10">{actor.desc}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Protocol Pillars */}
        <div className="mt-40 max-w-5xl mx-auto w-full px-4">
          <div className="flex flex-col items-start mb-12">
            <h2 className="text-3xl font-heading font-bold text-white mb-4 tracking-tight uppercase">Protocol Pillars</h2>
            <div className="h-1 w-20 bg-cyan-500 mb-6" />
            <p className="text-slate-400 text-left max-w-xl font-mono text-base leading-relaxed">
              Foundational architecture designed for trustless resolution and capital efficiency.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <FeatureCard
              icon={<TrendingUp className="w-5 h-5" />}
              title="Launchpad"
              description="Permissionless creation with creator economics and aligned incentives."
              color="purple"
            />
            <FeatureCard
              icon={<Shield className="w-5 h-5" />}
              title="ZK Rules"
              description="Autonomous, retroactive settlement via T* for trustless resolution."
              color="indigo"
            />
            <FeatureCard
              icon={<Gauge className="w-5 h-5" />}
              title="TickBook"
              description="On-chain CLOB with 10,000-tick depth and constant-time discovery."
              color="cyan"
            />
            <FeatureCard
              icon={<Clock className="w-5 h-5" />}
              title="Open-End"
              description="Truth-driven resolution without forced liquidation timers."
              color="cyan"
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800/30 py-10 bg-slate-950/50 backdrop-blur-md">
        <div className="container mx-auto max-w-7xl px-6 flex flex-col md:flex-row justify-between items-center gap-6 text-sm text-slate-500">
          <div className="font-mono flex items-center gap-2 uppercase tracking-tighter">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            © 2025 Sooth Protocol | V10.6
          </div>
          <div className="flex items-center gap-8">
            <a href="https://docs.sooth.xyz" target="_blank" rel="noopener noreferrer" className="hover:text-cyan-400 transition-colors font-medium">Docs</a>
            <a href="https://github.com/sooth-protocol" target="_blank" rel="noopener noreferrer" className="hover:text-cyan-400 transition-colors font-medium">GitHub</a>
            <a href="https://discord.gg/sooth" target="_blank" rel="noopener noreferrer" className="hover:text-cyan-400 transition-colors font-medium">Discord</a>
            <a href="https://x.com/soothprotocol" target="_blank" rel="noopener noreferrer" className="hover:text-cyan-400 transition-colors font-medium">Twitter</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

const Badge = ({ children, color }: { children: React.ReactNode; color: 'cyan' | 'amber' | 'emerald' | 'indigo' | 'purple' }) => {
  const colors = {
    cyan: 'bg-cyan-500/5 border-cyan-500/10 text-cyan-500/70',
    amber: 'bg-slate-500/5 border-slate-500/10 text-slate-500/70',
    emerald: 'bg-emerald-500/5 border-emerald-500/10 text-emerald-500/70',
    indigo: 'bg-cyan-500/5 border-cyan-500/10 text-cyan-500/70',
    purple: 'bg-cyan-500/5 border-cyan-500/10 text-cyan-500/70',
  };

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-sm border backdrop-blur-sm transition-all duration-300 hover:border-current/30 hover:text-white/90 ${colors[color]}`}>
      <span className="text-[9px] font-mono font-bold uppercase tracking-[0.2em]">{children}</span>
    </div>
  );
};

const FeatureCard = ({
  icon,
  title,
  description,
  color
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: 'cyan' | 'purple' | 'indigo';
}) => {
  const colors = {
    cyan: 'border-cyan-500/5 hover:border-cyan-500/20 shadow-cyan-500/2',
    purple: 'border-cyan-500/5 hover:border-cyan-500/20 shadow-cyan-500/2',
    indigo: 'border-cyan-500/5 hover:border-cyan-500/20 shadow-cyan-500/2',
  };

  const iconColors = {
    cyan: 'text-cyan-500/50 group-hover:text-cyan-400',
    purple: 'text-cyan-500/50 group-hover:text-cyan-400',
    indigo: 'text-cyan-500/50 group-hover:text-cyan-400',
  };

  return (
    <div className={`group p-8 rounded-xl border bg-slate-900/10 backdrop-blur-sm transition-all duration-300 hover:bg-slate-900/30 flex flex-col items-start text-left ${colors[color]}`}>
      <div className="flex items-center gap-4 mb-6">
        <div className={`p-3 rounded-lg bg-slate-950/50 border border-slate-800/50 group-hover:border-slate-700 transition-colors ${iconColors[color]}`}>
          {icon}
        </div>
        <h3 className="text-lg font-heading font-bold text-white tracking-tight uppercase">{title}</h3>
      </div>
      <p className="text-sm text-slate-500 leading-relaxed font-mono">{description}</p>
    </div>
  );
};
