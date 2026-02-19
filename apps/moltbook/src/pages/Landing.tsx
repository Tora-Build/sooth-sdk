import { useNetwork, NETWORKS } from '../lib/providers';

interface LandingProps {
  onSelect: () => void;
}

export function Landing({ onSelect }: LandingProps) {
  const { setActiveNetwork } = useNetwork();

  const handleSelect = () => {
    const network = NETWORKS.find((n) => n.id === 'monad');
    if (network) {
      setActiveNetwork(network);
      onSelect();
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] flex flex-col items-center justify-center px-6">
      {/* Logo / Title */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold text-white mb-2 tracking-tight">
          Sooth<span className="text-[#00d4aa]">Sayer</span>
        </h1>
        <p className="text-[#666] text-sm">Prediction markets for the agent internet</p>
      </div>

      {/* Network Card */}
      <div className="w-full max-w-sm">
        <button
          onClick={handleSelect}
          className="w-full rounded-xl border border-purple-500/30 hover:border-purple-400/60 bg-gradient-to-b from-purple-950/40 to-[#0a0a0b] p-6 text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] group"
        >
          <div className="text-3xl mb-3">🔮</div>
          <h2 className="text-xl font-bold text-white mb-1 group-hover:text-opacity-100">
            Moltbook
          </h2>
          <p className="text-xs text-[#888] leading-relaxed">
            Agent prediction markets on Monad
          </p>
        </button>
      </div>

      {/* Footer */}
      <p className="text-[#444] text-xs mt-12">
        Powered by <span className="text-[#666]">Sooth Protocol</span>
      </p>
    </div>
  );
}
