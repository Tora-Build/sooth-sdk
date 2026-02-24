import { useAppKit } from '@reown/appkit/react';
import { useAccount } from 'wagmi';

export function WalletButton() {
  const { open } = useAppKit();
  const { address, isConnected } = useAccount();

  const shortAddr = (addr: string) => addr.slice(0, 6) + '...' + addr.slice(-4);

  return (
    <button
      onClick={() => open()}
      className="font-mono text-xs uppercase tracking-wider px-4 py-2 rounded-lg border transition-all
                 border-zinc-700 text-zinc-300 hover:border-amber-500/50 hover:text-amber-400"
    >
      {isConnected && address
        ? <span className="text-amber-400 border-amber-500/30">{shortAddr(address)}</span>
        : 'Connect Wallet'}
    </button>
  );
}
