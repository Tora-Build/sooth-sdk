import { useAccount } from 'wagmi';
import { useV8DirectRead, readContractSafe } from './useV8DirectRead';
import { V8_ABIS } from '../../../config/abis';
import { useDeployments } from '../../useDeployments';
import { useChainStore } from '../../../store/useChainStore';

/**
 * Hook to fetch user's AMM position (YES and NO shares) for a specific market.
 * V8.2 uses dual-balance model where users can hold both YES and NO.
 */
export function useAMMPositionDirect(marketAddress?: `0x${string}`) {
  const { address: userAddress } = useAccount();
  const { selectedChainId } = useChainStore();
  const chainId = typeof selectedChainId === 'number' ? selectedChainId : Number(selectedChainId);
  const deployments = useDeployments();
  const ammEngineAddress = deployments?.contracts?.AMMEngine as `0x${string}`;

  return useV8DirectRead({
    queryKey: ['v8', 'ammPosition', chainId, ammEngineAddress, marketAddress, userAddress],
    enabled: !!marketAddress && !!chainId && !!ammEngineAddress && !!userAddress,
    chainId,
    read: async (client) => {
      // V8.2: getPosition returns (uint256 yesShares, uint256 noShares)
      const result = await readContractSafe<readonly [bigint, bigint]>(client, {
        address: ammEngineAddress!,
        abi: V8_ABIS.AMMEngine,
        functionName: 'getPosition',
        args: [marketAddress, userAddress],
      });
      
      const [yesShares, noShares] = result ?? [0n, 0n];
      return {
        yesShares,
        noShares,
        // Legacy: shares is now the sum for backwards compat with some UI
        shares: yesShares + noShares,
      };
    },
  });
}

