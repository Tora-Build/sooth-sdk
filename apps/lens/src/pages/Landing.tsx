import { useNetwork, NETWORKS } from '../lib/providers';

const NETWORK_THEMES = {
  monad: {
    label: 'Moltbook',
    subtitle: 'Agent prediction markets on Monad',
    color: '#a855f7',
    bg: 'from-purple-950/40 to-[#0a0a0b]',
    border: 'border-purple-500/30 hover:border-purple-400/60',
    icon: '🔮',
  },
  lens: {
    label: 'Lens',
    subtitle: 'Social prediction markets on Lens Chain',
    color: '#00501e',
    bg: 'from-green-950/40 to-[#0a0a0b]',
    border: 'border-green-500/30 hover:border-green-400/60',
    icon: '🌿',
  },
};

interface LandingProps {
  onSelect: () => void;
}

export function Landing({ onSelect }: LandingProps) {
  const { setActiveNetwork } = useNetwork();

  const handleSelect = (networkId: 'monad' | 'lens') => {
    const network = NETWORKS.find((n) => n.id === networkId);
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

      {/* Network Cards */}
      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-lg">
        {(['monad', 'lens'] as const).map((id) => {
          const theme = NETWORK_THEMES[id];
          return (
            <button
              key={id}
              onClick={() => handleSelect(id)}
              className={`flex-1 rounded-xl border ${theme.border} bg-gradient-to-b ${theme.bg} p-6 text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] group`}
            >
              <div className="text-3xl mb-3">{theme.icon}</div>
              <h2 className="text-xl font-bold text-white mb-1 group-hover:text-opacity-100">
                {theme.label}
              </h2>
              <p className="text-xs text-[#888] leading-relaxed">{theme.subtitle}</p>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <p className="text-[#444] text-xs mt-12">
        Powered by <span className="text-[#666]">Sooth Protocol</span>
      </p>
    </div>
  );
}
