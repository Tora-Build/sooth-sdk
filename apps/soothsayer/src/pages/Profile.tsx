import { useAccount, useDisconnect } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { User, Copy, ExternalLink, LogOut, Check, Coins, Loader2, Wallet, Database } from 'lucide-react';
import { useState } from 'react';
import { useUSDCBalance, useFaucet, useIndexerHealth } from '../hooks';

export function Profile() {
  const { address, isConnected } = useAccount();
  const { open } = useAppKit();
  const { disconnect } = useDisconnect();
  const [copied, setCopied] = useState(false);
  const { balance, balanceFormatted, refetch } = useUSDCBalance(address);
  const { mint, isPending, isSuccess, reset } = useFaucet();
  const { data: isIndexerOnline, isLoading: indexerLoading } = useIndexerHealth();

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
      <div className="h-full w-full flex flex-col bg-mesh text-white">
        <header className="shrink-0 pt-4 px-6 pb-4">
          <h1 className="text-2xl font-bold font-heading text-white">Profile</h1>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center px-6 pb-32">
          <div className="w-20 h-20 rounded-2xl glass-panel flex items-center justify-center mb-6 border border-[#444]">
            <Wallet className="w-10 h-10 text-[#00d4aa]" />
          </div>
          <p className="text-white font-bold text-lg mb-2">Connect Your Wallet</p>
          <p className="text-[#888] text-sm text-center mb-6">
            Connect to view your positions and balance
          </p>
          <button
            onClick={() => open()}
            className="px-8 py-4 rounded-2xl bg-gradient-to-r from-[#00d4aa] to-[#00b894] text-[#1a1a1b] font-bold neon-teal active:scale-95 transition-all"
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
    <div className="h-full w-full flex flex-col bg-mesh text-white">
      <header className="shrink-0 pt-4 px-6">
        <h1 className="text-2xl font-bold font-heading text-white mb-2">Profile</h1>
      </header>

      <main className="flex-1 overflow-y-auto px-6 pb-24 space-y-3">
        <div className="flex items-center gap-3 p-3.5 rounded-2xl glass-panel border border-[#444]">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00d4aa] to-[#e01b24] flex items-center justify-center">
            <User className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm tracking-tight">{shortAddress}</p>
            <p className="text-[#888] text-[10px] uppercase font-bold tracking-wider">Monad Testnet</p>
          </div>
          <button
            onClick={handleCopy}
            className="p-2 rounded-xl glass-panel hover:bg-[#444] transition-colors border border-[#444]"
            aria-label={copied ? "Address copied" : "Copy wallet address"}
          >
            {copied ? (
              <Check className="w-4 h-4 text-[#00d4aa]" />
            ) : (
              <Copy className="w-4 h-4 text-[#888]" />
            )}
          </button>
        </div>

        <div className="p-4 rounded-2xl glass-panel border border-[#444]">
          <p className="text-[10px] text-[#888] uppercase font-bold tracking-widest mb-0.5">Balance</p>
          <p className="text-3xl font-bold text-[#00d4aa] font-mono mb-3">${balanceFormatted}</p>
          <button
            onClick={handleFaucet}
            disabled={isPending}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all active:scale-95 ${isSuccess
              ? 'bg-[#00d4aa]/20 text-[#00d4aa] border border-[#00d4aa]/30'
              : hasNoBalance
                ? 'bg-gradient-to-r from-[#00d4aa] to-[#00b894] text-[#1a1a1b]'
                : 'glass-panel text-[#888] hover:text-white border border-[#444]'
              }`}
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Minting...
              </>
            ) : isSuccess ? (
              <>
                <Check className="w-4 h-4" />
                +100,000 USDC Added!
              </>
            ) : (
              <>
                <Coins className="w-4 h-4" />
                {hasNoBalance ? 'Get Free Test USDC' : 'Get More Test USDC'}
              </>
            )}
          </button>
        </div>

        <a
          href={`https://testnet.monadexplorer.com/address/${address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-3 rounded-2xl glass-panel hover:bg-[#444] transition-colors border border-[#444]"
        >
          <div className="w-9 h-9 rounded-lg bg-[#1a1a1b] flex items-center justify-center">
            <ExternalLink className="w-4 h-4 text-[#888]" />
          </div>
          <span className="flex-1 text-left text-white font-medium text-sm">View on Explorer</span>
        </a>

        {/* Indexer Status Indicator */}
        <div className="flex items-center gap-3 p-3 rounded-2xl glass-panel border border-[#444]">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${indexerLoading ? 'bg-[#444]' : isIndexerOnline ? 'bg-[#00d4aa]/20' : 'bg-[#e01b24]/20'
            }`}>
            <Database className={`w-4 h-4 ${indexerLoading ? 'text-[#888] animate-pulse' : isIndexerOnline ? 'text-[#00d4aa]' : 'text-[#e01b24]'
              }`} />
          </div>
          <div className="flex-1">
            <p className="text-white font-medium text-sm">
              {indexerLoading ? 'Checking...' : isIndexerOnline ? 'Indexer Online' : 'RPC Fallback Mode'}
            </p>
            <p className="text-[10px] text-[#888] uppercase tracking-wider">
              {indexerLoading ? 'Connecting' : isIndexerOnline ? 'Fast data sync' : 'Slower • May hit rate limits'}
            </p>
          </div>
          <div className={`w-2 h-2 rounded-full ${indexerLoading ? 'bg-[#888] animate-pulse' : isIndexerOnline ? 'bg-[#00d4aa]' : 'bg-[#e01b24]'
            }`} />
        </div>

        <button
          onClick={() => disconnect()}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-[#e01b24]/30 text-[#e01b24] hover:bg-[#e01b24]/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span className="font-bold text-sm">Disconnect</span>
        </button>
      </main>
    </div>
  );
}
