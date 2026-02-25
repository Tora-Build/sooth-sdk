import { defineChain, type Chain } from 'viem';
import { getChain, getSupportedChainIds } from './index';

export type RpcOverrides = Record<number, string[]>;

/** Convert a registry chain to a viem Chain object */
export function toViemChain(chainId: number, rpcOverride?: string[]): Chain {
  const meta = getChain(chainId);
  if (!meta) throw new Error(`Unknown chainId: ${chainId}`);

  const rpcUrls = rpcOverride ?? meta.rpcUrls;

  return defineChain({
    id: chainId,
    name: meta.name,
    nativeCurrency: meta.nativeCurrency,
    rpcUrls: {
      default: { http: rpcUrls },
    },
    blockExplorers: {
      default: { name: meta.explorer.name, url: meta.explorer.url },
    },
    ...(meta.multicall3 && {
      contracts: {
        multicall3: { address: meta.multicall3 },
      },
    }),
    testnet: meta.testnet,
  });
}

/** Convert all registry chains to viem Chain objects */
export function getAllViemChains(rpcOverrides?: RpcOverrides): Chain[] {
  return getSupportedChainIds().map((chainId) =>
    toViemChain(chainId, rpcOverrides?.[chainId]),
  );
}
