import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_CHAIN_ID } from '../lib/chains';

interface ChainState {
  selectedChainId: number;
  setSelectedChain: (chainId: number) => void;
}

export const useChainStore = create<ChainState>()(
  persist(
    (set) => ({
      selectedChainId: DEFAULT_CHAIN_ID,
      setSelectedChain: (chainId: number) => set({ selectedChainId: chainId }),
    }),
    {
      name: 'sooth-chain-storage',
    }
  )
);
