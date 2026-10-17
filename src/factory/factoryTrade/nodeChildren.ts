/**
 * A Factory node's contracts, derived from its deployer with the CREATE rule.
 *
 * Matches `packages/indexer/factory/discovery.ts` and NodeTypes.predictChildren.
 * This browser-safe helper does not import the server indexer.
 */
import { getContractAddress, type Address } from 'viem';

export interface NodeChildren {
  roles: Address;
  book: Address;
  amm: Address;
  ammVault: Address;
  bookVault: Address;
  marketFactory: Address;
  positionManager: Address;
}

/** Fixed CREATE nonces of the node deployer, then the AMM's LP position manager. */
export function deriveNodeChildren(deployer: Address): NodeChildren {
  const child = (parent: Address, nonce: bigint): Address =>
    getContractAddress({
      from: parent,
      nonce,
      opcode: 'CREATE',
    }).toLowerCase() as Address;
  const amm = child(deployer, 3n);
  return {
    roles: child(deployer, 1n),
    book: child(deployer, 2n),
    amm,
    ammVault: child(deployer, 4n),
    bookVault: child(deployer, 5n),
    marketFactory: child(deployer, 6n),
    positionManager: child(amm, 1n),
  };
}
