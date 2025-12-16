import { useReadContracts } from 'wagmi';
import { formatUnits } from 'viem';
import { GOVERNOR_VAULT_V4_ABI } from '../config/abis';
import { useDeployments } from './useDeployments';
import { useMarketStore } from '../store/useMarketStore';
import { useChainStore } from '../store/useChainStore';

export function useProtocolStats() {
  const { markets, mode } = useMarketStore();
  const { selectedChainId } = useChainStore();
  const { config } = useDeployments();
  const deployments = config.contracts;
  // LP vault - use SoothLiquidityVault (renamed from SoothGovernorVault)
  const vaultAddress = deployments.SoothLiquidityVault as `0x${string}`;

  // Fetch totalAssets and totalLockedExposure from vault
  const { data: vaultData, isLoading } = useReadContracts({
    contracts: [
      { address: vaultAddress, abi: GOVERNOR_VAULT_V4_ABI, functionName: 'totalAssets' },
      { address: vaultAddress, abi: GOVERNOR_VAULT_V4_ABI, functionName: 'totalLockedExposure' },
    ],
    query: {
      enabled: mode === 'real',
      refetchInterval: 30000,
    }
  });

  const [totalAssets, totalLockedExposure] = vaultData?.map(r => r.result) || [];

  // Calculate stats from actual contract values
  const totalTVL = mode === 'real'
    ? (totalAssets ? parseFloat(formatUnits(totalAssets as bigint, 18)) : 0)
    : 3100000; // Mock for demo

  const locked = mode === 'real'
    ? (totalLockedExposure ? parseFloat(formatUnits(totalLockedExposure as bigint, 18)) : 0)
    : 2140000; // Mock for demo (~69% of TVL)

  // Counts - filter by current mode AND selected chain
  const filteredMarkets = markets.filter(m => {
    if (mode === 'demo') {
      return m.mode === 'demo';
    }
    // For real mode, filter by both mode and chainId
    return m.mode === 'real' && (m.chainId === undefined || m.chainId === selectedChainId);
  });
  const marketCount = filteredMarkets.length;
  // There's only 1 vault per chain in real mode
  const poolCount = mode === 'real' ? 1 : new Set(filteredMarkets.map(m => m.adjudicatorKind)).size;

  return {
    totalTVL,
    lockedLiquidity: locked,
    marketCount,
    poolCount,
    isLoading: mode === 'real' && isLoading,
  };
}
