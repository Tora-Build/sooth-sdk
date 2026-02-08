import { createPublicClient, http } from 'viem';
import { monadTestnet, MONAD_TESTNET_CHAIN_ID } from './config';

const clients = new Map<number, ReturnType<typeof createPublicClient>>();

export function getPublicClient(chainId: number = MONAD_TESTNET_CHAIN_ID) {
  if (clients.has(chainId)) {
    return clients.get(chainId)!;
  }

  const client = createPublicClient({
    chain: monadTestnet,
    transport: http(),
  });

  clients.set(chainId, client);
  return client;
}
