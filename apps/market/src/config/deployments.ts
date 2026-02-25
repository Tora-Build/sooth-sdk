import {
  getAllNodes,
  getNodeByChainId,
  getNodeBySoothBook,
  getChain,
} from '@sooth/registry';
import type { SoothNode } from '@sooth/registry';

// Re-export SoothNode as SoothInstance for backward compatibility
export interface SoothInstance {
  id: string;
  chainId: number;
  chainName: string;
  soothBook: string;
  usdc: string;
  collateralizer: string;
  protocolConfig: string;
  ammEngine: string;
  launchpadEngine: string;
  explorer: string;
}

function toInstance(node: SoothNode): SoothInstance {
  const chain = getChain(node.chainId);
  return {
    id: node.id,
    chainId: node.chainId,
    chainName: chain?.name ?? `Chain ${node.chainId}`,
    soothBook: node.contracts.soothBook,
    usdc: node.contracts.usdc,
    collateralizer: node.contracts.collateralizer,
    protocolConfig: node.contracts.protocolConfig,
    ammEngine: node.contracts.ammEngine,
    launchpadEngine: node.contracts.launchpadEngine,
    explorer: chain?.explorer.url ?? 'https://sepolia.basescan.org',
  };
}

export const INSTANCES: SoothInstance[] = getAllNodes().map(toInstance);

export function getInstanceByChainId(chainId: number): SoothInstance | undefined {
  const node = getNodeByChainId(chainId);
  return node ? toInstance(node) : undefined;
}

export function getInstanceBySoothBook(address: string): SoothInstance | undefined {
  const node = getNodeBySoothBook(address);
  return node ? toInstance(node) : undefined;
}

export function getAllInstances(): SoothInstance[] {
  return INSTANCES;
}

export function getDeployment(chainId: number) {
  const node = getNodeByChainId(chainId);
  if (!node) return undefined;

  return {
    MockUSDC: node.contracts.usdc,
    ProtocolConfig: node.contracts.protocolConfig,
    Collateralizer: node.contracts.collateralizer,
    AMMEngine: node.contracts.ammEngine,
    SoothBook: node.contracts.soothBook,
    LaunchpadEngine: node.contracts.launchpadEngine,
  };
}

export type DeploymentKey =
  | 'MockUSDC'
  | 'ProtocolConfig'
  | 'Collateralizer'
  | 'AMMEngine'
  | 'SoothBook'
  | 'LaunchpadEngine';
