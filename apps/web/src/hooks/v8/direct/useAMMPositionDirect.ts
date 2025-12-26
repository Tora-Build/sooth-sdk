import { useAccount } from 'wagmi';
import { useV8DirectRead, readContractSafe } from './useV8DirectRead';
import { V8_ABIS } from '../../../config/abis';
import { useDeployments } from '../../useDeployments';
import { useChainStore } from '../../../store/useChainStore';

/**
 * Hook to fetch user's AMM position (internal shares) for a specific market.
 * V8 internal positions are stored in the AMMEngine.
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
      const shares = await readContractSafe<bigint>(client, {
        address: ammEngineAddress!,
        abi: V8_ABIS.AMMEngine,
        functionName: 'getPosition',
        args: [marketAddress, userAddress],
      });
      
      const s = shares ?? 0n;
      return {
        shares: s,
        yesShares: s > 0n ? s : 0n,
        noShares: s < 0n ? -s : 0n,
      };
    },
  });
}

