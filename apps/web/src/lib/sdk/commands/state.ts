import type { SDKContext, CommandResult, OutputLine, MarketState, Order } from '../types';
import { ABIS } from '../../../config/abis';
import { formatWad, formatTick, formatOutcome, shortAddress, success, error, info, warn, dim, bold, plain, lines, separator } from '../utils';

export async function getMarketState(ctx: SDKContext): Promise<MarketState> {
  const { config, marketKey } = ctx;
  if (!marketKey) throw new Error('No market selected');

  const [tick, liqNo, liqYes, prob] = await config.publicClient.readContract({
    address: config.contracts.TickBookPoolManager,
    abi: ABIS.TickBookPoolManager,
    functionName: 'getMarketState',
    args: [marketKey],
  }) as [number, bigint, bigint, bigint];

  return { tick, liqNo, liqYes, prob };
}

export async function getOrder(ctx: SDKContext, orderId: bigint): Promise<Order> {
  const { config, marketKey } = ctx;
  if (!marketKey) throw new Error('No market selected');

  const order = await config.publicClient.readContract({
    address: config.contracts.TickBookPoolManager,
    abi: ABIS.TickBookPoolManager,
    functionName: 'getOrder',
    args: [marketKey, orderId],
  }) as any;

  return {
    owner: order.owner,
    outcome: order.outcome,
    tickLower: order.tickLower,
    tickUpper: order.tickUpper,
    sharesTotal: order.sharesTotal,
    filledShares: order.filledShares,
    fillAccumulator: order.fillAccumulator,
    active: order.active,
    liquidityRemoved: order.liquidityRemoved,
  };
}

export async function state(ctx: SDKContext, args: string[]): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, marketKey, marketAddress } = ctx;

  if (!marketKey) {
    return {
      result: { success: false, message: 'No market selected' },
      output: [error('No market selected. Use: setmarket <address>')],
    };
  }

  const scanLimit = args[0] ? Math.max(1, Math.min(parseInt(args[0], 10) || 0, 200)) : 50;

  try {
    const { tick, liqNo, liqYes, prob } = await getMarketState(ctx);

    let activeOrders = 0;
    for (let i = 1; i <= scanLimit; i++) {
      try {
        const order = await getOrder(ctx, BigInt(i));
        if (order.active) activeOrders++;
      } catch {}
    }

    const output: OutputLine[] = [
      plain(''),
      bold('Market State'),
      separator(50),
      plain(`Address:      ${marketAddress || 'N/A'}`),
      plain(`Market Key:   ${(marketKey as string).slice(0, 18)}...`),
      plain(''),
      plain(`Current Tick: ${tick} (${formatTick(tick)})`),
      plain(`Probability:  ${(Number(prob) / 1e18 * 100).toFixed(2)}%`),
      plain(''),
      info(`YES Liquidity: ${formatWad(liqYes)} shares`),
      warn(`NO Liquidity:  ${formatWad(liqNo)} shares`),
      plain(''),
      plain(`Active Orders (scanned 1..${scanLimit}): ${activeOrders}`),
      plain(''),
    ];

    return {
      result: { success: true, data: { tick, liqNo, liqYes, prob } },
      output,
    };
  } catch (err) {
    return {
      result: { success: false, message: (err as Error).message },
      output: [error(`Failed to get market state: ${(err as Error).message}`)],
    };
  }
}

export async function book(ctx: SDKContext, args: string[]): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, marketKey } = ctx;

  if (!marketKey) {
    return {
      result: { success: false, message: 'No market selected' },
      output: [error('No market selected')],
    };
  }

  const depth = args[0] ? parseInt(args[0], 10) : 10;
  const scanLimit = args[1] ? Math.max(1, Math.min(parseInt(args[1], 10) || 0, 200)) : 50;

  try {
    const { tick, prob } = await getMarketState(ctx);

    const yesOrders: { id: number; tickLower: number; tickUpper: number; remaining: bigint; owner: string }[] = [];
    const noOrders: { id: number; tickLower: number; tickUpper: number; remaining: bigint; owner: string }[] = [];

    for (let i = 1; i <= scanLimit; i++) {
      try {
        const order = await getOrder(ctx, BigInt(i));
        if (order.active) {
          const remaining = order.sharesTotal - order.filledShares;
          if (remaining > 0n) {
            const orderData = {
              id: i,
              tickLower: order.tickLower,
              tickUpper: order.tickUpper,
              remaining,
              owner: order.owner,
            };
            if (order.outcome === 1) {
              yesOrders.push(orderData);
            } else {
              noOrders.push(orderData);
            }
          }
        }
      } catch {}
    }

    yesOrders.sort((a, b) => a.tickLower - b.tickLower);
    noOrders.sort((a, b) => b.tickLower - a.tickLower);

    const output: OutputLine[] = [
      plain(''),
      bold(`Order Book (tick: ${tick}, prob: ${(Number(prob) / 1e18 * 100).toFixed(1)}%)`),
      separator(60),
      plain(''),
      info(`YES Orders (${yesOrders.length} active)`),
    ];

    if (yesOrders.length === 0) {
      output.push(dim('  (no active YES orders)'));
    } else {
      for (const o of yesOrders.slice(0, depth)) {
        output.push(plain(`  #${o.id.toString().padEnd(4)} ${formatTick(o.tickLower)}-${formatTick(o.tickUpper).padEnd(12)} ${formatWad(o.remaining).padStart(12)} shares  ${shortAddress(o.owner)}`));
      }
    }

    output.push(plain(''));
    output.push(warn(`NO Orders (${noOrders.length} active)`));

    if (noOrders.length === 0) {
      output.push(dim('  (no active NO orders)'));
    } else {
      for (const o of noOrders.slice(0, depth)) {
        output.push(plain(`  #${o.id.toString().padEnd(4)} ${formatTick(o.tickLower)}-${formatTick(o.tickUpper).padEnd(12)} ${formatWad(o.remaining).padStart(12)} shares  ${shortAddress(o.owner)}`));
      }
    }

    const totalYes = yesOrders.reduce((sum, o) => sum + o.remaining, 0n);
    const totalNo = noOrders.reduce((sum, o) => sum + o.remaining, 0n);

    output.push(plain(''));
    output.push(separator());
    output.push(plain(`Total YES liquidity: ${formatWad(totalYes)} shares`));
    output.push(plain(`Total NO liquidity:  ${formatWad(totalNo)} shares`));
    output.push(plain(''));

    return { result: { success: true }, output };
  } catch (err) {
    return {
      result: { success: false, message: (err as Error).message },
      output: [error(`Failed to get order book: ${(err as Error).message}`)],
    };
  }
}

export async function positions(ctx: SDKContext): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, address, marketAddress } = ctx;

  if (!address) {
    return {
      result: { success: false, message: 'No wallet connected' },
      output: [error('No wallet connected')],
    };
  }

  if (!marketAddress) {
    return {
      result: { success: false, message: 'No market selected' },
      output: [error('No market selected')],
    };
  }

  try {
    const [yesShares, noShares] = await config.publicClient.readContract({
      address: config.contracts.TickBookVault,
      abi: ABIS.TickBookVault,
      functionName: 'getInternalOutcomes',
      args: [marketAddress, address],
    }) as [bigint, bigint];

    const output: OutputLine[] = [
      plain(''),
      bold(`Positions for ${shortAddress(address)}`),
      separator(),
      info(`YES: ${formatWad(yesShares)} shares`),
      warn(`NO:  ${formatWad(noShares)} shares`),
      plain(''),
    ];

    return { result: { success: true, data: { yesShares, noShares } }, output };
  } catch (err) {
    return {
      result: { success: false, message: (err as Error).message },
      output: [error(`Failed to get positions: ${(err as Error).message}`)],
    };
  }
}

export async function marketinfo(ctx: SDKContext): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, marketKey, marketAddress } = ctx;

  if (!marketKey) {
    return {
      result: { success: false, message: 'No market selected' },
      output: [error('No market selected. Use: setmarket <address>')],
    };
  }

  try {
    const [truthMarket, yesToken, noToken, hook] = await config.publicClient.readContract({
      address: config.contracts.TickBookPoolManager,
      abi: ABIS.TickBookPoolManager,
      functionName: 'getMarketInfo',
      args: [marketKey],
    }) as [string, string, string, string];

    const active =
      truthMarket !== '0x0000000000000000000000000000000000000000' &&
      yesToken !== '0x0000000000000000000000000000000000000000' &&
      noToken !== '0x0000000000000000000000000000000000000000';

    const output: OutputLine[] = [
      plain(''),
      bold('Market Info'),
      separator(50),
      plain(`Market Key:   ${marketKey}`),
      plain(`TruthMarket:  ${truthMarket}`),
      plain(`YES Token:    ${yesToken}`),
      plain(`NO Token:     ${noToken}`),
      plain(`Hook:         ${hook === '0x0000000000000000000000000000000000000000' ? '(none)' : hook}`),
      plain(`Active:       ${active ? 'YES' : 'NO'}`),
      plain(''),
    ];

    return {
      result: { success: true, data: { truthMarket, yesToken, noToken, hook, active } },
      output,
    };
  } catch (err) {
    return {
      result: { success: false, message: (err as Error).message },
      output: [error(`Failed to get market info: ${(err as Error).message}`)],
    };
  }
}

export async function markets(ctx: SDKContext): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, marketAddress } = ctx;

  const output: OutputLine[] = [
    plain(''),
    bold('Current Market'),
    separator(50),
  ];

  if (!marketAddress) {
    output.push(warn('No market selected'));
    output.push(plain(''));
    output.push(plain('Use: setmarket <address|index>'));
  } else {
    output.push(plain(`Address: ${marketAddress}`));
  }

  try {
    const onChainMarkets = await config.publicClient.readContract({
      address: config.contracts.LaunchpadEngine,
      abi: ABIS.LaunchpadEngine,
      functionName: 'getMarkets',
    }) as string[];

    if (onChainMarkets.length > 0) {
      output.push(plain(''));
      output.push(info(`Available markets: (${onChainMarkets.length} on-chain)`));

      for (let i = 0; i < onChainMarkets.length; i++) {
        const addr = onChainMarkets[i];
        const isCurrent = addr.toLowerCase() === marketAddress?.toLowerCase();
        const marker = isCurrent ? '>' : ' ';

        try {
          const marketState = await config.publicClient.readContract({
            address: config.contracts.LaunchpadEngine,
            abi: ABIS.LaunchpadEngine,
            functionName: 'markets',
            args: [addr as `0x${string}`],
          }) as any;

          const isGraduated = marketState[8]; // V11: lpToken at [1] shifts indices
          const symbol = addr.slice(2, 10).toUpperCase();
          const bBase = marketState[2]; // V11: bBase now at [2]
          const bDisplay = (Number(bBase) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 });

          let name = symbol;
          try {
            const question = await config.publicClient.readContract({
              address: addr as `0x${string}`,
              abi: [{ name: 'question', type: 'function', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' }],
              functionName: 'question',
            }) as string;
            if (question) name = question.length > 55 ? question.slice(0, 52) + '...' : question;
          } catch {}

          let pctStr = '?';
          if (isGraduated) {
            pctStr = '✓';
          } else {
            try {
              const progress = await config.publicClient.readContract({
                address: config.contracts.LaunchpadEngine,
                abi: ABIS.LaunchpadEngine,
                functionName: 'getGraduationProgress',
                args: [addr as `0x${string}`],
              }) as [bigint, bigint, bigint];
              const pctBps = Number(progress[2]);
              pctStr = pctBps >= 10000 ? 'ready!' : `${(pctBps / 100).toFixed(0)}%`;
            } catch {}
          }

          output.push(plain(`${marker} ${i}: ${name}`));
          output.push(dim(`     [${symbol}]  ${pctStr.padEnd(6)}  b=${bDisplay.padStart(6)}  ${shortAddress(addr)}`));
        } catch {
          output.push(dim(`${marker} ${i}: (error fetching) (${shortAddress(addr)})`));
        }
      }
    }
  } catch {
    output.push(plain(''));
    output.push(dim('(Could not fetch markets from LaunchpadEngine)'));
  }

  output.push(plain(''));
  return { result: { success: true }, output };
}

export const stateCommands = { state, book, positions, getMarketState, getOrder, marketinfo, markets };
