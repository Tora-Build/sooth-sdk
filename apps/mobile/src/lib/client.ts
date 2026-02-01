import { createPublicClient, createWalletClient, custom, http } from 'viem';
import { baseSepolia } from 'viem/chains';

const RPC_URL = 'https://sepolia.base.org';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _publicClient: any = null;

/**
 * Returns a singleton viem PublicClient for Base Sepolia.
 */
export function getPublicClient() {
  if (!_publicClient) {
    _publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(RPC_URL),
    });
  }
  return _publicClient as ReturnType<typeof createPublicClient>;
}

/**
 * Creates a viem WalletClient from a WalletConnect/AppKit provider.
 * Usage: const client = getWalletClient(provider, address);
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getWalletClient(provider: any, address: `0x${string}`) {
  return createWalletClient({
    account: address,
    chain: baseSepolia,
    transport: custom(provider),
  });
}
