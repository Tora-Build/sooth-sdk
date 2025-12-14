import { useState } from 'react';
import { useAccount, useWriteContract, useReadContracts } from 'wagmi';
import { SOOTH_SETTLEMENT_ABI } from '../config/abis';
import { useDeployments } from './useDeployments';
import { useMarketStore } from '../store/useMarketStore';
import toast from 'react-hot-toast';
import { useActivityStore } from '../store/useActivityStore';

export function useSettlement(marketId: string) {
  const { address } = useAccount();
  const { mode, updateMarket } = useMarketStore();
  const [isPending, setIsPending] = useState(false);
  const { writeContractAsync } = useWriteContract();
  const deployments = useDeployments();

  const settlementAddress = deployments.SoothSettlement as `0x${string}` | undefined;

  // Read Settlement State
  // Safely convert marketId to BigInt, fallback to 0n if not possible
  let safeMarketId = 0n;
  if (mode === 'real') {
    try {
      // Try to convert if it's a hex string or numeric string
      safeMarketId = BigInt(marketId);
    } catch {
      // If conversion fails, use 0n (will disable contract reads)
      safeMarketId = 0n;
    }
  }

  const { data } = useReadContracts({
    contracts: [
      { address: settlementAddress, abi: SOOTH_SETTLEMENT_ABI, functionName: 'results', args: [safeMarketId] },
    ],
    query: { enabled: mode === 'real' && !!settlementAddress && !!marketId && safeMarketId !== 0n }
  });

  const [result] = data?.map(r => r.result) || [];

  const adjudicate = async (outcome: 'YES' | 'NO') => {
    setIsPending(true);
    try {
      if (mode === 'demo') {
        await new Promise(r => setTimeout(r, 1000));
        updateMarket(marketId, { 
          status: 'settling',
          winningOutcome: outcome 
        });
        toast.success(`Demo: Adjudicated ${outcome}`);
        useActivityStore.getState().addActivity({
          type: 'settle',
          market: marketId,
          description: `Adjudicated: ${outcome}`,
          mode: 'demo',
          hash: `0x${Math.random().toString(16).slice(2)}`,
          timestamp: Date.now()
        });
        return;
      }

      if (!settlementAddress) throw new Error('Settlement contract not configured for this chain (missing SoothSettlement in deployments.json)');

      // Real Mode: storeResult
      // Note: Requires Adjudicator/Owner role
      const hash = await writeContractAsync({
        address: settlementAddress,
        abi: SOOTH_SETTLEMENT_ABI,
        functionName: 'storeResult',
        args: [
          safeMarketId,
          '0x0000000000000000000000000000000000000000000000000000000000000000', // Mock Adjudicator ID
          outcome === 'YES' ? 1 : 0,
          BigInt(Math.floor(Date.now() / 1000))
        ],
      });
      toast.success('Adjudication submitted');
      useActivityStore.getState().addActivity({
        type: 'settle',
        market: marketId,
        description: `Adjudicated: ${outcome}`,
        mode: 'real',
        hash: hash,
        timestamp: Date.now()
      });
    } catch (err: any) {
      toast.error(err.message || 'Adjudication failed');
    } finally {
      setIsPending(false);
    }
  };

  const uploadPnL = async (root: string) => {
    setIsPending(true);
    try {
      if (mode === 'demo') {
        await new Promise(r => setTimeout(r, 1000));
        updateMarket(marketId, { 
          status: 'clearing',
          adjudicatorProofUploaded: true 
        });
        toast.success('Demo: PnL Uploaded');
        useActivityStore.getState().addActivity({
          type: 'settle',
          market: marketId,
          description: 'PnL Root Uploaded',
          mode: 'demo',
          hash: `0x${Math.random().toString(16).slice(2)}`,
          timestamp: Date.now()
        });
        return;
      }

      if (!settlementAddress) throw new Error('Settlement contract not configured for this chain (missing SoothSettlement in deployments.json)');

      // Real Mode: storeSettlementRoot
      const hash = await writeContractAsync({
        address: settlementAddress,
        abi: SOOTH_SETTLEMENT_ABI,
        functionName: 'storeSettlementRoot',
        args: [
          safeMarketId,
          '0x0000000000000000000000000000000000000000000000000000000000000000', // Mock Batch ID
          root as `0x${string}`,
          '0x' // Proof Meta
        ],
      });
      toast.success('PnL Root uploaded');
      useActivityStore.getState().addActivity({
        type: 'settle',
        market: marketId,
        description: 'PnL Root Uploaded',
        mode: 'real',
        hash: hash,
        timestamp: Date.now()
      });
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setIsPending(false);
    }
  };

  const claim = async (pnl: bigint, proof: `0x${string}`[]) => {
    setIsPending(true);
    try {
      if (mode === 'demo') {
        await new Promise(r => setTimeout(r, 1000));
        toast.success('Demo: Claimed Winnings');
        useActivityStore.getState().addActivity({
          type: 'settle',
          market: marketId,
          description: 'Claimed Winnings',
          mode: 'demo',
          hash: `0x${Math.random().toString(16).slice(2)}`,
          timestamp: Date.now()
        });
        return;
      }

      if (!settlementAddress) throw new Error('Settlement contract not configured for this chain (missing SoothSettlement in deployments.json)');

      const hash = await writeContractAsync({
        address: settlementAddress,
        abi: SOOTH_SETTLEMENT_ABI,
        functionName: 'claimSettlement',
        args: [
          safeMarketId,
          '0x0000000000000000000000000000000000000000000000000000000000000000', // Mock Batch ID
          pnl,
          proof
        ],
      });
      toast.success('Claim submitted');
      useActivityStore.getState().addActivity({
        type: 'settle',
        market: marketId,
        description: 'Claimed Winnings',
        mode: 'real',
        hash: hash,
        timestamp: Date.now()
      });
    } catch (err: any) {
      toast.error(err.message || 'Claim failed');
    } finally {
      setIsPending(false);
    }
  };

  return {
    adjudicate,
    uploadPnL,
    claim,
    isPending,
    result,
  };
}
