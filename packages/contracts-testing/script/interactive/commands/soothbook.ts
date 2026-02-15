import { keccak256, stringToHex } from 'viem';
import type { CommandContext, CommandResult } from './types';
import { ABIS } from '../config';
import {
  bold,
  dim,
  formatWad,
  info,
  parseWad,
  printTable,
  readContractWithRpcFallback,
  shortAddress,
  success,
  warn,
} from '../utils';

function requireSoothBook(ctx: CommandContext): `0x${string}` | null {
  const soothBook = ctx.deployment.contracts.SoothBook;
  return soothBook ? (soothBook as `0x${string}`) : null;
}

function requireMarketKey(ctx: CommandContext): `0x${string}` | null {
  return ctx.marketKey;
}

function parseTickValue(input: string): number {
  const tick = Number.parseInt(input, 10);
  if (!Number.isInteger(tick) || tick < 0 || tick > 65535) {
    throw new Error(`Invalid tick: ${input}`);
  }
  return tick;
}

function parseEscrow(input?: string): boolean {
  if (!input) return false;
  const normalized = input.toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'y';
}

function parseSide(input: string): number {
  const normalized = input.toLowerCase();
  if (normalized === 'yes' || normalized === '1') return 1;
  if (normalized === 'no' || normalized === '0') return 0;
  throw new Error(`Invalid side: ${input}. Use yes|no`);
}

function parseOutcome(input: string): number {
  const normalized = input.toLowerCase();
  if (normalized === 'no' || normalized === '0') return 0;
  if (normalized === 'yes' || normalized === '1') return 1;
  if (normalized === 'invalid' || normalized === '2') return 2;
  throw new Error(`Invalid outcome: ${input}. Use no|yes|invalid`);
}

function outcomeLabel(outcome: number): string {
  if (outcome === 0) return 'NO';
  if (outcome === 1) return 'YES';
  if (outcome === 2) return 'INVALID';
  return `UNKNOWN(${outcome})`;
}

async function waitForTx(
  ctx: CommandContext,
  hash: `0x${string}`,
): Promise<void> {
  const publicClient = ctx.actorManager.getPublicClient();
  await publicClient.waitForTransactionReceipt({
    hash,
    confirmations: ctx.config.confirmations,
  });
}

export async function buyyes(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  if (args.length < 2) {
    return { success: false, message: 'Usage: buyyes <tick> <amount> [escrow] [maxcost]' };
  }

  const deployment = ctx.deployment;
  const marketKey = requireMarketKey(ctx);
  const soothBook = requireSoothBook(ctx);
  const walletClient = ctx.actorManager.currentWalletClient();

  if (!walletClient) return { success: false, message: 'No actor selected' };
  if (!marketKey) return { success: false, message: 'No market selected. Use: setmarket <key>' };
  if (!soothBook) return { success: false, message: 'SoothBook address not found in deployment' };

  try {
    const tick = parseTickValue(args[0]);
    const amount = parseWad(args[1]);
    const escrow = parseEscrow(args[2]);
    const maxCost = args[3] ? parseWad(args[3]) : 0n;

    const hash = await walletClient.writeContract({
      address: deployment.contracts.SoothBook as `0x${string}`,
      abi: ABIS.SoothBook,
      functionName: 'buyYes',
      args: [marketKey, tick, amount, escrow, maxCost],
    });
    await waitForTx(ctx, hash);

    console.log(success(`  ✓ Placed YES order at ${tick / 10}% for ${formatWad(amount)} shares`));
    return { success: true, txHash: hash };
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}

export async function buyno(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  if (args.length < 2) {
    return { success: false, message: 'Usage: buyno <tick> <amount> [escrow] [maxcost]' };
  }

  const deployment = ctx.deployment;
  const marketKey = requireMarketKey(ctx);
  const soothBook = requireSoothBook(ctx);
  const walletClient = ctx.actorManager.currentWalletClient();

  if (!walletClient) return { success: false, message: 'No actor selected' };
  if (!marketKey) return { success: false, message: 'No market selected. Use: setmarket <key>' };
  if (!soothBook) return { success: false, message: 'SoothBook address not found in deployment' };

  try {
    const tick = parseTickValue(args[0]);
    const amount = parseWad(args[1]);
    const escrow = parseEscrow(args[2]);
    const maxCost = args[3] ? parseWad(args[3]) : 0n;

    const hash = await walletClient.writeContract({
      address: deployment.contracts.SoothBook as `0x${string}`,
      abi: ABIS.SoothBook,
      functionName: 'buyNo',
      args: [marketKey, tick, amount, escrow, maxCost],
    });
    await waitForTx(ctx, hash);

    console.log(success(`  ✓ Placed NO order at ${tick / 10}% for ${formatWad(amount)} shares`));
    return { success: true, txHash: hash };
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}

export async function mint(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  if (args.length < 1) {
    return { success: false, message: 'Usage: mint <amount>' };
  }

  const marketKey = requireMarketKey(ctx);
  const soothBook = requireSoothBook(ctx);
  const walletClient = ctx.actorManager.currentWalletClient();

  if (!walletClient) return { success: false, message: 'No actor selected' };
  if (!marketKey) return { success: false, message: 'No market selected. Use: setmarket <key>' };
  if (!soothBook) return { success: false, message: 'SoothBook address not found in deployment' };

  try {
    const amount = parseWad(args[0]);
    const hash = await walletClient.writeContract({
      address: soothBook,
      abi: ABIS.SoothBook,
      functionName: 'mint',
      args: [marketKey, amount],
    });
    await waitForTx(ctx, hash);

    console.log(success(`  ✓ Minted ${formatWad(amount)} complete sets (YES+NO)`));
    return { success: true, txHash: hash };
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}

export async function merge(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  if (args.length < 1) {
    return { success: false, message: 'Usage: merge <amount>' };
  }

  const marketKey = requireMarketKey(ctx);
  const soothBook = requireSoothBook(ctx);
  const walletClient = ctx.actorManager.currentWalletClient();

  if (!walletClient) return { success: false, message: 'No actor selected' };
  if (!marketKey) return { success: false, message: 'No market selected. Use: setmarket <key>' };
  if (!soothBook) return { success: false, message: 'SoothBook address not found in deployment' };

  try {
    const amount = parseWad(args[0]);
    const hash = await walletClient.writeContract({
      address: soothBook,
      abi: ABIS.SoothBook,
      functionName: 'merge',
      args: [marketKey, amount],
    });
    await waitForTx(ctx, hash);

    console.log(success(`  ✓ Merged ${formatWad(amount)} sets -> USDC returned`));
    return { success: true, txHash: hash };
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}

export async function cancel(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  if (args.length < 2) {
    return { success: false, message: 'Usage: cancel <side> <tick>' };
  }

  const marketKey = requireMarketKey(ctx);
  const soothBook = requireSoothBook(ctx);
  const walletClient = ctx.actorManager.currentWalletClient();

  if (!walletClient) return { success: false, message: 'No actor selected' };
  if (!marketKey) return { success: false, message: 'No market selected. Use: setmarket <key>' };
  if (!soothBook) return { success: false, message: 'SoothBook address not found in deployment' };

  try {
    const side = parseSide(args[0]);
    const tick = parseTickValue(args[1]);
    const hash = await walletClient.writeContract({
      address: soothBook,
      abi: ABIS.SoothBook,
      functionName: 'cancel',
      args: [marketKey, side, tick],
    });
    await waitForTx(ctx, hash);

    const sideText = side === 1 ? 'YES' : 'NO';
    console.log(success(`  ✓ Cancelled order at ${sideText} tick ${tick}`));
    return { success: true, txHash: hash };
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}

export async function redeem(ctx: CommandContext, _args: string[]): Promise<CommandResult> {
  const marketKey = requireMarketKey(ctx);
  const soothBook = requireSoothBook(ctx);
  const walletClient = ctx.actorManager.currentWalletClient();

  if (!walletClient) return { success: false, message: 'No actor selected' };
  if (!marketKey) return { success: false, message: 'No market selected. Use: setmarket <key>' };
  if (!soothBook) return { success: false, message: 'SoothBook address not found in deployment' };

  try {
    const hash = await walletClient.writeContract({
      address: soothBook,
      abi: ABIS.SoothBook,
      functionName: 'redeem',
      args: [marketKey],
    });
    await waitForTx(ctx, hash);

    console.log(success('  ✓ Redeemed winning tokens'));
    return { success: true, txHash: hash };
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}

export async function resolve(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  if (args.length < 1) {
    return { success: false, message: 'Usage: resolve <outcome>' };
  }

  const marketKey = requireMarketKey(ctx);
  const soothBook = requireSoothBook(ctx);
  const walletClient = ctx.actorManager.currentWalletClient();

  if (!walletClient) return { success: false, message: 'No actor selected' };
  if (!marketKey) return { success: false, message: 'No market selected. Use: setmarket <key>' };
  if (!soothBook) return { success: false, message: 'SoothBook address not found in deployment' };

  try {
    const outcome = parseOutcome(args[0]);
    const hash = await walletClient.writeContract({
      address: soothBook,
      abi: ABIS.SoothBook,
      functionName: 'resolveMarket',
      args: [marketKey, outcome],
    });
    await waitForTx(ctx, hash);

    console.log(success(`  ✓ Market resolved: ${outcomeLabel(outcome)}`));
    return { success: true, txHash: hash };
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}

export async function book(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  const marketKey = requireMarketKey(ctx);
  const soothBook = requireSoothBook(ctx);
  if (!marketKey) return { success: false, message: 'No market selected. Use: setmarket <key>' };
  if (!soothBook) return { success: false, message: 'SoothBook address not found in deployment' };

  try {
    const center = args[0] ? Math.max(0, Math.min(65535, Number.parseInt(args[0], 10) || 500)) : 500;
    const window = args[1] ? Math.max(1, Math.min(200, Number.parseInt(args[1], 10) || 10)) : 10;
    const start = Math.max(0, center - window);
    const end = center + window;

    const [bestYesTick, bestNoTick, implied] = await Promise.all([
      readContractWithRpcFallback<number>(ctx.config.chain, ctx.config.rpc, {
        address: soothBook,
        abi: ABIS.SoothBook,
        functionName: 'getBestTick',
        args: [marketKey, 1],
      }),
      readContractWithRpcFallback<number>(ctx.config.chain, ctx.config.rpc, {
        address: soothBook,
        abi: ABIS.SoothBook,
        functionName: 'getBestTick',
        args: [marketKey, 0],
      }),
      readContractWithRpcFallback<readonly [bigint, bigint]>(ctx.config.chain, ctx.config.rpc, {
        address: soothBook,
        abi: ABIS.SoothBook,
        functionName: 'getImpliedPrice',
        args: [marketKey],
      }),
    ]);

    console.log(`\n  ${bold('SoothBook')} ${dim(`[center=${center}, window=${window}]`)}`);
    console.log(`  Best YES Tick: ${info(String(bestYesTick))} | Best NO Tick: ${warn(String(bestNoTick))}`);
    console.log(`  Implied Price: YES ${(Number(implied[0]) / 1e16).toFixed(2)}% | NO ${(Number(implied[1]) / 1e16).toFixed(2)}%`);
    console.log('');

    const rows: string[][] = [];
    for (let tick = start; tick <= end; tick++) {
      const [yesAtTick, noAtTick] = await Promise.all([
        readContractWithRpcFallback<readonly [bigint, bigint]>(ctx.config.chain, ctx.config.rpc, {
          address: soothBook,
          abi: ABIS.SoothBook,
          functionName: 'getOrdersAtTick',
          args: [marketKey, 1, tick],
        }),
        readContractWithRpcFallback<readonly [bigint, bigint]>(ctx.config.chain, ctx.config.rpc, {
          address: soothBook,
          abi: ABIS.SoothBook,
          functionName: 'getOrdersAtTick',
          args: [marketKey, 0, tick],
        }),
      ]);

      const hasLiquidity = yesAtTick[0] > 0n || noAtTick[0] > 0n || yesAtTick[1] > 0n || noAtTick[1] > 0n;
      const tickLabel = hasLiquidity ? success(`*${tick}`) : `${tick}`;
      rows.push([
        tickLabel,
        yesAtTick[1].toString(),
        formatWad(yesAtTick[0]),
        noAtTick[1].toString(),
        formatWad(noAtTick[0]),
      ]);
    }

    printTable(['TICK', 'YES orders', 'YES amount', 'NO orders', 'NO amount'], rows, [8, 12, 14, 12, 14]);
    console.log('');

    return { success: true };
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}

export async function state(ctx: CommandContext, _args: string[]): Promise<CommandResult> {
  const marketKey = requireMarketKey(ctx);
  const soothBook = requireSoothBook(ctx);
  if (!marketKey) return { success: false, message: 'No market selected. Use: setmarket <key>' };
  if (!soothBook) return { success: false, message: 'SoothBook address not found in deployment' };

  try {
    const [marketInfo, collateralBacking, bestNoTick, bestYesTick, impliedPrice] = await Promise.all([
      readContractWithRpcFallback<readonly [`0x${string}`, `0x${string}`, `0x${string}`, boolean, boolean, number]>(
        ctx.config.chain,
        ctx.config.rpc,
        {
          address: soothBook,
          abi: ABIS.SoothBook,
          functionName: 'markets',
          args: [marketKey],
        },
      ),
      readContractWithRpcFallback<bigint>(ctx.config.chain, ctx.config.rpc, {
        address: soothBook,
        abi: ABIS.SoothBook,
        functionName: 'getCollateralBacking',
        args: [marketKey],
      }),
      readContractWithRpcFallback<number>(ctx.config.chain, ctx.config.rpc, {
        address: soothBook,
        abi: ABIS.SoothBook,
        functionName: 'getBestTick',
        args: [marketKey, 0],
      }),
      readContractWithRpcFallback<number>(ctx.config.chain, ctx.config.rpc, {
        address: soothBook,
        abi: ABIS.SoothBook,
        functionName: 'getBestTick',
        args: [marketKey, 1],
      }),
      readContractWithRpcFallback<readonly [bigint, bigint]>(ctx.config.chain, ctx.config.rpc, {
        address: soothBook,
        abi: ABIS.SoothBook,
        functionName: 'getImpliedPrice',
        args: [marketKey],
      }),
    ]);

    const [collateral, yesToken, noToken, active, finalized, outcome] = marketInfo;
    console.log(`\n  ${bold('Market State')}`);
    console.log('  ' + '-'.repeat(56));
    console.log(`  Market Key:      ${marketKey}`);
    console.log(`  Collateral:      ${shortAddress(collateral)}`);
    console.log(`  YES Token:       ${shortAddress(yesToken)}`);
    console.log(`  NO Token:        ${shortAddress(noToken)}`);
    console.log(`  Active:          ${active ? success('true') : warn('false')}`);
    console.log(`  Finalized:       ${finalized ? success('true') : dim('false')}`);
    console.log(`  Outcome:         ${outcomeLabel(outcome)}`);
    console.log(`  Collateral Back: ${formatWad(collateralBacking)} USDC`);
    console.log(`  Best YES Tick:   ${bestYesTick}`);
    console.log(`  Best NO Tick:    ${bestNoTick}`);
    console.log(`  Implied Price:   YES ${(Number(impliedPrice[0]) / 1e16).toFixed(2)}% | NO ${(Number(impliedPrice[1]) / 1e16).toFixed(2)}%`);
    console.log('');

    return { success: true };
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}

export async function positions(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  const marketKey = requireMarketKey(ctx);
  const soothBook = requireSoothBook(ctx);

  if (!marketKey) return { success: false, message: 'No market selected. Use: setmarket <key>' };
  if (!soothBook) return { success: false, message: 'SoothBook address not found in deployment' };

  try {
    let targets = ctx.actorManager.listActors().map(actor => ({
      name: actor.name,
      address: actor.account.address,
    }));
    if (args.length > 0) {
      const actor = ctx.actorManager.getActor(args[0]);
      if (actor) {
        targets = [{ name: actor.name, address: actor.account.address }];
      } else if (args[0].startsWith('0x') && args[0].length === 42) {
        const addr = args[0] as `0x${string}`;
        targets = [{ name: shortAddress(addr), address: addr }];
      } else {
        return { success: false, message: `Unknown actor/address: ${args[0]}` };
      }
    }

    if (targets.length === 0) {
      return { success: false, message: 'No actors loaded' };
    }

    const rows: string[][] = [];
    for (const actor of targets) {
      const address = actor.address;
      const [position, walletUsdc] = await Promise.all([
        readContractWithRpcFallback<readonly [bigint, bigint]>(ctx.config.chain, ctx.config.rpc, {
          address: soothBook,
          abi: ABIS.SoothBook,
          functionName: 'getBalance',
          args: [marketKey, address],
        }),
        readContractWithRpcFallback<bigint>(ctx.config.chain, ctx.config.rpc, {
          address: ctx.deployment.contracts.MockUSDC as `0x${string}`,
          abi: ABIS.MockUSDC,
          functionName: 'balanceOf',
          args: [address],
        }),
      ]);

      rows.push([
        actor.name,
        shortAddress(address),
        formatWad(walletUsdc),
        formatWad(position[0]),
        formatWad(position[1]),
      ]);
    }

    console.log(`\n  ${bold('Positions')}`);
    printTable(['Actor', 'Address', 'USDC', 'YES', 'NO'], rows, [12, 14, 12, 12, 12]);
    console.log('');

    return { success: true };
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}

export async function createmarket(ctx: CommandContext, args: string[]): Promise<CommandResult> {
  if (args.length < 1) {
    return { success: false, message: 'Usage: createmarket <name>' };
  }

  const soothBook = requireSoothBook(ctx);
  const walletClient = ctx.actorManager.currentWalletClient();
  if (!walletClient) return { success: false, message: 'No actor selected' };
  if (!soothBook) return { success: false, message: 'SoothBook address not found in deployment' };

  try {
    const name = args.join(' ').trim();
    const marketKey = keccak256(stringToHex(name));
    const hash = await walletClient.writeContract({
      address: soothBook,
      abi: ABIS.SoothBook,
      functionName: 'createMarket',
      args: [marketKey, ctx.deployment.contracts.MockUSDC as `0x${string}`, name],
    });
    await waitForTx(ctx, hash);

    const market = await readContractWithRpcFallback<readonly [`0x${string}`, `0x${string}`, `0x${string}`, boolean, boolean, number]>(
      ctx.config.chain,
      ctx.config.rpc,
      {
        address: soothBook,
        abi: ABIS.SoothBook,
        functionName: 'markets',
        args: [marketKey],
      },
    );

    console.log(success('  ✓ Created market'));
    console.log(`  Name:      ${name}`);
    console.log(`  MarketKey: ${marketKey}`);
    console.log(`  YES Token: ${market[1]}`);
    console.log(`  NO Token:  ${market[2]}`);

    return { success: true, txHash: hash };
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}

export const soothbookCommands: Record<string, (ctx: CommandContext, args: string[]) => Promise<CommandResult>> = {
  buyyes,
  buyno,
  mint,
  merge,
  cancel,
  redeem,
  resolve,
  book,
  state,
  positions,
  createmarket,
};
