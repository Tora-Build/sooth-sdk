import {
  getAllNodes,
  getNodeByChainId,
  getRegistryVersion,
  getChain,
} from '@sooth/registry';
import type { SoothNode } from '@sooth/registry';

export interface ChainDeployment {
  chainId: number;
  networkName: string;
  version: string;
  contracts: {
    LaunchpadEngine: string;
    AMMEngine: string;
    SoothBook?: string;
    Collateralizer: string;
    MockUSDC: string;
    ProtocolConfig?: string;
    [key: string]: string | undefined;
  };
}

function toChainDeployment(node: SoothNode): ChainDeployment {
  const chain = getChain(node.chainId);
  return {
    chainId: node.chainId,
    networkName: chain?.name ?? `Chain ${node.chainId}`,
    version: getRegistryVersion(),
    contracts: {
      LaunchpadEngine: node.contracts.launchpadEngine,
      AMMEngine: node.contracts.ammEngine,
      SoothBook: node.contracts.soothBook,
      Collateralizer: node.contracts.collateralizer,
      MockUSDC: node.contracts.usdc,
      ProtocolConfig: node.contracts.protocolConfig,
    },
  };
}

export function getDeployment(chainId: number): ChainDeployment | undefined {
  const node = getNodeByChainId(chainId);
  return node ? toChainDeployment(node) : undefined;
}

export function getSupportedChains(): number[] {
  return getAllNodes().map((n) => n.chainId);
}

export function getVersion(): string {
  return getRegistryVersion();
}
