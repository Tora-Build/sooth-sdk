import { useReadContracts } from 'wagmi';
import { formatUnits } from 'viem';
import { GOVERNOR_VAULT_V4_ABI } from '../config/abis';
import { useDeployments } from './useDeployments';
import { useMarketStore } from '../store/useMarketStore';
import { useChainStore } from '../store/useChainStore';

export function useProtocolStats() {
  const { markets, mode } = useMarketStore();
  const { selectedChainId } = useChainStore();
  const deployments = useDeployments();
  // LP vault - use SoothGovernorVault
  const vaultAddress = deployments.SoothGovernorVault as `0x${string}`;

  // We only fetch on-chain data if in Real mode
  const { data: vaultData, isLoading } = useReadContracts({
    contracts: [
      { address: vaultAddress, abi: GOVERNOR_VAULT_V4_ABI, functionName: 'totalAssets' },
    ],
    query: {
      enabled: mode === 'real',
      refetchInterval: 30000, // Increased to prevent RPC rate limiting
    }
  });

  const [totalAssets] = vaultData?.map(r => r.result) || [];

  // Calculate stats
  const totalTVL = mode === 'real'
    ? (totalAssets ? parseFloat(formatUnits(totalAssets as bigint, 18)) : 0)
    : 3100000; // Mock for demo

  // Estimate liquid as 85% of total (since we don't have direct access to locked exposure)
  const liquid = mode === 'real'
    ? totalTVL * 0.85
    : 2660000; // Mock for demo

  const locked = totalTVL - liquid;

  // Counts - filter by current mode AND selected chain
  const filteredMarkets = markets.filter(m => {
    if (mode === 'demo') {
      return m.mode === 'demo';
    }
    // For real mode, filter by both mode and chainId
    return m.mode === 'real' && (m.chainId === undefined || m.chainId === selectedChainId);
  });
  const marketCount = filteredMarkets.length;
  // There's only 1 vault per chain in real mode, or count unique adjudicator types in demo
  const poolCount = mode === 'real' ? 1 : new Set(filteredMarkets.map(m => m.adjudicatorKind)).size;

  return {
    totalTVL,
    lockedLiquidity: locked,
    marketCount,
    poolCount,
    isLoading: mode === 'real' && isLoading,
  };
}
