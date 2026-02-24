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
                 border-zinc-700 text-zinc-300 hover:border-cyan-500/50 hover:text-cyan-400"
    >
      {isConnected && address
        ? shortAddr(address)
        : 'Connect Wallet'}
    </button>
  );
}
