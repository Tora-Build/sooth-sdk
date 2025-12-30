import React, { useMemo } from 'react';
import { useChainId, useWatchContractEvent } from 'wagmi';
import { formatUnits } from 'viem';
import { GOVERNOR_VAULT_V4_ABI, TRADER_VAULT_V4_ABI, LAUNCHPAD_MARKET_ABI } from '../../config/abis';
import { useDeployments } from '../../hooks/useDeployments';
import { useLaunchpadMarkets } from '../../hooks/useLaunchpadMarkets';
import { useActivityStore } from '../../store/useActivityStore';
import { useOrderStore } from '../../store/useOrderStore';
import { useMarketStore } from '../../store/useMarketStore';
import toast from 'react-hot-toast';

/**
 * Component to watch events for a specific Launchpad Market
 */
const LaunchpadMarketWatcher: React.FC<{ market: { address: `0x${string}`, name: string }; chainId: number }> = ({ market, chainId }) => {
  const { addActivity } = useActivityStore();

  // Watch TradeAMM (Direct swaps)
  useWatchContractEvent({
    address: market.address,
    abi: LAUNCHPAD_MARKET_ABI,
    eventName: 'TradeAMM',
    onLogs(logs: any[]) {
      logs.forEach(log => {
        const { user, outcome, deltaShares } = log.args;
        const isBuy = (deltaShares || 0n) > 0n;
        const shares = formatUnits(deltaShares || 0n, 18);
        const outcomeText = outcome === 0 ? 'YES' : 'NO';
        const description = `${isBuy ? 'Bought' : 'Sold'} ${parseFloat(shares).toFixed(2)} ${outcomeText} shares`;

        addActivity({
          type: 'trade',
          market: market.name,
          description,
          hash: log.transactionHash,
          mode: 'real',
          timestamp: Date.now(),
          chainId,
        });
        toast.success(description, { icon: '🔄' });
      });
    },
  });

  // Watch Locked (Pre-graduation locking)
  useWatchContractEvent({
    address: market.address,
    abi: LAUNCHPAD_MARKET_ABI,
    eventName: 'Locked',
    onLogs(logs: any[]) {
      logs.forEach(log => {
        const { amount } = log.args;
        const description = `Proceeds locked (24h): ${formatUnits(amount || 0n, 6)} USDC`;
        addActivity({
          type: 'liquidity',
          market: market.name,
          description,
          hash: log.transactionHash,
          mode: 'real',
          timestamp: Date.now(),
          chainId,
        });
        toast(description, { icon: '🔒' });
      });
    },
  });

  // Watch Claimed (Unlocked proceeds)
  useWatchContractEvent({
    address: market.address,
    abi: LAUNCHPAD_MARKET_ABI,
    eventName: 'Claimed',
    onLogs(logs: any[]) {
      logs.forEach(log => {
        const { amount } = log.args;
        const description = `Unlocked proceeds claimed: ${formatUnits(amount || 0n, 6)} USDC`;
        addActivity({
          type: 'claim',
          market: market.name,
          description,
          hash: log.transactionHash,
          mode: 'real',
          timestamp: Date.now(),
          chainId,
        });
        toast.success(description, { icon: '💰' });
      });
    },
  });

  // Watch LpTokensRedeemed
  useWatchContractEvent({
    address: market.address,
    abi: LAUNCHPAD_MARKET_ABI,
    eventName: 'LpTokensRedeemed',
    onLogs(logs: any[]) {
      logs.forEach(log => {
        const { amount, assets } = log.args;
        const description = `Redeemed ${formatUnits(amount || 0n, 18)} LP for ${formatUnits(assets || 0n, 6)} USDC`;
        addActivity({
          type: 'liquidity',
          market: market.name,
          description,
          hash: log.transactionHash,
          mode: 'real',
          timestamp: Date.now(),
          chainId,
        });
        toast.success(description, { icon: '🏦' });
      });
    },
  });

  // Watch MarketGraduated
  useWatchContractEvent({
    address: market.address,
    abi: LAUNCHPAD_MARKET_ABI,
    eventName: 'MarketGraduated',
    onLogs(logs: any[]) {
      logs.forEach(log => {
        const description = `🎓 Market Graduated to Full AMM!`;
        addActivity({
          type: 'settle',
          market: market.name,
          description,
          hash: log.transactionHash,
          mode: 'real',
          timestamp: Date.now(),
          chainId,
        });
        toast.success(description, { icon: '🏆', duration: 10000 });
      });
    },
  });

  return null;
};

export const ActivityListener: React.FC = () => {
  const { addActivity } = useActivityStore();
  const { mode } = useMarketStore();
  const { config } = useDeployments();
  const deployments = config.contracts;
  const chainId = useChainId();
  const { markets } = useLaunchpadMarkets();

  // 1. Build unique market list from both factory and static config
  const uniqueMarkets = useMemo(() => {
    const list: { address: `0x${string}`, name: string }[] = [];
    const seen = new Set<string>();

    // From deployments.json (Static)
    if (config.marketInfo) {
      Object.values(config.marketInfo).forEach((m: any) => {
        if (m.address && !seen.has(m.address.toLowerCase())) {
          seen.add(m.address.toLowerCase());
          list.push({ address: m.address, name: m.name });
        }
      });
    }

    // From LaunchpadFactory (Dynamic)
    if (markets) {
      markets.forEach(m => {
        if (m.address && !seen.has(m.address.toLowerCase())) {
          seen.add(m.address.toLowerCase());
          list.push({ address: m.address, name: m.name });
        }
      });
    }

    return list;
  }, [config.marketInfo, markets]);

  // LP vault
  const vaultAddress = deployments.SoothLiquidityVault as `0x${string}`;
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
        const description = `Deposited ${formatUnits(assets || 0n, 18)} USDC`;
        addActivity({
          type: 'liquidity',
          market: 'USDC Vault',
          description,
          hash: log.transactionHash,
          mode: 'real',
          timestamp: Date.now(),
          chainId,
        });
        toast.success(description, { icon: '📥' });
      });
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
        const description = `Withdrew ${formatUnits(assets || 0n, 18)} USDC`;
        addActivity({
          type: 'liquidity',
          market: 'USDC Vault',
          description,
          hash: log.transactionHash,
          mode: 'real',
          timestamp: Date.now(),
          chainId,
        });
        toast.success(description, { icon: '📤' });
      });
    },
    enabled: mode === 'real',
  });

  // Watch TradeExecuted on TraderVault (Aggregates all markets)
  useWatchContractEvent({
    address: traderVaultAddress,
    abi: TRADER_VAULT_V4_ABI,
    eventName: 'TradeExecuted',
    onLogs(logs: any[]) {
      logs.forEach(log => {
        const { market: marketAddress, outcome, deltaShares } = log.args;

        const marketMeta = uniqueMarkets.find(m =>
          m.address.toLowerCase() === marketAddress?.toLowerCase()
        );
        const marketName = marketMeta?.name || 'Unknown Market';

        const outcomeText = outcome === 0 ? 'YES' : 'NO';
        const shares = formatUnits(deltaShares || 0n, 18);
        const isBuy = (deltaShares || 0n) > 0n;
        const description = `${isBuy ? 'Bought' : 'Sold'} ${parseFloat(shares).toFixed(2)} ${outcomeText} shares`;

        addActivity({
          type: 'trade',
          market: marketName,
          description,
          hash: log.transactionHash,
          mode: 'real',
          timestamp: Date.now(),
          chainId,
        });
        toast.success(description, { icon: '🔄' });
      });
    },
    enabled: mode === 'real' && !!traderVaultAddress,
  });

  // Watch OrderPlaced on TraderVault
  useWatchContractEvent({
    address: traderVaultAddress,
    abi: TRADER_VAULT_V4_ABI,
    eventName: 'OrderPlaced',
    onLogs(logs: any[]) {
      logs.forEach(log => {
        const { market: marketAddress, orderId, outcome, price, amount } = log.args;
        
        const marketMeta = uniqueMarkets.find(m =>
          m.address.toLowerCase() === marketAddress?.toLowerCase()
        );
        const marketName = marketMeta?.name || 'Unknown Market';

        useOrderStore.getState().addOrder({
          id: orderId.toString(),
          marketAddress: marketAddress as `0x${string}`,
          marketName,
          outcome: outcome as 0 | 1,
          price: Number(formatUnits(price || 0n, 18)),
          amount: Number(formatUnits(amount || 0n, 18)),
          timestamp: Date.now(),
          isBuy: true, // Simplified for alpha
          hash: log.transactionHash
        });

        const description = `Limit Order Placed: ${parseFloat(formatUnits(amount || 0n, 18)).toFixed(2)} shares @ $${parseFloat(formatUnits(price || 0n, 18)).toFixed(2)}`;
        addActivity({
          type: 'trade',
          market: marketName,
          description,
          hash: log.transactionHash,
          mode: 'real',
          timestamp: Date.now(),
          chainId,
        });
        toast.success(description, { icon: '📝' });
      });
    },
    enabled: mode === 'real' && !!traderVaultAddress,
  });

  // Watch OrderCancelled on TraderVault
  useWatchContractEvent({
    address: traderVaultAddress,
    abi: TRADER_VAULT_V4_ABI,
    eventName: 'OrderCancelled',
    onLogs(logs: any[]) {
      logs.forEach(log => {
        const { orderId, market: marketAddress } = log.args;
        useOrderStore.getState().removeOrder(orderId.toString());
        
        const marketMeta = uniqueMarkets.find(m =>
          m.address.toLowerCase() === marketAddress?.toLowerCase()
        );
        const marketName = marketMeta?.name || 'Unknown Market';

        const description = `Order #${orderId.toString()} Cancelled`;
        addActivity({
          type: 'trade',
          market: marketName,
          description,
          hash: log.transactionHash,
          mode: 'real',
          timestamp: Date.now(),
          chainId,
        });
        toast(description, { icon: '🚫' });
      });
    },
    enabled: mode === 'real' && !!traderVaultAddress,
  });

  // Watch Locked events on TraderVault
  useWatchContractEvent({
    address: traderVaultAddress,
    abi: TRADER_VAULT_V4_ABI,
    eventName: 'Locked',
    onLogs(logs: any[]) {
      logs.forEach(log => {
        const { amount } = log.args;
        const description = `Proceeds locked: ${formatUnits(amount || 0n, 6)} USDC`;
        addActivity({
          type: 'liquidity',
          market: 'Trading Vault',
          description,
          hash: log.transactionHash,
          mode: 'real',
          timestamp: Date.now(),
          chainId,
        });
        toast(description, { icon: '🔒' });
      });
    },
    enabled: mode === 'real' && !!traderVaultAddress,
  });

  // Watch Claimed events on TraderVault
  useWatchContractEvent({
    address: traderVaultAddress,
    abi: TRADER_VAULT_V4_ABI,
    eventName: 'Claimed',
    onLogs(logs: any[]) {
      logs.forEach(log => {
        const { amount } = log.args;
        const description = `Unlocked funds claimed: ${formatUnits(amount || 0n, 6)} USDC`;
        addActivity({
          type: 'claim',
          market: 'Trading Vault',
          description,
          hash: log.transactionHash,
          mode: 'real',
          timestamp: Date.now(),
          chainId,
        });
        toast.success(description, { icon: '💰' });
      });
    },
    enabled: mode === 'real' && !!traderVaultAddress,
  });

  return (
    <>
      {mode === 'real' && uniqueMarkets.map(market => (
        <LaunchpadMarketWatcher key={market.address} market={market} chainId={chainId} />
      ))}
    </>
  );
};
