import { useState } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { SOOTH_MARKET_ABI } from '../config/abis';
import { useMarketStore } from '../store/useMarketStore';
import toast from 'react-hot-toast';
import { useActivityStore } from '../store/useActivityStore';

export function useGuardian(marketId: string) {
  const { mode, updateMarket } = useMarketStore();
  const [isPending, setIsPending] = useState(false);
  const { writeContractAsync } = useWriteContract();

  // In a real app, we would check if the connected wallet is the Guardian
  // const { address } = useAccount();
  // const isGuardian = address === GUARDIAN_ADDRESS;

  const pauseMarket = async () => {
    setIsPending(true);
    try {
      if (mode === 'demo') {
        await new Promise(r => setTimeout(r, 1000));
        updateMarket(marketId, { status: 'paused' });
        toast.success('Demo: Market Paused');
        useActivityStore.getState().addActivity({
          type: 'dispute',
          market: marketId,
          description: 'Market Paused (Guardian)',
          mode: 'demo',
          hash: `0x${Math.random().toString(16).slice(2)}`,
          timestamp: Date.now()
        });
        return;
      }

      // Real Mode
      // Note: This assumes the Market contract has a pause function or similar.
      // Based on standard Pausable implementation.
      await writeContractAsync({
        address: marketId as `0x${string}`, // Assuming marketId is address in real mode, or we look it up
        abi: SOOTH_MARKET_ABI,
        functionName: 'pause', // Verify ABI has this
        args: [],
      });
      toast.success('Market Paused');
    } catch (err: any) {
      toast.error(err.message || 'Pause failed');
    } finally {
      setIsPending(false);
    }
  };

  const unpauseMarket = async () => {
    setIsPending(true);
    try {
      if (mode === 'demo') {
        await new Promise(r => setTimeout(r, 1000));
        updateMarket(marketId, { status: 'trading' });
        toast.success('Demo: Market Unpaused');
        useActivityStore.getState().addActivity({
          type: 'dispute',
          market: marketId,
          description: 'Market Unpaused (Guardian)',
          mode: 'demo',
          hash: `0x${Math.random().toString(16).slice(2)}`,
          timestamp: Date.now()
        });
        return;
      }

      await writeContractAsync({
        address: marketId as `0x${string}`,
        abi: SOOTH_MARKET_ABI,
        functionName: 'unpause',
        args: [],
      });
      toast.success('Market Unpaused');
    } catch (err: any) {
      toast.error(err.message || 'Unpause failed');
    } finally {
      setIsPending(false);
    }
  };

  const forceSettle = async (outcome: 'YES' | 'NO') => {
    setIsPending(true);
    try {
      if (mode === 'demo') {
        await new Promise(r => setTimeout(r, 1000));
        updateMarket(marketId, { 
          status: 'settled',
          winningOutcome: outcome
        });
        toast.success(`Demo: Force Settled ${outcome}`);
        useActivityStore.getState().addActivity({
          type: 'dispute',
          market: marketId,
          description: `Force Settled: ${outcome}`,
          mode: 'demo',
          hash: `0x${Math.random().toString(16).slice(2)}`,
          timestamp: Date.now()
        });
        return;
      }

      // Real Mode: Guardian force settle logic
      // This usually interacts with the Settlement contract or Market contract directly depending on architecture
      // For now, we'll assume a direct call for simplicity or placeholder
      toast.error('Force Settle not yet implemented for Real Mode');
      
    } catch (err: any) {
      toast.error(err.message || 'Force Settle failed');
    } finally {
      setIsPending(false);
    }
  };

  return {
    pauseMarket,
    unpauseMarket,
    forceSettle,
    isPending
  };
}
