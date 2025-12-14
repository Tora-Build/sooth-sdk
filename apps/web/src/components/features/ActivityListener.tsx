import React from 'react';
import { useChainId, useWatchContractEvent } from 'wagmi';
import { formatUnits } from 'viem';
import { GOVERNOR_VAULT_V4_ABI, TRADER_VAULT_V4_ABI } from '../../config/abis';
import marketsConfig from '../../config/markets.json';
import { useDeployments } from '../../hooks/useDeployments';
import { useActivityStore } from '../../store/useActivityStore';
import { useMarketStore } from '../../store/useMarketStore';

export const ActivityListener: React.FC = () => {
  const { addActivity } = useActivityStore();
  const { mode, triggerRefresh } = useMarketStore();
  const { config } = useDeployments();
  const deployments = config.contracts;
  const chainId = useChainId();

  // LP vault
  const vaultAddress = deployments.SoothGovernorVault as `0x${string}`;
  // Trader Vault
  const traderVaultAddress = deployments.SoothTraderVault as `0x${string}`;

  // Watch Vault Deposits (Governor Vault)
  useWatchContractEvent({
    address: vaultAddress,
    abi: GOVERNOR_VAULT_V4_ABI,
    eventName: 'Deposit',
    onLogs(logs: any[]) {
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
      triggerRefresh();
    },
    enabled: mode === 'real',
  });

  // Watch Vault Withdraws (Governor Vault)
  useWatchContractEvent({
    address: vaultAddress,
    abi: GOVERNOR_VAULT_V4_ABI,
    eventName: 'Withdraw',
    onLogs(logs: any[]) {
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
      triggerRefresh();
    },
    enabled: mode === 'real',
  });

  // Watch TradeExecuted on TraderVault (Aggregates all markets)
  useWatchContractEvent({
    address: traderVaultAddress,
    abi: TRADER_VAULT_V4_ABI,
    eventName: 'TradeExecuted',
    onLogs(logs: any[]) { // Cast to any[]
      logs.forEach(log => {
        const { market: marketAddress, outcome, deltaShares } = log.args;

        // Find market name from config
        const marketConfig = marketsConfig.markets.find(m =>
          m.contractAddress?.toLowerCase() === marketAddress?.toLowerCase()
        );
        const marketName = marketConfig?.name || 'Unknown Market';

        const outcomeText = outcome === 0 ? 'YES' : 'NO';
        const shares = formatUnits(deltaShares || 0n, 18);
        const isBuy = (deltaShares || 0n) > 0n;

        addActivity({
          type: 'trade',
          market: marketName,
          description: `${isBuy ? 'Bought' : 'Sold'} ${parseFloat(shares).toFixed(2)} ${outcomeText} shares`,
          hash: log.transactionHash,
          mode: 'real',
          timestamp: Date.now(),
          chainId,
        });
      });
      triggerRefresh();
    },
    enabled: mode === 'real',
  });

  return null;
};
