import { Network } from 'lucide-react';
import { useNetwork } from '../lib/providers';

/**
 * NetworkSwitcher - shows the active network
 */
export function NetworkSwitcher() {
  const { activeNetwork } = useNetwork();

  return (
    <div className="h-10 px-3 flex items-center gap-2 rounded-lg bg-[#1a1a1b]/80 border border-[#333]">
      <Network className="w-4 h-4 text-[#00d4aa]" />
      <span className="text-sm font-semibold text-white">{activeNetwork.name}</span>
    </div>
  );
}

/**
 * Compact version for mobile
 */
export function NetworkSwitcherCompact() {
  const { activeNetwork } = useNetwork();

  return (
    <div className="h-8 px-2 flex items-center gap-1.5 rounded-md bg-[#1a1a1b]/80 border border-[#333]">
      <Network className="w-3.5 h-3.5 text-[#00d4aa]" />
      <span className="text-xs font-bold text-white">{activeNetwork.name}</span>
    </div>
  );
}
