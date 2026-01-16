import type { SDKContext, CommandResult, OutputLine, OrderResult } from '../types';
import { ABIS } from '../../../config/abis';
import { formatWad, parseWad, parseTickRange, parseOutcome, formatOutcome, formatTick, shortTx, shortAddress, success, error, dim, plain, bold, info, warn, separator } from '../utils';

export type { OrderResult } from '../types';

export async function order(ctx: SDKContext, args: string[]): Promise<{ result: CommandResult; output: OutputLine[]; orderResult?: OrderResult }> {
  const { config, address, marketKey } = ctx;
  
  if (!address || !config.walletClient) {
    return { result: { success: false, message: 'No wallet connected' }, output: [error('No wallet connected')] };
  }

  if (!marketKey) {
    return { result: { success: false, message: 'No market selected' }, output: [error('No market selected. Use: setmarket <address>')] };
  }

  if (args.length < 3) {
    return { result: { success: false, message: 'Usage: order <outcome> <tickRange> <shares>' }, output: [error('Usage: order <outcome> <tickRange> <shares>\nExample: order yes 40-60 100')] };
  }

  try {
    const outcome = parseOutcome(args[0]);
    const { tickLower, tickUpper } = parseTickRange(args[1]);
    const shares = parseWad(args[2]);
    const maxCost = args[3] ? parseWad(args[3]) : shares * 2n;
    const orderType = tickLower === tickUpper ? 'limit' : (tickLower === 10 && tickUpper === 9990) ? 'market' : 'range';

    let simResult: [bigint, bigint, bigint, bigint] | undefined;
    try {
      const sim = await config.publicClient.simulateContract({
        address: config.contracts.TickBookPoolManager,
        abi: ABIS.TickBookPoolManager,
        functionName: 'placeOrder',
        args: [marketKey, outcome, shares, tickLower, tickUpper, maxCost],
        account: address,
      });
      simResult = sim.result as [bigint, bigint, bigint, bigint];
    } catch {
      // Simulation failed, proceed with write anyway
    }

    const hash = await config.walletClient.writeContract({
      address: config.contracts.TickBookPoolManager,
      abi: ABIS.TickBookPoolManager,
      functionName: 'placeOrder',
      args: [marketKey, outcome, shares, tickLower, tickUpper, maxCost],
    });

    const receipt = await config.publicClient.waitForTransactionReceipt({ hash });

    const [orderId, filledShares, filledCost, restingShares] = simResult || [0n, 0n, 0n, shares];

    const orderResult: OrderResult = {
      orderId,
      filledShares,
      filledCost,
      restingShares,
      outcome,
      tickLower,
      tickUpper,
      shares,
      orderType,
      gasUsed: receipt.gasUsed,
    };

    return {
      result: { success: true, txHash: hash, data: orderResult },
      output: [success(`Placed ${orderType} ${formatOutcome(outcome)} order at ${formatTick(tickLower)}-${formatTick(tickUpper)} for ${formatWad(shares)} shares (tx: ${shortTx(hash)})`)],
      orderResult,
    };
  } catch (err) {
    return { result: { success: false, message: (err as Error).message }, output: [error(`Order failed: ${(err as Error).message.slice(0, 60)}`)] };
  }
}

export async function cancel(ctx: SDKContext, args: string[]): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, address, marketKey } = ctx;
  
  if (!address || !config.walletClient) {
    return { result: { success: false, message: 'No wallet connected' }, output: [error('No wallet connected')] };
  }

  if (!marketKey) {
    return { result: { success: false, message: 'No market selected' }, output: [error('No market selected')] };
  }

  if (args.length < 1) {
    return { result: { success: false, message: 'Usage: cancel <orderId>' }, output: [error('Usage: cancel <orderId>')] };
  }

  const orderId = BigInt(args[0]);

  try {
    const hash = await config.walletClient.writeContract({
      address: config.contracts.TickBookPoolManager,
      abi: ABIS.TickBookPoolManager,
      functionName: 'cancelOrder',
      args: [marketKey, orderId],
    });

    await config.publicClient.waitForTransactionReceipt({ hash });

    return { result: { success: true, txHash: hash }, output: [success(`Cancelled order #${orderId} (tx: ${shortTx(hash)})`)] };
  } catch (err) {
    return { result: { success: false, message: (err as Error).message }, output: [error(`Cancel failed: ${(err as Error).message.slice(0, 60)}`)] };
  }
}

export async function claim(ctx: SDKContext, args: string[]): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, address, marketKey } = ctx;
  
  if (!address || !config.walletClient) {
    return { result: { success: false, message: 'No wallet connected' }, output: [error('No wallet connected')] };
  }

  if (!marketKey) {
    return { result: { success: false, message: 'No market selected' }, output: [error('No market selected')] };
  }

  if (args.length < 1) {
    return { result: { success: false, message: 'Usage: claim <orderId>' }, output: [error('Usage: claim <orderId>')] };
  }

  const orderId = BigInt(args[0]);

  try {
    const hash = await config.walletClient.writeContract({
      address: config.contracts.TickBookPoolManager,
      abi: ABIS.TickBookPoolManager,
      functionName: 'claimFills',
      args: [marketKey, orderId],
    });

    await config.publicClient.waitForTransactionReceipt({ hash });

    return { result: { success: true, txHash: hash }, output: [success(`Claimed fills for order #${orderId} (tx: ${shortTx(hash)})`)] };
  } catch (err) {
    return { result: { success: false, message: (err as Error).message }, output: [error(`Claim failed: ${(err as Error).message.slice(0, 60)}`)] };
  }
}

export async function marketOrder(ctx: SDKContext, args: string[]): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, address, marketKey, marketAddress } = ctx;
  
  if (!address || !config.walletClient) {
    return { result: { success: false, message: 'No wallet connected' }, output: [error('No wallet connected')] };
  }

  if (args.length < 3) {
    return { result: { success: false, message: 'Usage: market buy|sell <outcome> <shares>' }, output: [error('Usage: market buy|sell <outcome> <shares>\nExample: market buy yes 100')] };
  }

  const side = args[0].toLowerCase();
  const outcome = parseOutcome(args[1]);
  const shares = parseWad(args[2]);
  const maxCost = args[3] ? parseWad(args[3]) : shares * 2n;

  if (side !== 'buy' && side !== 'sell') {
    return { result: { success: false, message: 'Invalid side' }, output: [error('Side must be "buy" or "sell"')] };
  }

  try {
    if (!marketKey && marketAddress) {
      const deltaShares = side === 'buy' ? shares : -shares;
      const hash = await config.walletClient.writeContract({
        address: config.contracts.LaunchpadEngine,
        abi: ABIS.LaunchpadEngine,
        functionName: 'tradePositions',
        args: [marketAddress, outcome, deltaShares, maxCost],
      });
      await config.publicClient.waitForTransactionReceipt({ hash });
      return { result: { success: true, txHash: hash }, output: [success(`${side === 'buy' ? 'Bought' : 'Sold'} ${formatWad(shares)} ${formatOutcome(outcome)} shares via AMM (tx: ${shortTx(hash)})`)] };
    }

    if (!marketKey) {
      return { result: { success: false, message: 'No market selected' }, output: [error('No market selected. Use: setmarket <address>')] };
    }

    const hash = await config.walletClient.writeContract({
      address: config.contracts.TickBookPoolManager,
      abi: ABIS.TickBookPoolManager,
      functionName: 'placeOrder',
      args: [marketKey, outcome, shares, 1, 999, maxCost],
    });

    await config.publicClient.waitForTransactionReceipt({ hash });

    return { result: { success: true, txHash: hash }, output: [success(`${side === 'buy' ? 'Bought' : 'Sold'} ${formatWad(shares)} ${formatOutcome(outcome)} shares (tx: ${shortTx(hash)})`)] };
  } catch (err) {
    return { result: { success: false, message: (err as Error).message }, output: [error(`Market order failed: ${(err as Error).message.slice(0, 60)}`)] };
  }
}

export async function orders(ctx: SDKContext, args: string[]): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, address, marketKey } = ctx;

  if (!marketKey) {
    return { result: { success: false, message: 'No market selected' }, output: [error('No market selected')] };
  }

  const targetAddress = args[0]?.startsWith('0x') ? args[0] as `0x${string}` : address;
  if (!targetAddress) {
    return { result: { success: false, message: 'No address' }, output: [error('No wallet connected')] };
  }

  try {
    const orderIds = await config.publicClient.readContract({
      address: config.contracts.TickBookPoolManager,
      abi: ABIS.TickBookPoolManager,
      functionName: 'getUserOrders',
      args: [marketKey, targetAddress],
    }) as bigint[];

    if (orderIds.length === 0) {
      return { result: { success: true }, output: [plain(''), dim(`No orders for ${shortAddress(targetAddress)}`), plain('')] };
    }

    const output: OutputLine[] = [plain(''), bold(`Orders for ${shortAddress(targetAddress)}`), separator(70)];

    for (const orderId of orderIds) {
      try {
        const order = await config.publicClient.readContract({
          address: config.contracts.TickBookPoolManager,
          abi: ABIS.TickBookPoolManager,
          functionName: 'getOrder',
          args: [marketKey, orderId],
        }) as any;

        const status = order.active ? 'ACTIVE' : 'INACTIVE';
        const filled = `${formatWad(order.filledShares)}/${formatWad(order.sharesTotal)}`;
        const range = `${formatTick(order.tickLower)}-${formatTick(order.tickUpper)}`;

        output.push(plain(`  #${orderId.toString().padEnd(4)} ${formatOutcome(order.outcome).padEnd(4)} ${range.padEnd(14)} ${filled.padEnd(20)} ${status}`));
      } catch {
        output.push(dim(`  #${orderId.toString().padEnd(4)} (error reading)`));
      }
    }

    output.push(plain(''));
    return { result: { success: true }, output };
  } catch (err) {
    return { result: { success: false, message: (err as Error).message }, output: [error(`Failed to fetch orders: ${(err as Error).message}`)] };
  }
}

export async function getorder(ctx: SDKContext, args: string[]): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, marketKey } = ctx;

  if (!marketKey) {
    return { result: { success: false, message: 'No market selected' }, output: [error('No market selected')] };
  }

  if (args.length < 1) {
    return { result: { success: false, message: 'Usage: getorder <orderId>' }, output: [error('Usage: getorder <orderId>')] };
  }

  const orderId = BigInt(args[0]);

  try {
    const order = await config.publicClient.readContract({
      address: config.contracts.TickBookPoolManager,
      abi: ABIS.TickBookPoolManager,
      functionName: 'getOrder',
      args: [marketKey, orderId],
    }) as any;

    const output: OutputLine[] = [
      plain(''),
      bold(`Order #${orderId}`),
      separator(),
      plain(`Owner:      ${order.owner}`),
      plain(`Outcome:    ${formatOutcome(order.outcome)}`),
      plain(`Range:      ${formatTick(order.tickLower)} - ${formatTick(order.tickUpper)}`),
      plain(`Shares:     ${formatWad(order.sharesTotal)}`),
      plain(`Filled:     ${formatWad(order.filledShares)}`),
      plain(`Active:     ${order.active ? 'YES' : 'NO'}`),
      plain(''),
    ];

    return { result: { success: true }, output };
  } catch (err) {
    return { result: { success: false, message: (err as Error).message }, output: [error(`Failed to get order: ${(err as Error).message}`)] };
  }
}

export async function spotsell(ctx: SDKContext, args: string[]): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, address, marketKey } = ctx;

  if (!address || !config.walletClient) {
    return { result: { success: false, message: 'No wallet connected' }, output: [error('No wallet connected')] };
  }

  if (!marketKey) {
    return { result: { success: false, message: 'No market selected' }, output: [error('No market selected')] };
  }

  if (args.length < 3) {
    return { result: { success: false, message: 'Usage: spotsell <outcome> <tickRange> <shares>' }, output: [error('Usage: spotsell <outcome> <tickRange> <shares>\nExample: spotsell yes 50-60 100')] };
  }

  try {
    const outcome = parseOutcome(args[0]);
    const { tickLower, tickUpper } = parseTickRange(args[1]);
    const shares = parseWad(args[2]);

    const ticksInRange = tickUpper - tickLower + 1;
    if (ticksInRange > 50) {
      return { result: { success: false, message: 'Range too wide' }, output: [error(`Spot sell range too wide: ${ticksInRange} ticks (max 50)`)] };
    }

    const hash = await config.walletClient.writeContract({
      address: config.contracts.TickBookPoolManager,
      abi: ABIS.TickBookPoolManager,
      functionName: 'placeSpotSell',
      args: [marketKey, outcome, shares, tickLower, tickUpper],
    });

    await config.publicClient.waitForTransactionReceipt({ hash });

    return { result: { success: true, txHash: hash }, output: [success(`Placed spot sell ${formatOutcome(outcome)} at ${formatTick(tickLower)}-${formatTick(tickUpper)} for ${formatWad(shares)} shares (tx: ${shortTx(hash)})`)] };
  } catch (err) {
    return { result: { success: false, message: (err as Error).message }, output: [error(`Spot sell failed: ${(err as Error).message.slice(0, 60)}`)] };
  }
}

export async function cancelspotsell(ctx: SDKContext, args: string[]): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, address, marketKey } = ctx;

  if (!address || !config.walletClient) {
    return { result: { success: false, message: 'No wallet connected' }, output: [error('No wallet connected')] };
  }

  if (!marketKey) {
    return { result: { success: false, message: 'No market selected' }, output: [error('No market selected')] };
  }

  if (args.length < 1) {
    return { result: { success: false, message: 'Usage: cancelspotsell <sellId>' }, output: [error('Usage: cancelspotsell <sellId>')] };
  }

  const sellId = BigInt(args[0]);

  try {
    const hash = await config.walletClient.writeContract({
      address: config.contracts.TickBookPoolManager,
      abi: ABIS.TickBookPoolManager,
      functionName: 'cancelSpotSell',
      args: [marketKey, sellId],
    });

    await config.publicClient.waitForTransactionReceipt({ hash });

    return { result: { success: true, txHash: hash }, output: [success(`Cancelled spot sell #${sellId} (tx: ${shortTx(hash)})`)] };
  } catch (err) {
    return { result: { success: false, message: (err as Error).message }, output: [error(`Cancel failed: ${(err as Error).message.slice(0, 60)}`)] };
  }
}

export async function spotsells(ctx: SDKContext, _args: string[]): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, address, marketKey } = ctx;

  if (!address) {
    return { result: { success: false, message: 'No wallet connected' }, output: [error('No wallet connected')] };
  }

  if (!marketKey) {
    return { result: { success: false, message: 'No market selected' }, output: [error('No market selected')] };
  }

  try {
    const sellIds = await config.publicClient.readContract({
      address: config.contracts.TickBookPoolManager,
      abi: ABIS.TickBookPoolManager,
      functionName: 'getUserSpotSells',
      args: [marketKey, address],
    }) as bigint[];

    if (sellIds.length === 0) {
      return { result: { success: true }, output: [dim('No spot sell orders found')] };
    }

    const output: OutputLine[] = [plain(''), info(`Spot Sell Orders (${sellIds.length})`)];

    for (const sellId of sellIds) {
      try {
        const order = await config.publicClient.readContract({
          address: config.contracts.TickBookPoolManager,
          abi: ABIS.TickBookPoolManager,
          functionName: 'getSpotSellOrder',
          args: [marketKey, sellId],
        }) as any;

        const fillPct = order.sharesTotal > 0n ? Number((order.sharesFilled * 100n) / order.sharesTotal) : 0;
        const status = order.active ? 'ACTIVE' : 'INACTIVE';

        output.push(plain(`  #${sellId} ${formatOutcome(order.outcome)} ${formatTick(order.tickLower)}-${formatTick(order.tickUpper)} ${formatWad(order.sharesTotal)} shares (${fillPct}% filled) ${status}`));
      } catch {
        output.push(dim(`  #${sellId} (error reading)`));
      }
    }

    output.push(plain(''));
    return { result: { success: true }, output };
  } catch (err) {
    return { result: { success: false, message: (err as Error).message }, output: [error(`Failed to list spot sells: ${(err as Error).message}`)] };
  }
}

export async function claimspotsell(ctx: SDKContext, args: string[]): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, address, marketKey } = ctx;

  if (!address || !config.walletClient) {
    return { result: { success: false, message: 'No wallet connected' }, output: [error('No wallet connected')] };
  }

  if (!marketKey) {
    return { result: { success: false, message: 'No market selected' }, output: [error('No market selected')] };
  }

  if (args.length < 1) {
    return { result: { success: false, message: 'Usage: claimspotsell <sellId>' }, output: [error('Usage: claimspotsell <sellId>')] };
  }

  const sellId = BigInt(args[0]);

  try {
    const hash = await config.walletClient.writeContract({
      address: config.contracts.TickBookPoolManager,
      abi: ABIS.TickBookPoolManager,
      functionName: 'claimSpotSellProceeds',
      args: [marketKey, sellId],
    });

    await config.publicClient.waitForTransactionReceipt({ hash });

    return { result: { success: true, txHash: hash }, output: [success(`Claimed proceeds from spot sell #${sellId} (tx: ${shortTx(hash)})`)] };
  } catch (err) {
    return { result: { success: false, message: (err as Error).message }, output: [error(`Claim failed: ${(err as Error).message.slice(0, 60)}`)] };
  }
}

export const orderbookCommands = { 
  order, 
  cancel, 
  claim, 
  marketOrder,
  orders,
  getorder,
  spotsell,
  cancelspotsell,
  spotsells,
  claimspotsell,
};
