import { useChainId } from 'wagmi';
import { useEffect } from 'react';
import deploymentsData from '../config/deployments.json';
import { DEFAULT_CHAIN_ID } from '../lib/chains';

// Define the shape of deployments for a single chain
export interface ChainDeployments {
  MockUSDC: string;
  // Core (V4+)
  SoothTraderVault?: string;
  SoothGovernorVault?: string;
  SoothFeeController?: string;
  LaunchpadFactory?: string;
  LaunchpadMarketImpl?: string;
  LaunchpadOutcomeToken?: string;

  // Markets (optional; many flows use markets.json instead)
  SoothMarket?: string;

  // Optional/legacy infra (used by OperatorConsole or older deployments)
  SoothLMSRReal?: string;
  SoothAdjudicatorRegistry?: string;
  SoothSettlement?: string;
  SoothMarketFactory?: string;
  SoothVault?: string;
  SoothRiskManager?: string;
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
  6343: 'megaethTestnet'
};

export function useDeployments() {
  const chainId = useChainId();

  // Fallback to default chain if current chain is not supported
  const activeChainId = CHAIN_ID_MAP[chainId] ? chainId : DEFAULT_CHAIN_ID;
  const networkName = CHAIN_ID_MAP[activeChainId];
  const chainDeployments = deploymentsConfig.networks[networkName]?.contracts;
  const configVersion = deploymentsConfig.version;

  // Runtime guard: Detect stale browser cache (just log, don't reload)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedVersion = localStorage.getItem('sooth_config_version');
      if (storedVersion && storedVersion !== configVersion) {
        console.warn(`[useDeployments] Config version updated: ${storedVersion} → ${configVersion}`);
      }
      // Always update to latest version
      localStorage.setItem('sooth_config_version', configVersion);
    }
  }, [configVersion]);


  if (!chainDeployments) {
    console.error(`[useDeployments] No deployments found for chain ${chainId} or default ${DEFAULT_CHAIN_ID}. Check deployments.json.`);
    return { config: { contracts: {} as ChainDeployments } };
  }

  return { config: { contracts: chainDeployments } };
}

// Helper to get deployments for a specific chain ID (useful outside of hooks)
export function getDeployments(chainId: number) {
  const networkName = CHAIN_ID_MAP[chainId] || 'baseSepolia';
  return deploymentsConfig.networks[networkName]?.contracts;
}
