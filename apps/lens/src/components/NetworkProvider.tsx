import { useState, useMemo, type ReactNode } from 'react';
import { NetworkContext, NETWORKS, providerRegistry } from '../lib/providers';
import type { NetworkConfig } from '../lib/providers/types';

interface NetworkProviderProps {
  children: ReactNode;
}

/**
 * NetworkProvider - manages active network state
 */
export function NetworkProvider({ children }: NetworkProviderProps) {
  // Default to Monad
  const [activeNetwork, setActiveNetwork] = useState<NetworkConfig>(
    NETWORKS.find((n) => n.id === 'monad') || NETWORKS[0]
  );

  const contextValue = useMemo(
    () => ({
      activeNetwork,
      setActiveNetwork,
      provider: providerRegistry.get(activeNetwork.id),
    }),
    [activeNetwork]
  );

  return <NetworkContext.Provider value={contextValue}>{children}</NetworkContext.Provider>;
}
