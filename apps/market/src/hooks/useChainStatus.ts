import { usePublicClient, useBlockNumber } from 'wagmi';

export const useChainStatus = () => {
  const publicClient = usePublicClient();
  const { data: blockNumber } = useBlockNumber({
    watch: true,
    query: {
      refetchInterval: 4_000,
    }
  });
  
  return {
    rpcBlock: blockNumber ? Number(blockNumber) : null,
    rpcConnected: !!publicClient,
  };
};
