import { Link } from 'react-router-dom';
import { Zap, ArrowRight, Shield, Clock, TrendingUp, Gauge } from 'lucide-react';

export const Landing = () => {
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-[#020617]">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-grid opacity-[0.15]" />
      
      {/* Blueprint Snippets */}
      <div className="absolute top-20 left-10 opacity-5 font-mono text-[10px] text-cyan-400 pointer-events-none select-none hidden lg:block">
        <pre>{`// vAMM_math.rs
fn calculate_cost(q_yes: i256, q_no: i256, b: u256) -> i256 {
    let price = exp(q_yes/b) / (exp(q_yes/b) + exp(q_no/b));
    return (price * shares) / WAD;
}`}</pre>
      </div>
      <div className="absolute bottom-20 right-10 opacity-5 font-mono text-[10px] text-purple-400 pointer-events-none select-none hidden lg:block text-right">
        <pre>{`// zk_finality.proto
message SettlementProof {
    bytes32 merkle_root = 1;
    bytes snark_proof = 2;
    uint64 truth_timestamp = 3;
}`}</pre>
      </div>

      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-cyan-500/5 blur-[80px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-indigo-500/5 blur-[80px] rounded-full pointer-events-none" />

      {/* Navbar */}
      <header className="relative z-10 h-16 border-b border-slate-800/30 backdrop-blur-md">
        <div className="container mx-auto max-w-7xl h-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/sooth-logo.svg" alt="Sooth" className="w-8 h-8" />
            <span className="font-heading font-bold text-xl text-white tracking-widest">SOOTH</span>
          </div>
          <div className="flex items-center gap-6">
            <Link
              to="/markets"
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
        <div className="max-w-4xl mx-auto text-center">
          {/* Badges */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
            <Badge color="cyan">Base Sepolia</Badge>
            <Badge color="indigo">MegaETH Frontier</Badge>
          </div>

          {/* Title - Fluid Typography */}
          <h1 className="text-6xl sm:text-8xl md:text-9xl 2xl:text-[10rem] font-heading font-bold tracking-tighter mb-8 leading-[0.9]">
            <span className="text-white">SOOTH</span>
            <br />
            <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent animate-gradient-cycle">
              PROTOCOL
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-xl sm:text-2xl text-slate-400 mb-6">
            Layered Architecture for Retroactive Finality
          </p>

          <p className="text-base sm:text-lg text-slate-500 mb-12 max-w-2xl mx-auto font-mono">
            <span className="text-cyan-400">modular_market</span> • 
            <span className="text-purple-400"> liquid_graduation</span> • 
            <span className="text-indigo-400"> dual_dex_engine</span>
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
            <Link
              to="/markets"
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
              About
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-6xl mx-auto mt-24">
          <FeatureCard
            icon={<Clock className="w-7 h-7" />}
            title="Open-End"
            description="Retroactive resolution based on truth, not timers."
            color="cyan"
          />
          <FeatureCard
            icon={<Shield className="w-7 h-7" />}
            title="ZK Finality"
            description="Trustless settlement with cryptographic proof."
            color="indigo"
          />
          <FeatureCard
            icon={<TrendingUp className="w-7 h-7" />}
            title="Launchpad"
            description="Permissionless creation with liquidity graduation."
            color="purple"
          />
          <FeatureCard
            icon={<Gauge className="w-7 h-7" />}
            title="MegaETH"
            description="Hyper-orderbook throughput on Frontier."
            color="cyan"
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800/30 py-10 bg-slate-950/50 backdrop-blur-md">
        <div className="container mx-auto max-w-7xl px-6 flex flex-col md:flex-row justify-between items-center gap-6 text-sm text-slate-500">
          <div className="font-mono flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500/30" />
            © 2025 Sooth Protocol | v6.1.8-alpha
          </div>
          <div className="flex items-center gap-8">
            <a href="#" className="hover:text-cyan-400 transition-colors font-medium">Docs</a>
            <a href="#" className="hover:text-cyan-400 transition-colors font-medium">GitHub</a>
            <a href="#" className="hover:text-cyan-400 transition-colors font-medium">Discord</a>
            <a href="#" className="hover:text-cyan-400 transition-colors font-medium">Twitter</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

const Badge = ({ children, color }: { children: React.ReactNode; color: 'cyan' | 'amber' | 'emerald' | 'indigo' }) => {
  const colors = {
    cyan: 'bg-cyan-500/5 border-cyan-500/20 text-cyan-400 shadow-[0_0_15px_-5px_rgba(6,182,212,0.3)]',
    amber: 'bg-amber-500/5 border-amber-500/20 text-amber-400 shadow-[0_0_15px_-5px_rgba(245,158,11,0.3)]',
    emerald: 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400 shadow-[0_0_15px_-5px_rgba(16,185,129,0.3)]',
    indigo: 'bg-indigo-500/5 border-indigo-500/20 text-indigo-400 shadow-[0_0_15px_-5px_rgba(99,102,241,0.3)]',
  };

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-md transition-[transform,border-color] duration-300 hover:scale-[1.03] hover:border-current/40 ${colors[color]}`}>
      <span className="text-[10px] font-mono font-bold uppercase tracking-widest">{children}</span>
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
    cyan: 'border-cyan-500/10 hover:border-cyan-500/30 shadow-cyan-500/5',
    purple: 'border-purple-500/10 hover:border-purple-500/30 shadow-purple-500/5',
    indigo: 'border-indigo-500/10 hover:border-indigo-500/30 shadow-indigo-500/5',
  };

  const iconColors = {
    cyan: 'text-cyan-400',
    purple: 'text-purple-400',
    indigo: 'text-indigo-400',
  };

  return (
    <div className={`p-8 rounded-2xl border bg-slate-900/40 backdrop-blur-sm transition-[transform,background-color,border-color] duration-300 hover:scale-[1.01] hover:bg-slate-900/60 shadow-lg ${colors[color]}`}>
      <div className={`mb-5 ${iconColors[color]}`}>{icon}</div>
      <h3 className="text-lg font-heading font-bold text-white mb-3">{title}</h3>
      <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
    </div>
  );
};
