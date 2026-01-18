import 'dotenv/config';
import { createPublicClient, createWalletClient, http, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getNetwork, LAUNCHPAD_ABI, WAD } from './config.js';
import { scanMarket } from './monitor.js';
import { findArbitrageOpportunities, formatOpportunity, filterProfitableOpportunities } from './analyzer.js';
import { executeArbitrage, estimateGasCost } from './executor.js';
import { keccak256, encodePacked } from 'viem';
import type { KeeperStats } from './types.js';

const POLL_INTERVAL_MS = 5000;
const MIN_PROFIT_WAD = WAD / 10n;
const DRY_RUN = process.env.DRY_RUN === 'true';

function computeMarketKey(market: Address, yesToken: Address, noToken: Address): `0x${string}` {
  return keccak256(encodePacked(['address', 'address', 'address'], [market, yesToken, noToken]));
}

async function main() {
  const chainName = process.env.CHAIN || 'baseSepolia';
  const privateKey = process.env.PRIVATE_KEY;
  
  if (!privateKey) {
    console.error('PRIVATE_KEY environment variable required');
    process.exit(1);
  }

  const config = getNetwork(chainName);
  console.log(`\n  Sooth Keeper Bot`);
  console.log(`  ─────────────────────────────────────`);
  console.log(`  Chain: ${config.chain.name} (${config.chain.id})`);
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN (no execution)' : 'LIVE'}`);
  console.log(`  Min Profit: ${Number(MIN_PROFIT_WAD) / 1e18} USDC`);
  console.log(`  Poll Interval: ${POLL_INTERVAL_MS}ms`);
  console.log(`  ─────────────────────────────────────\n`);

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  console.log(`  Keeper Address: ${account.address}\n`);

  const publicClient = createPublicClient({
    chain: config.chain,
    transport: http(config.rpcUrl || config.chain.rpcUrls.default.http[0]),
  });

  const walletClient = createWalletClient({
    account,
    chain: config.chain,
    transport: http(config.rpcUrl || config.chain.rpcUrls.default.http[0]),
  });

  const stats: KeeperStats = {
    totalOpportunitiesFound: 0,
    totalArbitragesExecuted: 0,
    totalProfitWad: 0n,
    lastScanTime: new Date(),
  };

  const markets = await publicClient.readContract({
    address: config.contracts.LaunchpadEngine,
    abi: LAUNCHPAD_ABI,
    functionName: 'getMarkets',
  }) as Address[];

  console.log(`  Found ${markets.length} markets\n`);

  if (markets.length === 0) {
    console.log('  No markets to monitor. Exiting.');
    return;
  }

  const marketConfigs = await Promise.all(
    markets.map(async (market) => {
      try {
        const cfg = await publicClient.readContract({
          address: config.contracts.LaunchpadEngine,
          abi: LAUNCHPAD_ABI,
          functionName: 'getMarketConfig',
          args: [market],
        }) as {
          creator: Address;
          yesToken: Address;
          noToken: Address;
          creatorDeposit: bigint;
          accumulatedFees: bigint;
          graduated: boolean;
          registeredInTickBook: boolean;
        };
        
        if (cfg.graduated && cfg.registeredInTickBook) {
          const marketKey = computeMarketKey(market, cfg.yesToken, cfg.noToken);
          return { market, marketKey, cfg };
        }
        return null;
      } catch {
        return null;
      }
    })
  );

  const activeMarkets = marketConfigs.filter((m): m is NonNullable<typeof m> => m !== null);
  console.log(`  ${activeMarkets.length} graduated + registered markets\n`);

  if (activeMarkets.length === 0) {
    console.log('  No active TickBook markets. Exiting.');
    return;
  }

  async function runScan() {
    stats.lastScanTime = new Date();
    
    for (const { market, marketKey } of activeMarkets) {
      const result = await scanMarket(publicClient, config, marketKey);
      if (!result) continue;

      const { orders, spotSells } = result;
      
      if (orders.length === 0 && spotSells.length === 0) continue;

      const opportunities = findArbitrageOpportunities(orders, spotSells);
      const profitable = filterProfitableOpportunities(opportunities, MIN_PROFIT_WAD);

      if (profitable.length > 0) {
        console.log(`\n  [${new Date().toISOString()}] Market ${market.slice(0, 10)}...`);
        console.log(`  Orders: ${orders.length} | Spot Sells: ${spotSells.length}`);
        console.log(`  Opportunities: ${profitable.length}`);
        
        for (const opp of profitable) {
          stats.totalOpportunitiesFound++;
          console.log(`\n    ${formatOpportunity(opp)}`);
          
          if (DRY_RUN) {
            console.log('    [DRY RUN] Would execute arbitrage');
            continue;
          }

          try {
            const gasEstimate = await estimateGasCost(publicClient, config, marketKey, opp, account.address);
            const gasPrice = await publicClient.getGasPrice();
            const gasCostWei = gasEstimate * gasPrice;
            
            console.log(`    Gas estimate: ${gasEstimate} (~${Number(gasCostWei) / 1e18} ETH)`);

            const result = await executeArbitrage(
              publicClient,
              walletClient,
              config,
              marketKey,
              opp,
              account.address
            );

            if (result.success) {
              stats.totalArbitragesExecuted++;
              stats.totalProfitWad += result.profitWad || 0n;
              console.log(`    SUCCESS! Profit: ${Number(result.profitWad || 0n) / 1e18} USDC`);
            } else {
              console.log(`    FAILED: ${result.error}`);
            }
          } catch (err) {
            console.log(`    ERROR: ${err instanceof Error ? err.message : 'Unknown'}`);
          }
        }
      }
    }
  }

  console.log('  Starting scan loop...\n');
  
  await runScan();
  
  setInterval(runScan, POLL_INTERVAL_MS);

  process.on('SIGINT', () => {
    console.log('\n\n  Keeper Stats');
    console.log('  ─────────────────────────────────────');
    console.log(`  Opportunities Found: ${stats.totalOpportunitiesFound}`);
    console.log(`  Arbitrages Executed: ${stats.totalArbitragesExecuted}`);
    console.log(`  Total Profit: ${Number(stats.totalProfitWad) / 1e18} USDC`);
    console.log('  ─────────────────────────────────────\n');
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
