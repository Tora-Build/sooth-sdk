import { useAccount, useDisconnect } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { User, Copy, ExternalLink, LogOut, Check, Coins, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useUSDCBalance, useFaucet } from '../hooks';

export function Profile() {
  const { address, isConnected } = useAccount();
  const { open } = useAppKit();
  const { disconnect } = useDisconnect();
  const [copied, setCopied] = useState(false);
  const { balance, balanceFormatted, refetch } = useUSDCBalance(address);
  const { mint, isPending, isSuccess, reset } = useFaucet();

  const handleCopy = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleFaucet = () => {
    reset();
    mint(undefined, {
      onSuccess: () => {
        refetch();
        setTimeout(() => reset(), 3000);
      },
    });
  };

  if (!isConnected) {
    return (
      <div className="h-full w-full flex flex-col bg-mesh text-slate-100">
        <header className="shrink-0 pt-4 px-6 pb-4">
          <h1 className="text-2xl font-bold font-heading text-white">Profile</h1>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center px-6 pb-32">
          <div className="w-20 h-20 rounded-full glass-panel flex items-center justify-center mb-6">
            <User className="w-10 h-10 text-cyan-400" />
          </div>
          <p className="text-white font-bold text-lg mb-2">Welcome to Sooth Lite</p>
          <p className="text-white/40 text-sm text-center mb-6">
            Connect your wallet to get started
          </p>
          <button
            onClick={() => open()}
            className="px-8 py-4 rounded-2xl bg-cyan-500 text-white font-bold neon-cyan active:scale-95 transition-all"
          >
            Connect Wallet
          </button>
        </main>
      </div>
    );
  }

  const shortAddress = `${address?.slice(0, 6)}...${address?.slice(-4)}`;
  const hasNoBalance = balance === 0n;

  return (
    <div className="h-full w-full flex flex-col bg-mesh text-slate-100">
      <header className="shrink-0 pt-4 px-6 pb-4">
        <h1 className="text-2xl font-bold font-heading text-white mb-6">Profile</h1>

        <div className="flex items-center gap-4 p-4 rounded-2xl glass-panel">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500 to-fuchsia-500 flex items-center justify-center">
            <User className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-white font-bold">{shortAddress}</p>
            <p className="text-white/40 text-sm">Monad Testnet</p>
          </div>
          <button
            onClick={handleCopy}
            className="p-3 rounded-xl glass-panel hover:bg-white/5 transition-colors"
          >
            {copied ? (
              <Check className="w-5 h-5 text-cyan-400" />
            ) : (
              <Copy className="w-5 h-5 text-white/40" />
            )}
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 pb-32">
        <div className="p-4 rounded-2xl glass-panel mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] text-white/40 uppercase font-bold tracking-widest">USDC Balance</p>
            <p className="text-xl font-bold text-white">${balanceFormatted}</p>
          </div>
          <button
            onClick={handleFaucet}
            disabled={isPending}
            className={`w-full flex items-center justify-center gap-2 p-3 rounded-xl font-bold transition-all active:scale-95 ${
              isSuccess
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : hasNoBalance
                ? 'bg-cyan-500 text-white'
                : 'glass-panel text-white/70 hover:text-white'
            }`}
          >
            {isPending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Minting...
              </>
            ) : isSuccess ? (
              <>
                <Check className="w-5 h-5" />
                +1,000 USDC Added!
              </>
            ) : (
              <>
                <Coins className="w-5 h-5" />
                {hasNoBalance ? 'Get Free Test USDC' : 'Get More Test USDC'}
              </>
            )}
          </button>
        </div>

        <p className="text-[11px] text-white/40 uppercase font-bold tracking-widest mb-4">
          Links
        </p>

        <div className="space-y-2">
          <a
            href={`https://testnet.monadexplorer.com/address/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center gap-4 p-4 rounded-2xl glass-panel hover:bg-white/5 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
              <ExternalLink className="w-5 h-5 text-white/60" />
            </div>
            <span className="flex-1 text-left text-white font-medium">View on Explorer</span>
          </a>
        </div>

        <div className="mt-8">
          <button
            onClick={() => disconnect()}
            className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-bold">Disconnect</span>
          </button>
        </div>
      </main>
    </div>
  );
}
