import { useAccount, useDisconnect } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { User, Copy, ExternalLink, LogOut, Check, Settings, Bell, Shield } from 'lucide-react';
import { useState } from 'react';

export function Profile() {
  const { address, isConnected } = useAccount();
  const { open } = useAppKit();
  const { disconnect } = useDisconnect();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isConnected) {
    return (
      <div className="h-full w-full flex flex-col bg-mesh text-slate-100">
        <header className="shrink-0 pt-14 px-6 pb-4">
          <h1 className="text-2xl font-bold font-heading text-white">Profile</h1>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center px-6 pb-32">
          <div className="w-20 h-20 rounded-full glass-panel flex items-center justify-center mb-6">
            <User className="w-10 h-10 text-cyan-400" />
          </div>
          <p className="text-white font-bold text-lg mb-2">Welcome to Pulse</p>
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

  return (
    <div className="h-full w-full flex flex-col bg-mesh text-slate-100">
      <header className="shrink-0 pt-14 px-6 pb-4">
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
        <p className="text-[11px] text-white/40 uppercase font-bold tracking-widest mb-4">
          Settings
        </p>

        <div className="space-y-2">
          <button className="w-full flex items-center gap-4 p-4 rounded-2xl glass-panel hover:bg-white/5 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
              <Bell className="w-5 h-5 text-white/60" />
            </div>
            <span className="flex-1 text-left text-white font-medium">Notifications</span>
          </button>

          <button className="w-full flex items-center gap-4 p-4 rounded-2xl glass-panel hover:bg-white/5 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white/60" />
            </div>
            <span className="flex-1 text-left text-white font-medium">Security</span>
          </button>

          <button className="w-full flex items-center gap-4 p-4 rounded-2xl glass-panel hover:bg-white/5 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
              <Settings className="w-5 h-5 text-white/60" />
            </div>
            <span className="flex-1 text-left text-white font-medium">Preferences</span>
          </button>

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
