import { createPublicClient, http, type Address } from 'viem';
import type { SoothContracts } from './types';
import { computeNodeId } from './index';

export interface DiscoveredNode {
  id: string;
  chainId: number;
  contracts: SoothContracts;
}

// Minimal ABI — only the 5 immutable getters we need
const LAUNCHPAD_IMMUTABLES_ABI = [
  { name: 'usdc', type: 'function', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { name: 'ammEngine', type: 'function', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { name: 'collateralizer', type: 'function', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { name: 'soothBook', type: 'function', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { name: 'protocolConfig', type: 'function', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
] as const;

/**
 * Auto-discover all Sooth contract addresses from a single LaunchpadEngine address.
 * Reads 5 public immutable getters via eth_call in parallel.
 * Given: chainId + rpcUrl + launchpadEngine → returns full SoothContracts.
 */
export async function discoverContracts(
  chainId: number,
  rpcUrl: string,
  launchpadEngine: Address,
): Promise<SoothContracts> {
  const client = createPublicClient({ transport: http(rpcUrl) });

  const [usdc, ammEngine, collateralizer, soothBook, protocolConfig] = await Promise.all([
    client.readContract({ address: launchpadEngine, abi: LAUNCHPAD_IMMUTABLES_ABI, functionName: 'usdc' }),
    client.readContract({ address: launchpadEngine, abi: LAUNCHPAD_IMMUTABLES_ABI, functionName: 'ammEngine' }),
    client.readContract({ address: launchpadEngine, abi: LAUNCHPAD_IMMUTABLES_ABI, functionName: 'collateralizer' }),
    client.readContract({ address: launchpadEngine, abi: LAUNCHPAD_IMMUTABLES_ABI, functionName: 'soothBook' }),
    client.readContract({ address: launchpadEngine, abi: LAUNCHPAD_IMMUTABLES_ABI, functionName: 'protocolConfig' }),
  ]);

  return {
    launchpadEngine,
    usdc: usdc as Address,
    ammEngine: ammEngine as Address,
    collateralizer: collateralizer as Address,
    soothBook: soothBook as Address,
    protocolConfig: protocolConfig as Address,
  };
}

/**
 * Discover contracts AND compute the deterministic node ID.
 * Returns everything needed to register a new node.
 */
export async function buildDiscoveredNode(
  chainId: number,
  rpcUrl: string,
  launchpadEngine: Address,
): Promise<DiscoveredNode> {
  const contracts = await discoverContracts(chainId, rpcUrl, launchpadEngine);
  const id = await computeNodeId(chainId, launchpadEngine);
  return { id, chainId, contracts };
}