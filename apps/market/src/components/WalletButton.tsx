import { useAppKit, useAppKitAccount } from '@reown/appkit/react';

export function WalletButton() {
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();

  const shortAddr = (addr: string) => addr.slice(0, 6) + '...' + addr.slice(-4);

  if (isConnected && address) {
    return (
      <button
        onClick={() => open({ view: 'Account' })}
        className="flex items-center gap-2 bg-zinc-900 border border-white/[0.06] text-zinc-300 hover:border-white/[0.12] hover:text-zinc-100 px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-[0.98]"
      >
        <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
        <span className="font-mono text-xs">{shortAddr(address)}</span>
      </button>
    );
  }

  return (
    <button
      onClick={() => open()}
      className="bg-zinc-900 border border-white/[0.06] text-zinc-300 hover:border-white/[0.12] hover:text-zinc-100 px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-[0.98]"
    >
      Connect Wallet
    </button>
  );
}
