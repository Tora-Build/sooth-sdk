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
 * Creates a viem WalletClient from a Privy embedded wallet.
 * Usage: const wallet = wallets[0]; const client = await getWalletClient(wallet);
 */
export async function getWalletClient(privyWallet: {
  address: string;
  getProvider: () => Promise<{ request: (...args: unknown[]) => Promise<unknown> }>;
}) {
  const provider = await privyWallet.getProvider();
  return createWalletClient({
    account: privyWallet.address as `0x${string}`,
    chain: baseSepolia,
    transport: custom(provider),
  });
}
