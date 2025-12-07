import { useChainId } from 'wagmi';
import deploymentsData from '../config/deployments.json';
import { DEFAULT_CHAIN_ID } from '../lib/chains';

// Define the shape of deployments for a single chain
export interface ChainDeployments {
  MockUSDC: string;
  // v2: New contracts
  SoothTraderVault?: string;
  SoothGovernorVault?: string;
  SoothFeeController?: string;
  // v1: Legacy (kept for backward compatibility)
  SoothVault?: string;
  SoothRiskManager?: string;
  // Shared
  SoothLMSRReal: string;
  SoothAdjudicatorRegistry: string;
  SoothSettlement: string;
  SoothMarketFactory: string;
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
  10143: 'monadTestnet',
  6343: 'megaethTestnet'
};

export function useDeployments() {
  const chainId = useChainId();
  
  // Fallback to default chain if current chain is not supported
  const activeChainId = CHAIN_ID_MAP[chainId] ? chainId : DEFAULT_CHAIN_ID;
  const networkName = CHAIN_ID_MAP[activeChainId];
  const chainDeployments = deploymentsConfig.networks[networkName]?.contracts;


  if (!chainDeployments) {
    console.error(`[useDeployments] No deployments found for chain ${chainId} or default ${DEFAULT_CHAIN_ID}. Check deployments.json.`);
    return {} as ChainDeployments;
  }
  
  return chainDeployments;
}

// Helper to get deployments for a specific chain ID (useful outside of hooks)
export function getDeployments(chainId: number) {
    const networkName = CHAIN_ID_MAP[chainId] || 'baseSepolia';
    return deploymentsConfig.networks[networkName]?.contracts;
}
