import React from 'react';
import { useChainId, useWatchContractEvent } from 'wagmi';
import { formatUnits } from 'viem';
import { SOOTH_MARKET_ABI, SOOTH_VAULT_ABI } from '../../config/abis';
import marketsConfig from '../../config/markets.json';
import { useDeployments } from '../../hooks/useDeployments';
import { useActivityStore } from '../../store/useActivityStore';
import { useMarketStore } from '../../store/useMarketStore';

export const ActivityListener: React.FC = () => {
  const { addActivity } = useActivityStore();
  const { mode } = useMarketStore();
  const deployments = useDeployments();
  const chainId = useChainId();

  // Only listen to markets on the current chain
  const realMarkets = marketsConfig.markets.filter(m => m.mode === 'real' && m.chainId === chainId);
  // LP vault - use SoothGovernorVault in v2, fallback to SoothVault for v1
  const vaultAddress = (deployments.SoothGovernorVault || deployments.SoothVault) as `0x${string}`;

  // Watch Vault Deposits
  useWatchContractEvent({
    address: vaultAddress,
    abi: SOOTH_VAULT_ABI,
    eventName: 'Deposit',
    onLogs(logs) {
      logs.forEach(log => {
        const assets = log.args.assets;
        addActivity({
          type: 'liquidity',
          market: 'USDC Vault',
          description: `Deposited ${formatUnits(assets || 0n, 18)} USDC`,
          hash: log.transactionHash,
          mode: 'real',
          timestamp: Date.now(),
          chainId,
        });
      });
    },
  });

  // Watch Vault Withdraws
  useWatchContractEvent({
    address: vaultAddress,
    abi: SOOTH_VAULT_ABI,
    eventName: 'Withdraw',
    onLogs(logs) {
      logs.forEach(log => {
        const assets = log.args.assets;
        addActivity({
          type: 'liquidity',
          market: 'USDC Vault',
          description: `Withdrew ${formatUnits(assets || 0n, 18)} USDC`,
          hash: log.transactionHash,
          mode: 'real',
          timestamp: Date.now(),
          chainId,
        });
      });
    },
  });

  return (
    <>
      {realMarkets.map(market => (
        <MarketWatcher key={market.id} market={market} />
      ))}
    </>
  );
};

const MarketWatcher: React.FC<{ market: any }> = ({ market }) => {
  const { addActivity } = useActivityStore();
  const chainId = useChainId();

  useWatchContractEvent({
    address: market.contractAddress as `0x${string}`,
    abi: SOOTH_MARKET_ABI,
    eventName: 'Trade',
    onLogs(logs) {
      logs.forEach(log => {
        const { outcomeIndex, deltaShares } = log.args;
        const outcome = outcomeIndex === 0 ? 'YES' : 'NO';
        const shares = formatUnits(deltaShares || 0n, 18);
        const isBuy = (deltaShares || 0n) > 0n;
        
        addActivity({
          type: 'trade',
          market: market.name,
          description: `${isBuy ? 'Bought' : 'Sold'} ${parseFloat(shares).toFixed(2)} ${outcome} shares`,
          hash: log.transactionHash,
          mode: 'real',
          timestamp: Date.now(),
          chainId,
        });
      });
    },
  });

  return null;
};
