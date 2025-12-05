import { useChainId } from 'wagmi';
import deploymentsData from '../config/deployments.json';
import { DEFAULT_CHAIN_ID } from '../lib/chains';

// Define the shape of deployments for a single chain
export interface ChainDeployments {
  MockERC20: string;
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
  [chainId: string]: ChainDeployments;
}

const deployments = deploymentsData as DeploymentsConfig;

export function useDeployments() {
  const chainId = useChainId();
  
  // Fallback to default chain if current chain is not supported
  const activeChainId = deployments[chainId] ? chainId : DEFAULT_CHAIN_ID;
  const chainDeployments = deployments[activeChainId];

  if (!chainDeployments) {
    console.error(`[useDeployments] No deployments found for chain ${chainId} or default ${DEFAULT_CHAIN_ID}. Check deployments.json.`);
    // Return an empty object cast as ChainDeployments to prevent immediate crash, 
    // though downstream components might still fail if they expect specific keys.
    return {} as ChainDeployments;
  }
  
  return chainDeployments;
}

// Helper to get deployments for a specific chain ID (useful outside of hooks)
export function getDeployments(chainId: number) {
  return deployments[chainId] || deployments[DEFAULT_CHAIN_ID];
}
