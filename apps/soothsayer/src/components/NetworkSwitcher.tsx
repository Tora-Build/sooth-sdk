import { Network } from 'lucide-react';
import { useNetwork, NETWORKS } from '../lib/providers';

/**
 * NetworkSwitcher - toggle between Monad and Lens networks
 */
export function NetworkSwitcher() {
  const { activeNetwork, setActiveNetwork } = useNetwork();

  const handleSwitch = () => {
    const currentIndex = NETWORKS.findIndex((n) => n.id === activeNetwork.id);
    const nextIndex = (currentIndex + 1) % NETWORKS.length;
    setActiveNetwork(NETWORKS[nextIndex]);
  };

  return (
    <button
      onClick={handleSwitch}
      className="h-10 px-3 flex items-center gap-2 rounded-lg bg-[#1a1a1b]/80 border border-[#333] hover:bg-[#2a2a2b] transition-colors"
      aria-label="Switch network"
    >
      <Network className="w-4 h-4 text-[#00d4aa]" />
      <span className="text-sm font-semibold text-white">{activeNetwork.name}</span>
    </button>
  );
}

/**
 * Compact version for mobile
 */
export function NetworkSwitcherCompact() {
  const { activeNetwork, setActiveNetwork } = useNetwork();

  const handleSwitch = () => {
    const currentIndex = NETWORKS.findIndex((n) => n.id === activeNetwork.id);
    const nextIndex = (currentIndex + 1) % NETWORKS.length;
    setActiveNetwork(NETWORKS[nextIndex]);
  };

  return (
    <button
      onClick={handleSwitch}
      className="h-8 px-2 flex items-center gap-1.5 rounded-md bg-[#1a1a1b]/80 border border-[#333] active:scale-95 transition-transform"
      aria-label="Switch network"
    >
      <Network className="w-3.5 h-3.5 text-[#00d4aa]" />
      <span className="text-xs font-bold text-white">{activeNetwork.name}</span>
    </button>
  );
}
