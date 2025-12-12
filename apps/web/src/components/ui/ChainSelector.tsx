import React, { useState } from 'react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { ChevronDown, AlertCircle } from 'lucide-react';
import { allowedChains, getChainById, DEFAULT_CHAIN_ID } from '../../lib/chains';
import { useChainStore } from '../../store/useChainStore';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';

export const ChainSelector: React.FC = () => {
  const { isConnected } = useAccount();
  const walletChainId = useChainId();
  const { selectedChainId, setSelectedChain } = useChainStore();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const [isOpen, setIsOpen] = useState(false);

  const selectedChain = getChainById(selectedChainId);
  const walletChain = getChainById(walletChainId);
  const isWrongNetwork = isConnected && walletChainId !== selectedChainId && !isSwitching;

  const handleChainSwitch = async (chainId: number) => {
    setIsOpen(false);

    // Update selected chain in store
    setSelectedChain(chainId);

    // If wallet is connected, try to switch
    if (isConnected && switchChain) {
      try {
        await switchChain({ chainId });
        toast.success(`Switched to ${getChainById(chainId)?.name}`);
      } catch (error: any) {
        console.error('Chain switch failed:', error);
        if (error.message?.includes('rejected')) {
          toast.error('Chain switch rejected by wallet');
        } else {
          toast.error('Failed to switch chain. Please switch manually in your wallet.');
        }
      }
    }
  };

  // If selected chain is invalid (e.g., removed from allowedChains), reset to default
  React.useEffect(() => {
    if (!selectedChain && isConnected) {
      setSelectedChain(DEFAULT_CHAIN_ID);
    }
  }, [selectedChain, isConnected, setSelectedChain]);

  // Only show when wallet is connected
  if (!isConnected) return null;

  // Use fallback chain if selectedChain is invalid
  const displayChain = selectedChain || getChainById(84532); // Fallback to Base Sepolia
  if (!displayChain) return null;

  return (
    <div className="relative" style={{ zIndex: 100 }}>
      {/* Main Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border transition-all text-xs sm:text-sm font-medium",
          isWrongNetwork
            ? "bg-rose-500/10 border-rose-500/30 text-rose-400 hover:border-rose-500/50"
            : "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/80"
        )}
      >
        <span>{displayChain.displayName}</span>
        <ChevronDown size={14} className={cn("transition-transform", isOpen && "rotate-180")} />
      </button>

      {/* Wrong Network Warning */}
      {isWrongNetwork && walletChain && (
        <div className="absolute top-full left-0 mt-2 w-64 p-3 bg-rose-950/90 border border-rose-500/30 rounded-lg shadow-xl z-[70] backdrop-blur-sm">
          <div className="flex items-start gap-2 mb-2">
            <AlertCircle size={16} className="text-rose-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-rose-200">
              <p className="font-semibold mb-1">Wrong Network</p>
              <p className="text-rose-300/80">
                Wallet is on <span className="font-mono">{walletChain.name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={() => handleChainSwitch(Number(selectedChainId))}
            className="w-full mt-2 px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-medium rounded transition-colors"
          >
            Switch to {displayChain.name}
          </button>
        </div>
      )}

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[55]"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="absolute top-full right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-lg shadow-xl z-[70] overflow-hidden">
            <div className="p-2 border-b border-slate-800">
              <p className="text-xs text-slate-500 uppercase tracking-wider font-medium px-2">
                Select Network
              </p>
            </div>
            <div className="p-1">
              {allowedChains.filter(chain => chain.type === 'evm').map((chain) => {
                const isSelected = chain.id === selectedChainId;
                const isWalletChain = chain.id === walletChainId;

                return (
                  <button
                    key={chain.id}
                    onClick={() => handleChainSwitch(typeof chain.id === 'number' ? chain.id : DEFAULT_CHAIN_ID)}
                    disabled={isSelected}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                      isSelected
                        ? "bg-indigo-500/10 text-indigo-400 cursor-default"
                        : "text-slate-300 hover:bg-slate-800/80"
                    )}
                  >
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      isSelected ? "bg-emerald-500" : "bg-transparent"
                    )} />
                    <div className="flex-1 text-left">
                      <div className="font-medium">{chain.name}</div>
                      <div className="text-xs text-slate-500">
                        {chain.nativeCurrency.symbol}
                      </div>
                    </div>

                    {isWalletChain && !isSelected && (
                      <div className="text-xs text-emerald-400 font-medium">Connected</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
