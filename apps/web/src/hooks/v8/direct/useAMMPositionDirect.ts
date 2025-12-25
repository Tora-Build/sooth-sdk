import { useAccount, useChainId } from 'wagmi';
import { useV8DirectRead, readContractSafe } from './useV8DirectRead';
import { V8_ABIS } from '../../../config/abis';
import { useDeployments } from '../../useDeployments';

/**
 * Hook to fetch user's AMM position (internal shares) for a specific market.
 * V8 internal positions are stored in the AMMEngine.
 */
export function useAMMPositionDirect(marketAddress?: `0x${string}`) {
  const { address: userAddress } = useAccount();
  const chainId = useChainId();
  const deployments = useDeployments();
  const ammEngineAddress = deployments?.contracts?.AMMEngine as `0x${string}`;

  return useV8DirectRead({
    queryKey: ['v8', 'ammPosition', chainId, ammEngineAddress, marketAddress, userAddress],
    enabled: !!marketAddress && !!chainId && !!ammEngineAddress && !!userAddress,
    chainId,
    read: async (client) => {
      const result = await readContractSafe<readonly [bigint, bigint]>(client, {
        address: ammEngineAddress!,
        abi: V8_ABIS.AMMEngine,
        functionName: 'getPosition',
        args: [marketAddress, userAddress],
      });
      
      // Handle potential null/undefined from readContractSafe
      const [qYes, qNo] = result || [0n, 0n];
      return { qYes, qNo };
    },
  });
}

