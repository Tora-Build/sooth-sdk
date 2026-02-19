/**
 * Provider Registry & Context
 *
 * Manages the Monad provider and provides a React context.
 */

import { createContext, useContext } from 'react';
import type { Provider, NetworkConfig } from './types';
import { MonadProvider } from './monad';
import { MONAD_MAINNET_CHAIN_ID } from '../config';

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
];

/**
 * Provider registry - singleton instances
 */
class ProviderRegistry {
  private provider: Provider = new MonadProvider();

  get(_networkId: 'monad'): Provider {
    return this.provider;
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
 * Helper to get the provider
 */
export function getProvider(_networkId: 'monad' = 'monad'): Provider {
  return providerRegistry.get('monad');
}
