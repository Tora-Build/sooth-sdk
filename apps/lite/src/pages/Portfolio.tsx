import { useAccount } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { PieChart, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { useUSDCBalance } from '../hooks';

export function Portfolio() {
  const { address, isConnected } = useAccount();
  const { open } = useAppKit();
  const { balanceFormatted } = useUSDCBalance(address);

  if (!isConnected) {
    return (
      <div className="h-full w-full flex flex-col bg-mesh text-slate-100">
        <header className="shrink-0 pt-14 px-6 pb-4">
          <h1 className="text-2xl font-bold font-heading text-white">Vault</h1>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center px-6 pb-32">
          <div className="w-20 h-20 rounded-3xl glass-panel flex items-center justify-center mb-6">
            <Wallet className="w-10 h-10 text-cyan-400" />
          </div>
          <p className="text-white font-bold text-lg mb-2">Connect Your Wallet</p>
          <p className="text-white/40 text-sm text-center mb-6">
            Connect to view your positions and balance
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

  return (
    <div className="h-full w-full flex flex-col bg-mesh text-slate-100">
      <header className="shrink-0 pt-14 px-6 pb-4">
        <h1 className="text-2xl font-bold font-heading text-white mb-4">Vault</h1>

        <div className="p-6 rounded-3xl glass-panel">
          <p className="text-[11px] text-white/40 uppercase font-bold tracking-widest mb-2">
            Total Balance
          </p>
          <p className="text-4xl font-bold text-white font-mono mb-4">
            ${balanceFormatted || '0.00'}
          </p>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <p className="text-[10px] text-white/40 uppercase">Profit</p>
                <p className="text-sm font-bold text-cyan-400">+$0.00</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-fuchsia-500/20 flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-fuchsia-400" />
              </div>
              <div>
                <p className="text-[10px] text-white/40 uppercase">Loss</p>
                <p className="text-sm font-bold text-fuchsia-400">-$0.00</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 pb-32">
        <p className="text-[11px] text-white/40 uppercase font-bold tracking-widest mb-4">
          Your Positions
        </p>

        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-2xl glass-panel flex items-center justify-center mb-4">
            <PieChart className="w-8 h-8 text-white/20" />
          </div>
          <p className="text-white/40 text-center">No positions yet</p>
          <p className="text-white/30 text-sm text-center mt-1">
            Start trading to see your positions here
          </p>
        </div>
      </main>
    </div>
  );
}
