import { Link } from 'react-router-dom';
import { Zap, ArrowRight, Shield, Clock, TrendingUp } from 'lucide-react';

export const Landing = () => {
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-grid opacity-50" />
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-cyan-500/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-fuchsia-500/10 blur-[150px] rounded-full pointer-events-none" />

      {/* Navbar */}
      <header className="relative z-10 h-16 border-b border-slate-800/30">
        <div className="container mx-auto max-w-7xl h-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/sooth-logo.svg" alt="Sooth" className="w-8 h-8" />
            <span className="font-heading font-bold text-xl text-white">SOOTH</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/about" className="text-sm text-slate-400 hover:text-white transition-colors">
              About
            </Link>
            <Link
              to="/markets"
              className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-sm rounded-lg transition-all"
            >
              Launch App
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-20">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badges */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-8 animate-fade-in">
            <Badge color="cyan">Base Sepolia</Badge>
            <Badge color="amber">BNB Testnet</Badge>
            <Badge color="emerald">MegaETH</Badge>
          </div>

          {/* Title */}
          <h1 className="text-5xl sm:text-7xl md:text-8xl font-heading font-bold tracking-tight mb-6 animate-slide-up">
            <span className="text-white">SOOTH</span>
            <br />
            <span className="bg-gradient-to-r from-cyan-400 to-fuchsia-400 bg-clip-text text-transparent">
              PROTOCOL
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-xl sm:text-2xl text-slate-400 mb-4 animate-slide-up" style={{ animationDelay: '0.05s' }}>
            On-chain Truth Market
          </p>

          <p className="text-base sm:text-lg text-slate-500 mb-10 max-w-2xl mx-auto font-mono animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <span className="text-cyan-400">open_end</span> • 
            <span className="text-fuchsia-400"> retroactive_finality</span> • 
            <span className="text-emerald-400"> zk_settlement</span>
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: '0.15s' }}>
            <Link
              to="/markets"
              className="group flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-black font-bold text-lg rounded-xl transition-all hover:shadow-xl hover:shadow-cyan-500/25"
            >
              <Zap className="w-5 h-5" />
              Launch App
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/about"
              className="px-8 py-4 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white font-bold text-lg rounded-xl transition-all"
            >
              Learn More
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mt-20 animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <FeatureCard
            icon={<Clock className="w-6 h-6" />}
            title="Open-End Markets"
            description="No expiry dates. Markets resolve when truth is known."
            color="cyan"
          />
          <FeatureCard
            icon={<Shield className="w-6 h-6" />}
            title="ZK Settlement"
            description="Cryptographic proof of resolution. No oracle trust."
            color="fuchsia"
          />
          <FeatureCard
            icon={<TrendingUp className="w-6 h-6" />}
            title="Launchpad Model"
            description="Create markets permissionlessly. Graduation mechanics."
            color="emerald"
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800/30 py-8">
        <div className="container mx-auto max-w-7xl px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-500">
          <div className="font-mono">© 2025 Sooth Protocol</div>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-cyan-400 transition-colors">Docs</a>
            <a href="#" className="hover:text-cyan-400 transition-colors">GitHub</a>
            <a href="#" className="hover:text-cyan-400 transition-colors">Discord</a>
            <a href="#" className="hover:text-cyan-400 transition-colors">Twitter</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

const Badge = ({ children, color }: { children: React.ReactNode; color: 'cyan' | 'amber' | 'emerald' }) => {
  const colors = {
    cyan: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',
    amber: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
  };

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${colors[color]}`}>
      <span className={`w-1.5 h-1.5 rounded-full bg-current animate-pulse`} />
      <span className="text-xs font-mono uppercase tracking-wider">{children}</span>
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
  color: 'cyan' | 'fuchsia' | 'emerald';
}) => {
  const colors = {
    cyan: 'border-cyan-500/20 hover:border-cyan-500/40',
    fuchsia: 'border-fuchsia-500/20 hover:border-fuchsia-500/40',
    emerald: 'border-emerald-500/20 hover:border-emerald-500/40',
  };

  const iconColors = {
    cyan: 'text-cyan-400',
    fuchsia: 'text-fuchsia-400',
    emerald: 'text-emerald-400',
  };

  return (
    <div className={`p-6 rounded-xl border bg-slate-900/50 backdrop-blur-sm transition-all ${colors[color]}`}>
      <div className={`mb-4 ${iconColors[color]}`}>{icon}</div>
      <h3 className="font-heading font-bold text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-400 font-mono">{description}</p>
    </div>
  );
};
