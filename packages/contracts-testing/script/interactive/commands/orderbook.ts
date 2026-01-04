/**
 * Orderbook Commands
 * order, cancel, claim, market, orders
 */

import type { CommandContext, CommandResult } from './types';
import { ABIS, WAD } from '../config';
import {
  formatWad,
  parseWad,
  parseTickRange,
  parseOutcome,
  formatOutcome,
  formatTick,
  shortTx,
  Spinner,
  success,
  error,
  dim,
  bold,
  info,
  printTable,
} from '../utils';

/**
 * Place an order (V9.9.6-fix9l Range Order API)
 * Usage: order <outcome> <tickRange> <shares> [maxCost]
 * Example: order yes 40-60 100
 *          order yes 50 100        (limit order at tick 50)
 *          order yes 1-999 100     (market order - fill everything)
 */
export async function order(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  const { actorManager, deployment, marketKey } = ctx;
  const walletClient = actorManager.currentWalletClient();
  const publicClient = actorManager.getPublicClient();

  if (!walletClient) {
    return { success: false, message: 'No actor selected' };
  }

  if (!marketKey) {
    return { success: false, message: 'No market selected. Use: setmarket <address>' };
  }

  if (args.length < 3) {
    return { success: false, message: 'Usage: order <outcome> <tickRange> <shares> [maxCost]\n  Example: order yes 40-60 100' };
  }

  const outcome = parseOutcome(args[0]);
  const { tickLower, tickUpper } = parseTickRange(args[1]);
  const shares = parseWad(args[2]);
  // Default maxCost: shares * 2 (200% of notional, very generous slippage)
  const maxCost = args[3] ? parseWad(args[3]) : shares * 2n;

  const orderType = tickLower === tickUpper ? 'limit' : (tickLower === 1 && tickUpper === 999) ? 'market' : 'range';
  const spinner = new Spinner(`Placing ${orderType} ${formatOutcome(outcome)} order at ${formatTick(tickLower)}-${formatTick(tickUpper)} for ${formatWad(shares)} shares...`);
  spinner.start();

  try {
    // placeOrder(marketKey, outcome, shares, tickLower, tickUpper, maxCost)
    const hash = await walletClient.writeContract({
      address: deployment.contracts.TickBookPoolManager as `0x${string}`,
      abi: ABIS.TickBookPoolManager,
      functionName: 'placeOrder',
      args: [marketKey, outcome, shares, tickLower, tickUpper, maxCost],
    });

    const receipt = await actorManager.waitForTransactionReceipt(hash);

    // Parse return values from logs if needed (simplified for now)
    spinner.succeed(`Placed ${orderType} ${formatOutcome(outcome)} order at ${formatTick(tickLower)}-${formatTick(tickUpper)} for ${formatWad(shares)} shares ${dim(`(tx: ${shortTx(hash)})`)}`);

    return { success: true, txHash: hash };
  } catch (err) {
    spinner.fail(`Order failed: ${(err as Error).message.slice(0, 60)}`);
    return { success: false, message: (err as Error).message };
  }
}

/**
 * Cancel an order
 * Usage: cancel <orderId>
 */
export async function cancel(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  const { actorManager, deployment, marketKey } = ctx;
  const walletClient = actorManager.currentWalletClient();
  const publicClient = actorManager.getPublicClient();

  if (!walletClient) {
    return { success: false, message: 'No actor selected' };
  }

  if (!marketKey) {
    return { success: false, message: 'No market selected' };
  }

  if (args.length < 1) {
    return { success: false, message: 'Usage: cancel <orderId>' };
  }

  const orderId = BigInt(args[0]);
  const spinner = new Spinner(`Cancelling order #${orderId}...`);
  spinner.start();

  try {
    const hash = await walletClient.writeContract({
      address: deployment.contracts.TickBookPoolManager as `0x${string}`,
      abi: ABIS.TickBookPoolManager,
      functionName: 'cancelOrder',
      args: [marketKey, orderId],
    });

    const receipt = await actorManager.waitForTransactionReceipt(hash);
    spinner.succeed(`Cancelled order #${orderId} ${dim(`(tx: ${shortTx(hash)})`)}`);

    return { success: true, txHash: hash };
  } catch (err) {
    spinner.fail(`Cancel failed: ${(err as Error).message.slice(0, 50)}`);
    return { success: false, message: (err as Error).message };
  }
}

/**
 * Claim fills on an order
 * Usage: claim <orderId>
 */
export async function claim(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  const { actorManager, deployment, marketKey } = ctx;
  const walletClient = actorManager.currentWalletClient();
  const publicClient = actorManager.getPublicClient();

  if (!walletClient) {
    return { success: false, message: 'No actor selected' };
  }

  if (!marketKey) {
    return { success: false, message: 'No market selected' };
  }

  if (args.length < 1) {
    return { success: false, message: 'Usage: claim <orderId>' };
  }

  const orderId = BigInt(args[0]);
  const spinner = new Spinner(`Claiming fills for order #${orderId}...`);
  spinner.start();

  try {
    const hash = await walletClient.writeContract({
      address: deployment.contracts.TickBookPoolManager as `0x${string}`,
      abi: ABIS.TickBookPoolManager,
      functionName: 'claimFills',
      args: [marketKey, orderId],
    });

    const receipt = await actorManager.waitForTransactionReceipt(hash);
    spinner.succeed(`Claimed fills for order #${orderId} ${dim(`(tx: ${shortTx(hash)})`)}`);

    return { success: true, txHash: hash };
  } catch (err) {
    spinner.fail(`Claim failed: ${(err as Error).message.slice(0, 50)}`);
    return { success: false, message: (err as Error).message };
  }
}

/**
 * Execute a market order (V9.9.6-fix9l Range Order API)
 * Usage: market buy|sell <outcome> <shares> [maxCost]
 * Example: market buy no 50
 *
 * Market orders use placeRangeOrder with tickLower=1, tickUpper=999
 */
export async function market(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  const { actorManager, deployment, marketKey } = ctx;
  const walletClient = actorManager.currentWalletClient();
  const publicClient = actorManager.getPublicClient();

  if (!walletClient) {
    return { success: false, message: 'No actor selected' };
  }

  if (!marketKey) {
    return { success: false, message: 'No market selected' };
  }

  if (args.length < 3) {
    return { success: false, message: 'Usage: market buy|sell <outcome> <shares> [maxCost]\n  Example: market buy no 50' };
  }

  const side = args[0].toLowerCase();
  if (side !== 'buy' && side !== 'sell') {
    return { success: false, message: 'Side must be "buy" or "sell"' };
  }

  const outcome = parseOutcome(args[1]);
  const shares = parseWad(args[2]);
  const maxCost = args[3] ? parseWad(args[3]) : shares * 2n; // Default: 2x shares as max cost

  const action = side === 'buy' ? 'Buying' : 'Selling';
  const spinner = new Spinner(`${action} ${formatWad(shares)} ${formatOutcome(outcome)} shares (market order)...`);
  spinner.start();

  try {
    // Market orders use placeOrder with full tick range (1-999)
    // This will cross all available liquidity
    const tickLower = 1;
    const tickUpper = 999;

    const hash = await walletClient.writeContract({
      address: deployment.contracts.TickBookPoolManager as `0x${string}`,
      abi: ABIS.TickBookPoolManager,
      functionName: 'placeOrder',
      args: [marketKey, outcome, shares, tickLower, tickUpper, maxCost],
    });

    const receipt = await actorManager.waitForTransactionReceipt(hash);
    spinner.succeed(`${side === 'buy' ? 'Bought' : 'Sold'} ${formatWad(shares)} ${formatOutcome(outcome)} shares (market) ${dim(`(tx: ${shortTx(hash)})`)}`);

    return { success: true, txHash: hash };
  } catch (err) {
    spinner.fail(`Market order failed: ${(err as Error).message.slice(0, 50)}`);
    return { success: false, message: (err as Error).message };
  }
}

/**
 * List my orders
 * Usage: orders [actor]
 */
export async function orders(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  const { actorManager, deployment, marketKey } = ctx;
  const publicClient = actorManager.getPublicClient();

  if (!marketKey) {
    return { success: false, message: 'No market selected' };
  }

  // Determine which actor's orders to show
  let address: `0x${string}` | null = null;
  let actorName = 'current actor';

  if (args.length > 0) {
    const actor = actorManager.getActor(args[0]);
    if (actor) {
      address = actor.account.address;
      actorName = actor.name;
    } else {
      // Maybe it's an address
      if (args[0].startsWith('0x') && args[0].length === 42) {
        address = args[0] as `0x${string}`;
        actorName = args[0].slice(0, 10) + '...';
      } else {
        return { success: false, message: `Unknown actor: ${args[0]}` };
      }
    }
  } else {
    address = actorManager.currentAddress();
    const currentActor = actorManager.currentActor();
    if (currentActor) actorName = currentActor.name;
  }

  if (!address) {
    return { success: false, message: 'No actor selected' };
  }

  try {
    const orderIds = await publicClient.readContract({
      address: deployment.contracts.TickBookPoolManager as `0x${string}`,
      abi: ABIS.TickBookPoolManager,
      functionName: 'getUserOrders',
      args: [marketKey, address],
    }) as bigint[];

    if (orderIds.length === 0) {
      console.log(`\n  No orders for ${actorName}\n`);
      return { success: true };
    }

    console.log(`\n  ${bold('Orders')} for ${info(actorName)}`);
    console.log('  ' + '─'.repeat(70));

    const rows: string[][] = [];

    for (const orderId of orderIds) {
      try {
        const order = await publicClient.readContract({
          address: deployment.contracts.TickBookPoolManager as `0x${string}`,
          abi: ABIS.TickBookPoolManager,
          functionName: 'getOrder',
          args: [marketKey, orderId],
        }) as any;

        const status = order.active ? success('ACTIVE') : dim('INACTIVE');
        const filled = `${formatWad(order.filledShares)}/${formatWad(order.sharesTotal)}`;
        const range = `${formatTick(order.tickLower)}-${formatTick(order.tickUpper)}`;

        rows.push([
          `#${orderId.toString()}`,
          formatOutcome(order.outcome),
          range,
          filled,
          formatWad(order.collateralDepositedWad) + ' USDC',
          status,
        ]);
      } catch {
        rows.push([`#${orderId.toString()}`, '?', '?', '?', '?', dim('ERROR')]);
      }
    }

    printTable(
      ['ID', 'Side', 'Range', 'Filled', 'Collateral', 'Status'],
      rows,
      [6, 4, 12, 16, 14, 8]
    );

    console.log('');
    return { success: true };
  } catch (err) {
    return { success: false, message: `Failed to fetch orders: ${(err as Error).message}` };
  }
}

/**
 * Get order details
 * Usage: getorder <orderId>
 */
export async function getorder(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  const { actorManager, deployment, marketKey } = ctx;
  const publicClient = actorManager.getPublicClient();

  if (!marketKey) {
    return { success: false, message: 'No market selected' };
  }

  if (args.length < 1) {
    return { success: false, message: 'Usage: getorder <orderId>' };
  }

  const orderId = BigInt(args[0]);

  try {
    const order = await publicClient.readContract({
      address: deployment.contracts.TickBookPoolManager as `0x${string}`,
      abi: ABIS.TickBookPoolManager,
      functionName: 'getOrder',
      args: [marketKey, orderId],
    }) as any;

    console.log(`\n  ${bold(`Order #${orderId}`)}`);
    console.log('  ' + '─'.repeat(40));
    console.log(`  Owner:      ${order.owner}`);
    console.log(`  Outcome:    ${formatOutcome(order.outcome)}`);
    console.log(`  Range:      ${formatTick(order.tickLower)} - ${formatTick(order.tickUpper)}`);
    console.log(`  Shares:     ${formatWad(order.sharesTotal)}`);
    console.log(`  Filled:     ${formatWad(order.filledShares)}`);
    console.log(`  Collateral: ${formatWad(order.collateralDepositedWad)} USDC`);
    console.log(`  Active:     ${order.active ? success('YES') : dim('NO')}`);
    console.log(`  Liq Removed: ${order.liquidityRemoved ? 'YES' : 'NO'}`);
    console.log('');

    return { success: true };
  } catch (err) {
    return { success: false, message: `Failed to get order: ${(err as Error).message}` };
  }
}

export const orderbookCommands = {
  order,
  cancel,
  claim,
  market,
  orders,
  getorder,
};
