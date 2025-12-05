import { useReadContracts } from 'wagmi';
import { formatUnits } from 'viem';
import { SOOTH_VAULT_ABI } from '../config/abis';
import { useDeployments } from './useDeployments';
import { useMarketStore } from '../store/useMarketStore';
import { useChainStore } from '../store/useChainStore';

export function useProtocolStats() {
  const { markets, mode } = useMarketStore();
  const { selectedChainId } = useChainStore();
  const deployments = useDeployments();
  // LP vault - use SoothGovernorVault in v2, fallback to SoothVault for v1
  const vaultAddress = (deployments.SoothGovernorVault || deployments.SoothVault) as `0x${string}`;

  // We only fetch on-chain data if in Real mode
  const { data: vaultData, isLoading } = useReadContracts({
    contracts: [
      { address: vaultAddress, abi: SOOTH_VAULT_ABI, functionName: 'totalAssets' },
      { address: vaultAddress, abi: SOOTH_VAULT_ABI, functionName: 'getLiquidBufferBalance' },
    ],
    query: {
      enabled: mode === 'real',
      refetchInterval: 10000,
    }
  });

  const [totalAssets, liquidBuffer] = vaultData?.map(r => r.result) || [];

  // Calculate stats
  const totalTVL = mode === 'real' 
    ? (totalAssets ? parseFloat(formatUnits(totalAssets as bigint, 18)) : 0)
    : 3100000; // Mock for demo

  const liquid = mode === 'real'
    ? (liquidBuffer ? parseFloat(formatUnits(liquidBuffer as bigint, 18)) : 0)
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
