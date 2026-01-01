/**
 * State Commands
 * state, book, positions, info
 */

import type { CommandContext, CommandResult } from './types';
import { ABIS, WAD } from '../config';
import {
  formatWad,
  formatTick,
  formatOutcome,
  shortAddress,
  success,
  error,
  dim,
  bold,
  info,
  warn,
  printTable,
} from '../utils';

/**
 * Show market state
 * Usage: state
 */
export async function state(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  const { actorManager, deployment, marketKey, marketAddress } = ctx;
  const publicClient = actorManager.getPublicClient();

  if (!marketKey) {
    return { success: false, message: 'No market selected. Use: setmarket <address>' };
  }

  try {
    const [tick, liqNo, liqYes, prob] = await publicClient.readContract({
      address: deployment.contracts.TickBookPoolManager as `0x${string}`,
      abi: ABIS.TickBookPoolManager,
      functionName: 'getMarketState',
      args: [marketKey],
    }) as [number, bigint, bigint, bigint];

    const nextOrderId = await publicClient.readContract({
      address: deployment.contracts.TickBookPoolManager as `0x${string}`,
      abi: ABIS.TickBookPoolManager,
      functionName: 'nextOrderId',
      args: [marketKey],
    }) as bigint;

    console.log(`\n  ${bold('Market State')}`);
    console.log('  ' + '─'.repeat(50));
    console.log(`  Address:      ${marketAddress || 'N/A'}`);
    console.log(`  Market Key:   ${(marketKey as string).slice(0, 18)}...`);
    console.log('');
    console.log(`  Current Tick: ${tick} (${formatTick(tick)})`);
    console.log(`  Probability:  ${(Number(prob) / 1e18 * 100).toFixed(2)}%`);
    console.log('');
    console.log(`  ${info('YES')} Liquidity: ${formatWad(liqYes)} shares`);
    console.log(`  ${warn('NO')} Liquidity:  ${formatWad(liqNo)} shares`);
    console.log('');
    console.log(`  Total Orders: ${(nextOrderId - 1n).toString()}`);
    console.log('');

    return { success: true, data: { tick, liqNo, liqYes, prob } };
  } catch (err) {
    return { success: false, message: `Failed to get market state: ${(err as Error).message}` };
  }
}

/**
 * Show orderbook depth (simplified view)
 * Usage: book [depth]
 */
export async function book(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  const { actorManager, deployment, marketKey } = ctx;
  const publicClient = actorManager.getPublicClient();

  if (!marketKey) {
    return { success: false, message: 'No market selected' };
  }

  const depth = args[0] ? parseInt(args[0], 10) : 10;

  try {
    // Get market state for current tick
    const [tick, liqNo, liqYes, prob] = await publicClient.readContract({
      address: deployment.contracts.TickBookPoolManager as `0x${string}`,
      abi: ABIS.TickBookPoolManager,
      functionName: 'getMarketState',
      args: [marketKey],
    }) as [number, bigint, bigint, bigint];

    // Get total order count
    const nextOrderId = await publicClient.readContract({
      address: deployment.contracts.TickBookPoolManager as `0x${string}`,
      abi: ABIS.TickBookPoolManager,
      functionName: 'nextOrderId',
      args: [marketKey],
    }) as bigint;

    console.log(`\n  ${bold('Order Book')} (tick: ${tick}, prob: ${(Number(prob) / 1e18 * 100).toFixed(1)}%)`);
    console.log('  ' + '═'.repeat(60));

    // Collect active orders
    const yesOrders: any[] = [];
    const noOrders: any[] = [];

    const maxOrders = Number(nextOrderId) - 1;
    const scanLimit = Math.min(maxOrders, 50); // Limit scan to avoid timeout

    for (let i = 1; i <= scanLimit; i++) {
      try {
        const order = await publicClient.readContract({
          address: deployment.contracts.TickBookPoolManager as `0x${string}`,
          abi: ABIS.TickBookPoolManager,
          functionName: 'getOrder',
          args: [marketKey, BigInt(i)],
        }) as any;

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
      } catch {
        // Order doesn't exist or error, skip
      }
    }

    // Sort by tick (ascending for display)
    yesOrders.sort((a, b) => a.tickLower - b.tickLower);
    noOrders.sort((a, b) => b.tickLower - a.tickLower); // Reverse for NO side

    // Display YES side (bids)
    console.log(`\n  ${info('YES Orders')} (${yesOrders.length} active)`);
    if (yesOrders.length === 0) {
      console.log('  ' + dim('  (no active YES orders)'));
    } else {
      const yesRows = yesOrders.slice(0, depth).map(o => [
        `#${o.id}`,
        `${formatTick(o.tickLower)}-${formatTick(o.tickUpper)}`,
        formatWad(o.remaining),
        shortAddress(o.owner),
      ]);
      printTable(['ID', 'Range', 'Remaining', 'Owner'], yesRows, [6, 14, 14, 14]);
    }

    // Display NO side (asks)
    console.log(`\n  ${warn('NO Orders')} (${noOrders.length} active)`);
    if (noOrders.length === 0) {
      console.log('  ' + dim('  (no active NO orders)'));
    } else {
      const noRows = noOrders.slice(0, depth).map(o => [
        `#${o.id}`,
        `${formatTick(o.tickLower)}-${formatTick(o.tickUpper)}`,
        formatWad(o.remaining),
        shortAddress(o.owner),
      ]);
      printTable(['ID', 'Range', 'Remaining', 'Owner'], noRows, [6, 14, 14, 14]);
    }

    console.log('');

    // Summary
    const totalYesLiq = yesOrders.reduce((sum, o) => sum + o.remaining, 0n);
    const totalNoLiq = noOrders.reduce((sum, o) => sum + o.remaining, 0n);

    console.log('  ' + '─'.repeat(40));
    console.log(`  Total YES liquidity: ${formatWad(totalYesLiq)} shares`);
    console.log(`  Total NO liquidity:  ${formatWad(totalNoLiq)} shares`);
    console.log('');

    return { success: true };
  } catch (err) {
    return { success: false, message: `Failed to get order book: ${(err as Error).message}` };
  }
}

/**
 * Show positions for all actors
 * Usage: positions
 */
export async function positions(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  const { actorManager, deployment, marketAddress } = ctx;
  const publicClient = actorManager.getPublicClient();

  if (!marketAddress) {
    return { success: false, message: 'No market selected' };
  }

  const actors = actorManager.listActors();
  if (actors.length === 0) {
    return { success: false, message: 'No actors loaded' };
  }

  console.log(`\n  ${bold('Positions')}`);
  console.log('  ' + '─'.repeat(60));

  const rows: string[][] = [];

  for (const actor of actors) {
    try {
      // Get vault position
      const [available, reserved] = await Promise.all([
        publicClient.readContract({
          address: deployment.contracts.TickBookVault as `0x${string}`,
          abi: ABIS.TickBookVault,
          functionName: 'availableUsdcWad',
          args: [actor.account.address],
        }) as Promise<bigint>,
        publicClient.readContract({
          address: deployment.contracts.TickBookVault as `0x${string}`,
          abi: ABIS.TickBookVault,
          functionName: 'reservedUsdcWad',
          args: [actor.account.address],
        }) as Promise<bigint>,
      ]);

      // Get internal outcomes from vault
      const [yesShares, noShares] = await publicClient.readContract({
        address: deployment.contracts.TickBookVault as `0x${string}`,
        abi: ABIS.TickBookVault,
        functionName: 'getInternalOutcomes',
        args: [marketAddress, actor.account.address],
      }) as [bigint, bigint];

      const isCurrent = actorManager.currentActor()?.name === actor.name;
      const nameDisplay = isCurrent ? success(actor.name) : actor.name;

      rows.push([
        nameDisplay,
        formatWad(available),
        formatWad(reserved),
        formatWad(yesShares),
        formatWad(noShares),
      ]);
    } catch (err) {
      rows.push([actor.name, '?', '?', '?', '?']);
    }
  }

  printTable(
    ['Actor', 'Available', 'Reserved', 'YES Shares', 'NO Shares'],
    rows,
    [10, 12, 12, 12, 12]
  );

  console.log('');
  return { success: true };
}

/**
 * Show market info (addresses)
 * Usage: info
 */
export async function marketinfo(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  const { actorManager, deployment, marketKey, marketAddress } = ctx;
  const publicClient = actorManager.getPublicClient();

  if (!marketKey) {
    return { success: false, message: 'No market selected' };
  }

  try {
    const [truthMarket, yesToken, noToken, hook] = await publicClient.readContract({
      address: deployment.contracts.TickBookPoolManager as `0x${string}`,
      abi: ABIS.TickBookPoolManager,
      functionName: 'getMarketInfo',
      args: [marketKey],
    }) as [string, string, string, string];

    console.log(`\n  ${bold('Market Info')}`);
    console.log('  ' + '─'.repeat(50));
    console.log(`  Market Key:   ${marketKey}`);
    console.log(`  TruthMarket:  ${truthMarket}`);
    console.log(`  YES Token:    ${yesToken}`);
    console.log(`  NO Token:     ${noToken}`);
    console.log(`  Hook:         ${hook === '0x0000000000000000000000000000000000000000' ? dim('none') : hook}`);
    console.log('');

    return { success: true };
  } catch (err) {
    return { success: false, message: `Failed to get market info: ${(err as Error).message}` };
  }
}

/**
 * Show current market selection
 * Usage: markets (or m)
 */
export async function markets(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  const { marketKey, marketAddress, deployment } = ctx;

  console.log(`\n  ${bold('Current Market')}`);
  console.log('  ' + '─'.repeat(50));

  if (!marketAddress) {
    console.log(`  ${warn('No market selected')}`);
    console.log('');
    console.log('  Use: setmarket <address|index|name>');
  } else {
    // Find market name from deployment
    const deployedMarket = deployment.markets.find(
      m => m.address.toLowerCase() === marketAddress.toLowerCase()
    );

    console.log(`  Name:    ${deployedMarket?.name || dim('(unknown)')}`);
    console.log(`  Address: ${marketAddress}`);
    console.log(`  Key:     ${marketKey || dim('N/A')}`);
  }

  // Show available markets
  if (deployment.markets.length > 0) {
    console.log('');
    console.log(`  ${info('Available markets:')}`);
    deployment.markets.forEach((m, i) => {
      const isCurrent = m.address.toLowerCase() === marketAddress?.toLowerCase();
      const marker = isCurrent ? success('→') : ' ';
      console.log(`  ${marker} ${i}: ${m.name || 'Unnamed'} (${shortAddress(m.address)})`);
    });
  }
  console.log('');

  return { success: true };
}

/**
 * Set the current market
 * Usage: setmarket <address|name>
 */
export async function setmarket(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  // This is handled in the main REPL, but we provide help here
  if (args.length < 1) {
    console.log('\n  Usage: setmarket <address|index>');
    console.log('  Example: setmarket 0x1234...');
    console.log('  Example: setmarket 0  (first market in deployment)');

    // Show available markets
    if (ctx.deployment.markets.length > 0) {
      console.log('\n  Available markets:');
      ctx.deployment.markets.forEach((m, i) => {
        console.log(`    ${i}: ${m.name || 'Unnamed'} (${shortAddress(m.address)})`);
      });
    }
    console.log('');
  }

  return { success: true };
}

export const stateCommands = {
  state,
  book,
  positions,
  info: marketinfo,
  markets,
  setmarket,
};
