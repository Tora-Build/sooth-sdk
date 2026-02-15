/**
 * Provider Registry & Context
 * 
 * Manages the active provider (Monad or Lens) and provides
 * a React context for network switching.
 */

import { createContext, useContext } from 'react';
import type { Provider, NetworkConfig } from './types';
import { MonadProvider } from './monad';
import { LensProvider } from './lens';
import { MONAD_MAINNET_CHAIN_ID } from '../config';
import { LENS_CHAIN_ID } from '../lensConfig';

/**
 * Available networks
 */
export const NETWORKS: NetworkConfig[] = [
  {
    id: 'monad',
    name: 'Moltbook',
    chainId: MONAD_MAINNET_CHAIN_ID,
    enabled: true,
  },
  {
    id: 'lens',
    name: 'Lens',
    chainId: LENS_CHAIN_ID,
    enabled: true,
  },
];

/**
 * Provider registry - singleton instances
 */
class ProviderRegistry {
  private providers: Map<string, Provider> = new Map();

  constructor() {
    this.providers.set('monad', new MonadProvider());
    this.providers.set('lens', new LensProvider());
  }

  get(networkId: 'monad' | 'lens'): Provider {
    const provider = this.providers.get(networkId);
    if (!provider) {
      throw new Error(`Provider not found: ${networkId}`);
    }
    return provider;
  }

  getAll(): Provider[] {
    return Array.from(this.providers.values());
  }
}

export const providerRegistry = new ProviderRegistry();

/**
 * Network Context - tracks the active network
 */
export interface NetworkContextValue {
  activeNetwork: NetworkConfig;
  setActiveNetwork: (network: NetworkConfig) => void;
  provider: Provider;
}

export const NetworkContext = createContext<NetworkContextValue | null>(null);

/**
 * Hook to access the current network context
 */
export function useNetwork(): NetworkContextValue {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within NetworkProvider');
  }
  return context;
}

/**
 * Helper to get a specific provider
 */
export function getProvider(networkId: 'monad' | 'lens'): Provider {
  return providerRegistry.get(networkId);
}
