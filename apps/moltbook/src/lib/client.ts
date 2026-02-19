import { createPublicClient, http } from 'viem';
import { monadMainnet, MONAD_MAINNET_CHAIN_ID } from './config';

const clients = new Map<number, ReturnType<typeof createPublicClient>>();

export function getPublicClient(chainId: number = MONAD_MAINNET_CHAIN_ID) {
  if (clients.has(chainId)) {
    return clients.get(chainId)!;
  }

  const client = createPublicClient({
    chain: monadMainnet,
    transport: http(),
  });

  clients.set(chainId, client);
  return client;
}
