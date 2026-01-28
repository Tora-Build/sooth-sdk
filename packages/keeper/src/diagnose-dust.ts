import 'dotenv/config';
import { createPublicClient, http, type Address } from 'viem';
import { getNetwork, POOL_MANAGER_ABI, LAUNCHPAD_ABI, COLLATERALIZER_ABI } from './config.js';
import { keccak256, encodeAbiParameters, parseAbiParameters } from 'viem';

function computeMarketKey(market: Address, yesToken: Address, noToken: Address): `0x${string}` {
  return keccak256(encodeAbiParameters(
    parseAbiParameters('address, address, address'),
    [market, yesToken, noToken]
  ));
}

async function main() {
  const chainName = process.env.CHAIN || 'baseSepolia';
  const config = getNetwork(chainName);

  const publicClient = createPublicClient({
    chain: config.chain,
    transport: http(config.rpcUrl || config.chain.rpcUrls.default.http[0]),
  });

  console.log(`\nDust Diagnostics - ${config.chain.name}\n`);

  const markets = await publicClient.readContract({
    address: config.contracts.LaunchpadEngine,
    abi: LAUNCHPAD_ABI,
    functionName: 'getMarkets',
  }) as Address[];

  for (const market of markets) {
    try {
      const [, , , , isGraduated] = await publicClient.readContract({
        address: config.contracts.LaunchpadEngine,
        abi: LAUNCHPAD_ABI,
        functionName: 'getMarketState',
        args: [market],
      }) as [Address, bigint, bigint, bigint, boolean, bigint];
      
      if (!isGraduated) continue;

      const [yesToken, noToken] = await publicClient.readContract({
        address: config.contracts.Collateralizer,
        abi: COLLATERALIZER_ABI,
        functionName: 'getOutcomeTokens',
        args: [market],
      }) as [Address, Address];

      const marketKey = computeMarketKey(market, yesToken, noToken);

      console.log(`Market: ${market}`);
      console.log(`MarketKey: ${marketKey}\n`);

      const dustTicks: { tick: number; outcome: string; liquidity: bigint }[] = [];
      
      for (let outcome = 0; outcome <= 1; outcome++) {
        const outcomeName = outcome === 0 ? 'YES' : 'NO';
        
        for (let tick = 1; tick <= 999; tick++) {
          try {
            const liquidity = await publicClient.readContract({
              address: config.contracts.TickBookPoolManager,
              abi: POOL_MANAGER_ABI,
              functionName: 'getSpotSellLiquidity',
              args: [marketKey, outcome, tick],
            }) as bigint;

            if (liquidity > 0n) {
              dustTicks.push({ tick, outcome: outcomeName, liquidity });
            }
          } catch {
            continue;
          }
        }
      }

      if (dustTicks.length > 0) {
        console.log(`\nFound ${dustTicks.length} ticks with spot liquidity:`);
        
        const yesTicks = dustTicks.filter(t => t.outcome === 'YES');
        const noTicks = dustTicks.filter(t => t.outcome === 'NO');

        if (yesTicks.length > 0) {
          console.log(`\nYES ticks (${yesTicks.length}):`);
          for (const t of yesTicks) {
            console.log(`  Tick ${t.tick} (${(t.tick / 10).toFixed(1)}%): ${t.liquidity} liquidity`);
          }
        }

        if (noTicks.length > 0) {
          console.log(`\nNO ticks (${noTicks.length}):`);
          for (const t of noTicks) {
            console.log(`  Tick ${t.tick} (${(t.tick / 10).toFixed(1)}%): ${t.liquidity} liquidity`);
          }
        }
      } else {
        console.log('\nNo spot liquidity found (clean!)');
      }

      console.log('\n' + '─'.repeat(60) + '\n');

    } catch (err) {
      console.log(`  Error: ${err instanceof Error ? err.message.slice(0, 80) : 'Unknown'}\n`);
    }
  }

  console.log('Done!');
}

main().catch(console.error);
