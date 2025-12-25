import { useEffect } from 'react';
import deploymentsData from '../config/deployments.json';
import { DEFAULT_CHAIN_ID } from '../lib/chains';
import { useChainStore } from '../store/useChainStore';

// Define the shape of deployments for a single chain
export interface ChainDeployments {
  MockUSDC: string;
  // Core (V4+)
  SoothTraderVault?: string;
  SoothLiquidityVault?: string; // Renamed from SoothGovernorVault
  SoothFeeController?: string;
  LaunchpadFactory?: string;
  LaunchpadMarketImpl?: string;
  LaunchpadOutcomeToken?: string;

  // Markets (optional; many flows use markets.json instead)
  SoothMarket?: string;

  [key: string]: string | undefined;
}

// Define the shape of the deployments.json file
interface DeploymentsConfig {
  version: string;
  networks: {
    [networkName: string]: {
      chainId: number;
      contracts: ChainDeployments;
    }
  }
}

const deploymentsConfig = deploymentsData as unknown as DeploymentsConfig;

// Map chainId to network name
const CHAIN_ID_MAP: Record<number, string> = {
  84532: 'baseSepolia',
  97: 'bnbTestnet',
  10143: 'monadTestnet',
  6343: 'megaethTestnet',
  4326: 'megaethFrontier'
};

function resolveNetworkName(chainId: number): string | undefined {
  const mapped = CHAIN_ID_MAP[chainId];
  if (mapped && deploymentsConfig.networks[mapped]) return mapped;

  // Fallback: find by chainId in deployments.json (more robust than name mapping).
  const found = Object.entries(deploymentsConfig.networks).find(([, cfg]) => cfg?.chainId === chainId);
  return found?.[0];
}

export function useDeployments() {
  // Prefer app-selected chain (supports browsing chain A while wallet is on chain B).
  const { selectedChainId } = useChainStore();
  const chainId = Number(selectedChainId) || DEFAULT_CHAIN_ID;

  // Fallback to default chain if current chain is not supported by config
  const resolvedName = resolveNetworkName(chainId);
  const fallbackName = resolveNetworkName(DEFAULT_CHAIN_ID);
  const networkName = resolvedName ?? fallbackName;
  const chainDeployments = networkName ? deploymentsConfig.networks[networkName]?.contracts : undefined;
  const configVersion = deploymentsConfig.version;

  // Runtime guard: Detect stale browser cache
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedVersion = localStorage.getItem('sooth_config_version');
      // Always update to latest version
      localStorage.setItem('sooth_config_version', configVersion);
    }
  }, [configVersion, chainDeployments]);


  if (!chainDeployments) {
    console.error(
      `[useDeployments] No deployments found for chain ${chainId} or default ${DEFAULT_CHAIN_ID}. Check deployments.json.`
    );
    // Provide both shapes for callers: legacy `contracts` and newer `config.contracts`.
    return { contracts: {} as ChainDeployments, config: { contracts: {} as ChainDeployments } };
  }

  // Provide both shapes for callers: legacy `contracts` and newer `config.contracts`.
  return { contracts: chainDeployments, config: { contracts: chainDeployments } };
}

// Helper to get deployments for a specific chain ID (useful outside of hooks)
export function getDeployments(chainId: number) {
  const networkName = resolveNetworkName(chainId) ?? resolveNetworkName(DEFAULT_CHAIN_ID);
  return (networkName ? deploymentsConfig.networks[networkName]?.contracts : undefined) ?? ({} as ChainDeployments);
}
