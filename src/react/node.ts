import type { Address, Hash } from 'viem';
import {
  factoryAddress,
  factoryChainId,
  factoryHash,
  type FactoryIdentity,
} from '../factory/schema.js';
import type { SoothVenue } from './embed.js';

/** Host-selected identity. It never supplies RPC URLs, contracts or spenders. */
export interface SoothNodeReference {
  chainId: number;
  factory: Address;
  nodeId: Hash;
  releaseId: Hash;
}
export interface SoothNodeFeatures {
  create?: boolean;
  clob?: boolean;
}
export type SoothNodePresentation = 'panel' | 'drawer' | 'modal';

export function parseSoothNodeReference(value: string | SoothNodeReference): SoothNodeReference {
  const parts = typeof value === 'string' ? value.split(':') : null;
  if (
    parts &&
    (parts.length !== 7 || parts[0] !== 'sooth' || parts[1] !== 'node' || parts[2] !== 'v1')
  )
    throw new Error('A full Sooth v1 node reference is required');
  const input = parts
    ? { chainId: Number(parts[3]), factory: parts[4], nodeId: parts[5], releaseId: parts[6] }
    : (value as SoothNodeReference);
  if (!input || typeof input !== 'object')
    throw new Error('A full Sooth v1 node reference is required');
  return {
    chainId: factoryChainId(input.chainId),
    factory: factoryAddress(input.factory),
    nodeId: factoryHash(input.nodeId),
    releaseId: factoryHash(input.releaseId),
  };
}
export function formatSoothNodeReference(value: SoothNodeReference): string {
  const node = parseSoothNodeReference(value);
  return `sooth:node:v1:${node.chainId}:${node.factory}:${node.nodeId}:${node.releaseId}`;
}
/** A catalog market carries node identity; its release is authenticated by resolveNode. */
export function isSoothNodeScope(node: SoothNodeReference, identity: FactoryIdentity): boolean {
  return (
    identity.chainId === node.chainId &&
    identity.factory.toLowerCase() === node.factory.toLowerCase() &&
    identity.nodeId.toLowerCase() === node.nodeId.toLowerCase()
  );
}
export function soothNodeVenue(
  features: SoothNodeFeatures | undefined,
  venue?: SoothVenue,
): SoothVenue {
  return features?.clob === true && venue === 'book' ? 'book' : 'amm';
}
