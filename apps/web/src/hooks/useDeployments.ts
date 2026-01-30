import { useEffect } from 'react';
import { getDeployment, getVersion, type ChainDeployment } from '@sooth/sdk-core';
import { DEFAULT_CHAIN_ID } from '../lib/chains';
import { useChainStore } from '../store/useChainStore';

// Define the shape of deployments for a single chain (legacy compat)
export interface ChainDeployments {
  MockUSDC: string;
  // Core (V4+)
  SoothTraderVault?: string;
  SoothLiquidityVault?: string;
  SoothFeeController?: string;
  LaunchpadFactory?: string;
  LaunchpadMarketImpl?: string;
  LaunchpadOutcomeToken?: string;
  SoothMarket?: string;
  [key: string]: string | undefined;
}

export function useDeployments() {
  const { selectedChainId } = useChainStore();
  const chainId = Number(selectedChainId) || DEFAULT_CHAIN_ID;

  const deployment = getDeployment(chainId) ?? getDeployment(DEFAULT_CHAIN_ID);
  const configVersion = getVersion();

  // Runtime guard: Detect stale browser cache
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sooth_config_version', configVersion);
    }
  }, [configVersion, deployment]);

  if (!deployment) {
    console.error(
      `[useDeployments] No deployments found for chain ${chainId} or default ${DEFAULT_CHAIN_ID}.`
    );
    return { contracts: {} as ChainDeployments, config: { contracts: {} as ChainDeployments } };
  }

  const contracts = deployment.contracts as unknown as ChainDeployments;
  return { contracts, config: { contracts } };
}

// Helper to get deployments for a specific chain ID (useful outside of hooks)
export function getDeployments(chainId: number) {
  const deployment = getDeployment(chainId) ?? getDeployment(DEFAULT_CHAIN_ID);
  return (deployment?.contracts ?? {}) as unknown as ChainDeployments;
}
