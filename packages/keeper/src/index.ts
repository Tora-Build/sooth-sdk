import 'dotenv/config';
import { createPublicClient, createWalletClient, http, formatEther, formatUnits, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getNetwork, LAUNCHPAD_ABI, COLLATERALIZER_ABI, POOL_MANAGER_ABI, VAULT_ABI, ERC20_ABI, WAD } from './config.js';
import { scanMarket } from './monitor.js';
import { findArbitrageOpportunities, filterProfitableOpportunities } from './analyzer.js';
import { executeArbitrage } from './executor.js';
import { runMaintenance } from './maintenance.js';
import { keccak256, encodeAbiParameters, parseAbiParameters } from 'viem';
import { Dashboard } from './dashboard.js';
import type { KeeperStats } from './types.js';

const POLL_INTERVAL_MS = 5000;
const BALANCE_REFRESH_INTERVAL_MS = 10000;
const MAINTENANCE_INTERVAL_MS = 60000;
const MIN_PROFIT_WAD = WAD / 10n;
const DRY_RUN = process.env.DRY_RUN === 'true';

function computeMarketKey(market: Address, yesToken: Address, noToken: Address): `0x${string}` {
  return keccak256(encodeAbiParameters(
    parseAbiParameters('address, address, address'),
    [market, yesToken, noToken]
  ));
}

async function main() {
  const chainName = process.env.CHAIN || 'baseSepolia';
  const privateKey = process.env.PRIVATE_KEY;
  
  if (!privateKey) {
    console.error('PRIVATE_KEY environment variable required');
    process.exit(1);
  }

  const config = getNetwork(chainName);
  const account = privateKeyToAccount(privateKey as `0x${string}`);

  const publicClient = createPublicClient({
    chain: config.chain,
    transport: http(config.rpcUrl || config.chain.rpcUrls.default.http[0]),
  });

  const walletClient = createWalletClient({
    account,
    chain: config.chain,
    transport: http(config.rpcUrl || config.chain.rpcUrls.default.http[0]),
  });

  const dashboard = new Dashboard();
  dashboard.updateChainInfo(
    config.chain.name,
    config.chain.id,
    account.address,
    DRY_RUN ? 'DRY RUN' : 'LIVE'
  );

  const stats: KeeperStats = {
    totalOpportunitiesFound: 0,
    totalArbitragesExecuted: 0,
    totalProfitWad: 0n,
    lastScanTime: new Date(),
  };

  let activeMarketData: { market: Address; marketKey: `0x${string}`; yesToken: Address; noToken: Address }[] = [];

  async function refreshBalances() {
    try {
      const [ethBalance, usdcBalance, vaultUsdc] = await Promise.all([
        publicClient.getBalance({ address: account.address }),
        publicClient.readContract({
          address: config.contracts.MockUSDC,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [account.address],
        }) as Promise<bigint>,
        publicClient.readContract({
          address: config.contracts.TickBookVault,
          abi: VAULT_ABI,
          functionName: 'availableUsdcWad',
          args: [account.address],
        }) as Promise<bigint>,
      ]);

      let vaultYes = '0.00';
      let vaultNo = '0.00';

      if (activeMarketData.length > 0) {
        const { market } = activeMarketData[0];
        const [yes, no] = await publicClient.readContract({
          address: config.contracts.TickBookVault,
          abi: VAULT_ABI,
          functionName: 'getInternalOutcomes',
          args: [market, account.address],
        }) as [bigint, bigint];
        vaultYes = (Number(yes) / 1e18).toFixed(2);
        vaultNo = (Number(no) / 1e18).toFixed(2);
      }

      dashboard.updateBalances(
        formatEther(ethBalance).slice(0, 8),
        formatUnits(usdcBalance, 6),
        (Number(vaultUsdc) / 1e18).toFixed(2),
        vaultYes,
        vaultNo
      );
    } catch (err) {
      dashboard.logError(`Balance refresh failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  }

  dashboard.logInfo('Initializing keeper...');

  const markets = await publicClient.readContract({
    address: config.contracts.LaunchpadEngine,
    abi: LAUNCHPAD_ABI,
    functionName: 'getMarkets',
  }) as Address[];

  dashboard.logInfo(`Found ${markets.length} markets`);

  if (markets.length === 0) {
    dashboard.logError('No markets to monitor. Exiting.');
    setTimeout(() => {
      dashboard.destroy();
      process.exit(0);
    }, 3000);
    return;
  }

  const marketConfigs = await Promise.all(
    markets.map(async (market) => {
      try {
        const [, , , , isGraduated] = await publicClient.readContract({
          address: config.contracts.LaunchpadEngine,
          abi: LAUNCHPAD_ABI,
          functionName: 'getMarketState',
          args: [market],
        }) as [Address, bigint, bigint, bigint, boolean, bigint];
        
        if (!isGraduated) {
          dashboard.logInfo(`Market ${market.slice(0, 10)}... not graduated`);
          return null;
        }

        const [yesToken, noToken] = await publicClient.readContract({
          address: config.contracts.Collateralizer,
          abi: COLLATERALIZER_ABI,
          functionName: 'getOutcomeTokens',
          args: [market],
        }) as [Address, Address];

        const marketKey = computeMarketKey(market, yesToken, noToken);

        const [, , , isActive] = await publicClient.readContract({
          address: config.contracts.TickBookPoolManager,
          abi: POOL_MANAGER_ABI,
          functionName: 'getMarketInfo',
          args: [marketKey],
        }) as [Address, Address, Address, boolean];

        if (!isActive) {
          dashboard.logInfo(`Market ${market.slice(0, 10)}... not registered`);
          return null;
        }

        dashboard.logSuccess(`Market ${market.slice(0, 10)}... active`);
        return { market, marketKey, yesToken, noToken };
      } catch (err) {
        dashboard.logError(`Market check failed: ${err instanceof Error ? err.message : 'Unknown'}`);
        return null;
      }
    })
  );

  activeMarketData = marketConfigs.filter((m): m is NonNullable<typeof m> => m !== null);
  dashboard.updateMarkets(markets.length, activeMarketData.length);

  if (activeMarketData.length === 0) {
    dashboard.logError('No active TickBook markets. Exiting.');
    setTimeout(() => {
      dashboard.destroy();
      process.exit(0);
    }, 3000);
    return;
  }

  await refreshBalances();
  setInterval(refreshBalances, BALANCE_REFRESH_INTERVAL_MS);

  async function runMaintenanceCycle() {
    for (const { market, marketKey } of activeMarketData) {
      try {
        dashboard.logInfo('Running maintenance...');
        const maintenanceResult = await runMaintenance(
          publicClient,
          walletClient,
          config,
          account,
          marketKey,
          market,
          {
            onLog: (msg) => dashboard.logInfo(msg),
            onError: (msg) => dashboard.logError(msg),
            onSuccess: (msg) => dashboard.logSuccess(msg),
          }
        );

        const totalActions = maintenanceResult.fillsClaimed + 
          maintenanceResult.ordersCancelled + 
          maintenanceResult.spotSellsCancelled +
          maintenanceResult.spotSellProceedsClaimed;

        if (totalActions > 0) {
          dashboard.logSuccess(`Maintenance done: ${totalActions} actions`);
          await refreshBalances();
        }
      } catch (err) {
        dashboard.logError(`Maintenance error: ${err instanceof Error ? err.message.slice(0, 50) : 'Unknown'}`);
      }
    }
  }

  dashboard.logInfo('Running startup maintenance...');
  await runMaintenanceCycle();

  setInterval(runMaintenanceCycle, MAINTENANCE_INTERVAL_MS);

  async function runScan() {
    stats.lastScanTime = new Date();
    
    for (const { market, marketKey } of activeMarketData) {
      try {
        const result = await scanMarket(publicClient, config, marketKey);
        if (!result) continue;

        const { orders, spotSells } = result;
        
        if (orders.length === 0 && spotSells.length === 0) continue;

        const opportunities = findArbitrageOpportunities(orders, spotSells, account.address);
        const profitable = filterProfitableOpportunities(opportunities, MIN_PROFIT_WAD);

        dashboard.updateOpportunities(profitable);

        if (profitable.length > 0) {
          const opp = profitable[0];
          stats.totalOpportunitiesFound++;
          
          const side = opp.buyOrder.outcome === 1 ? 'YES' : 'NO';
          const spread = (opp.spread / 10).toFixed(1);
          const shares = (Number(opp.maxShares) / 1e18).toFixed(1);
          
          if (DRY_RUN) {
            dashboard.logInfo(`[DRY] ${side} ${spread}% ${shares} shares`);
            return;
          }

          dashboard.logInfo(`${side} ${spread}% spread, ${shares} shares...`);

          const execResult = await executeArbitrage(
            publicClient,
            walletClient,
            config,
            market,
            marketKey,
            opp,
            account
          );

          if (execResult.success) {
            const actualProfit = Number(execResult.profitWad || 0n) / 1e18;
            stats.totalArbitragesExecuted++;
            stats.totalProfitWad += execResult.profitWad || 0n;
            dashboard.recordTrade(true, actualProfit);
            dashboard.logSuccess(`+${actualProfit.toFixed(2)} USDC | ${execResult.txHash?.slice(0, 10)}...`);
            await refreshBalances();
          } else {
            dashboard.recordTrade(false, 0);
            const errMsg = (execResult.error || 'Unknown').slice(0, 60);
            dashboard.logError(errMsg);
          }
          return;
        }
      } catch (err) {
        dashboard.logError(`Scan error: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    }
  }

  dashboard.logSuccess('Keeper initialized. Starting scan loop...');
  
  await runScan();
  setInterval(runScan, POLL_INTERVAL_MS);

  process.on('SIGINT', () => {
    dashboard.destroy();
    console.log('\n\nKeeper Stats');
    console.log('─────────────────────────────────────');
    console.log(`Opportunities Found: ${stats.totalOpportunitiesFound}`);
    console.log(`Arbitrages Executed: ${stats.totalArbitragesExecuted}`);
    console.log(`Total Profit: ${Number(stats.totalProfitWad) / 1e18} USDC`);
    console.log('─────────────────────────────────────\n');
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
