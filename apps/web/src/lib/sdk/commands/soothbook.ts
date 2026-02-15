import { encodeFunctionData, type Address } from 'viem';
import type { SDKContext, CommandResult, OutputLine } from '../types';
import { ABIS } from '../../../config/abis';
import { formatWad, parseWad, error, success, plain, info, warn, bold, dim, separator } from '../utils';

const TEST_MARKETS: readonly `0x${string}`[] = [
  '0x79a7bc6308ae7267ddd3776d02ad1446f41d1e3ed74ed41b5184fc53cc8bd5b5',
  '0x51c50fd0e163b78ae31b6b04b87169dee2041aaf0279ecef7d10d0284d4cecb9',
  '0x1e20bd6ecb21252705442f66733ad9bd6b38f4a29acae27f1c95bd2f57eab737',
];

const NO_SIDE = 0;
const YES_SIDE = 1;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

function formatPriceFromTick(tick: number): string {
  return (tick / 1000).toFixed(3);
}

function formatOutcome(outcome: number): string {
  if (outcome === 0) return 'NO';
  if (outcome === 1) return 'YES';
  if (outcome === 2) return 'INVALID';
  return `UNKNOWN(${outcome})`;
}

function parseTick(tickArg: string): number {
  const tick = Number.parseInt(tickArg, 10);
  if (!Number.isFinite(tick) || tick < 1 || tick > 999) {
    throw new Error('Tick must be an integer between 1 and 999');
  }
  return tick;
}

function parseSide(sideArg: string): number {
  const side = sideArg.toLowerCase();
  if (side === 'yes') return YES_SIDE;
  if (side === 'no') return NO_SIDE;
  throw new Error('Side must be yes or no');
}

function parseEscrow(escrowArg?: string): boolean {
  if (!escrowArg) return false;
  const value = escrowArg.toLowerCase();
  return value === 'true' || value === 'escrow' || value === '1';
}

function parseOptionalMaxCost(maxCostArg?: string): bigint {
  if (!maxCostArg) return 0n;
  return parseWad(maxCostArg);
}

function parseMarketKeyInput(arg: string): `0x${string}` {
  if (arg.startsWith('0x')) {
    if (arg.length !== 66) {
      throw new Error('Market key must be a 32-byte hex string');
    }
    return arg as `0x${string}`;
  }

  const index = Number.parseInt(arg, 10);
  if (!Number.isFinite(index) || index < 0 || index >= TEST_MARKETS.length) {
    throw new Error(`Market index out of range (0-${TEST_MARKETS.length - 1})`);
  }
  return TEST_MARKETS[index];
}

async function readMarket(ctx: SDKContext, soothBook: Address, marketKey: `0x${string}`) {
  const { config } = ctx;
  return config.publicClient.readContract({
    address: soothBook,
    abi: ABIS.SoothBook,
    functionName: 'markets',
    args: [marketKey],
  }) as Promise<[Address, Address, Address, boolean, boolean, number]>;
}

export async function buyyes(ctx: SDKContext, args: string[]): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, address, marketKey } = ctx;
  if (!address || !config.walletClient) {
    return { result: { success: false, message: 'No wallet connected' }, output: [error('No wallet connected')] };
  }
  const soothBook = config.contracts.SoothBook;
  if (!soothBook) {
    return { result: { success: false, message: 'SoothBook not configured' }, output: [error('SoothBook not available on this chain')] };
  }
  if (!marketKey) {
    return { result: { success: false, message: 'No market selected' }, output: [error('No market selected. Use: sbsetmarket <key>')] };
  }
  if (args.length < 2) {
    return { result: { success: false, message: 'Usage: buyyes <tick> <amount> [escrow] [maxCost]' }, output: [error('Usage: buyyes <tick> <amount> [escrow] [maxCost]')] };
  }

  try {
    const tick = parseTick(args[0]);
    const amount = parseWad(args[1]);
    const escrow = parseEscrow(args[2]);
    const maxCost = parseOptionalMaxCost(args[3]);

    const hash = await config.walletClient.sendTransaction({
      account: address,
      to: soothBook,
      data: encodeFunctionData({
        abi: ABIS.SoothBook,
        functionName: 'buyYes',
        args: [marketKey, tick, amount, escrow, maxCost],
      }),
      chain: null,
    } as Parameters<typeof config.walletClient.sendTransaction>[0]);

    await config.publicClient.waitForTransactionReceipt({ hash });

    return {
      result: { success: true, txHash: hash },
      output: [success(`Bought YES at tick ${tick} (${formatPriceFromTick(tick)}) for ${formatWad(amount)} (escrow=${escrow ? 'yes' : 'no'})`)],
    };
  } catch (err) {
    return { result: { success: false, message: (err as Error).message }, output: [error(`buyyes failed: ${(err as Error).message}`)] };
  }
}

export async function buyno(ctx: SDKContext, args: string[]): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, address, marketKey } = ctx;
  if (!address || !config.walletClient) {
    return { result: { success: false, message: 'No wallet connected' }, output: [error('No wallet connected')] };
  }
  const soothBook = config.contracts.SoothBook;
  if (!soothBook) {
    return { result: { success: false, message: 'SoothBook not configured' }, output: [error('SoothBook not available on this chain')] };
  }
  if (!marketKey) {
    return { result: { success: false, message: 'No market selected' }, output: [error('No market selected. Use: sbsetmarket <key>')] };
  }
  if (args.length < 2) {
    return { result: { success: false, message: 'Usage: buyno <tick> <amount> [escrow] [maxCost]' }, output: [error('Usage: buyno <tick> <amount> [escrow] [maxCost]')] };
  }

  try {
    const tick = parseTick(args[0]);
    const amount = parseWad(args[1]);
    const escrow = parseEscrow(args[2]);
    const maxCost = parseOptionalMaxCost(args[3]);

    const hash = await config.walletClient.sendTransaction({
      account: address,
      to: soothBook,
      data: encodeFunctionData({
        abi: ABIS.SoothBook,
        functionName: 'buyNo',
        args: [marketKey, tick, amount, escrow, maxCost],
      }),
      chain: null,
    } as Parameters<typeof config.walletClient.sendTransaction>[0]);

    await config.publicClient.waitForTransactionReceipt({ hash });

    return {
      result: { success: true, txHash: hash },
      output: [success(`Bought NO at tick ${tick} (${formatPriceFromTick(tick)}) for ${formatWad(amount)} (escrow=${escrow ? 'yes' : 'no'})`)],
    };
  } catch (err) {
    return { result: { success: false, message: (err as Error).message }, output: [error(`buyno failed: ${(err as Error).message}`)] };
  }
}

export async function sbmint(ctx: SDKContext, args: string[]): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, address, marketKey } = ctx;
  if (!address || !config.walletClient) {
    return { result: { success: false, message: 'No wallet connected' }, output: [error('No wallet connected')] };
  }
  const soothBook = config.contracts.SoothBook;
  if (!soothBook) {
    return { result: { success: false, message: 'SoothBook not configured' }, output: [error('SoothBook not available on this chain')] };
  }
  if (!marketKey) {
    return { result: { success: false, message: 'No market selected' }, output: [error('No market selected. Use: sbsetmarket <key>')] };
  }
  if (args.length < 1) {
    return { result: { success: false, message: 'Usage: sbmint <amount>' }, output: [error('Usage: sbmint <amount>')] };
  }

  try {
    const amount = parseWad(args[0]);

    const hash = await config.walletClient.sendTransaction({
      account: address,
      to: soothBook,
      data: encodeFunctionData({
        abi: ABIS.SoothBook,
        functionName: 'mint',
        args: [marketKey, amount],
      }),
      chain: null,
    } as Parameters<typeof config.walletClient.sendTransaction>[0]);

    await config.publicClient.waitForTransactionReceipt({ hash });

    return {
      result: { success: true, txHash: hash },
      output: [success(`Minted ${formatWad(amount)} YES+NO sets`)],
    };
  } catch (err) {
    return { result: { success: false, message: (err as Error).message }, output: [error(`sbmint failed: ${(err as Error).message}`)] };
  }
}

export async function sbmerge(ctx: SDKContext, args: string[]): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, address, marketKey } = ctx;
  if (!address || !config.walletClient) {
    return { result: { success: false, message: 'No wallet connected' }, output: [error('No wallet connected')] };
  }
  const soothBook = config.contracts.SoothBook;
  if (!soothBook) {
    return { result: { success: false, message: 'SoothBook not configured' }, output: [error('SoothBook not available on this chain')] };
  }
  if (!marketKey) {
    return { result: { success: false, message: 'No market selected' }, output: [error('No market selected. Use: sbsetmarket <key>')] };
  }
  if (args.length < 1) {
    return { result: { success: false, message: 'Usage: sbmerge <amount>' }, output: [error('Usage: sbmerge <amount>')] };
  }

  try {
    const amount = parseWad(args[0]);

    const hash = await config.walletClient.sendTransaction({
      account: address,
      to: soothBook,
      data: encodeFunctionData({
        abi: ABIS.SoothBook,
        functionName: 'merge',
        args: [marketKey, amount],
      }),
      chain: null,
    } as Parameters<typeof config.walletClient.sendTransaction>[0]);

    await config.publicClient.waitForTransactionReceipt({ hash });

    return {
      result: { success: true, txHash: hash },
      output: [success(`Merged ${formatWad(amount)} YES+NO sets into collateral`)],
    };
  } catch (err) {
    return { result: { success: false, message: (err as Error).message }, output: [error(`sbmerge failed: ${(err as Error).message}`)] };
  }
}

export async function sbcancel(ctx: SDKContext, args: string[]): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, address, marketKey } = ctx;
  if (!address || !config.walletClient) {
    return { result: { success: false, message: 'No wallet connected' }, output: [error('No wallet connected')] };
  }
  const soothBook = config.contracts.SoothBook;
  if (!soothBook) {
    return { result: { success: false, message: 'SoothBook not configured' }, output: [error('SoothBook not available on this chain')] };
  }
  if (!marketKey) {
    return { result: { success: false, message: 'No market selected' }, output: [error('No market selected. Use: sbsetmarket <key>')] };
  }
  if (args.length < 2) {
    return { result: { success: false, message: 'Usage: sbcancel <side> <tick>' }, output: [error('Usage: sbcancel <yes|no> <tick>')] };
  }

  try {
    const side = parseSide(args[0]);
    const tick = parseTick(args[1]);

    const hash = await config.walletClient.sendTransaction({
      account: address,
      to: soothBook,
      data: encodeFunctionData({
        abi: ABIS.SoothBook,
        functionName: 'cancel',
        args: [marketKey, side, tick],
      }),
      chain: null,
    } as Parameters<typeof config.walletClient.sendTransaction>[0]);

    await config.publicClient.waitForTransactionReceipt({ hash });

    return {
      result: { success: true, txHash: hash },
      output: [success(`Cancelled ${side === YES_SIDE ? 'YES' : 'NO'} order at tick ${tick}`)],
    };
  } catch (err) {
    return { result: { success: false, message: (err as Error).message }, output: [error(`sbcancel failed: ${(err as Error).message}`)] };
  }
}

export async function sbredeem(ctx: SDKContext, args: string[]): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, address, marketKey } = ctx;
  if (!address || !config.walletClient) {
    return { result: { success: false, message: 'No wallet connected' }, output: [error('No wallet connected')] };
  }
  const soothBook = config.contracts.SoothBook;
  if (!soothBook) {
    return { result: { success: false, message: 'SoothBook not configured' }, output: [error('SoothBook not available on this chain')] };
  }
  if (!marketKey) {
    return { result: { success: false, message: 'No market selected' }, output: [error('No market selected. Use: sbsetmarket <key>')] };
  }
  if (args.length > 0) {
    return { result: { success: false, message: 'Usage: sbredeem' }, output: [error('Usage: sbredeem')] };
  }

  try {
    const hash = await config.walletClient.sendTransaction({
      account: address,
      to: soothBook,
      data: encodeFunctionData({
        abi: ABIS.SoothBook,
        functionName: 'redeem',
        args: [marketKey],
      }),
      chain: null,
    } as Parameters<typeof config.walletClient.sendTransaction>[0]);

    await config.publicClient.waitForTransactionReceipt({ hash });

    return {
      result: { success: true, txHash: hash },
      output: [success('Redeem submitted')],
    };
  } catch (err) {
    return { result: { success: false, message: (err as Error).message }, output: [error(`sbredeem failed: ${(err as Error).message}`)] };
  }
}

async function scanSideTopTicks(
  ctx: SDKContext,
  soothBook: Address,
  marketKey: `0x${string}`,
  side: number,
  depth = 10
): Promise<Array<{ tick: number; totalAmount: bigint; orderCount: bigint }>> {
  const { config } = ctx;
  const rows: Array<{ tick: number; totalAmount: bigint; orderCount: bigint }> = [];

  let currentTick = await config.publicClient.readContract({
    address: soothBook,
    abi: ABIS.SoothBook,
    functionName: 'getBestTick',
    args: [marketKey, side],
  }) as number;

  if (currentTick < 1 || currentTick > 999) {
    return rows;
  }

  while (currentTick >= 1 && rows.length < depth) {
    const [totalAmount, orderCount] = await config.publicClient.readContract({
      address: soothBook,
      abi: ABIS.SoothBook,
      functionName: 'getOrdersAtTick',
      args: [marketKey, side, currentTick],
    }) as [bigint, bigint];

    if (totalAmount > 0n || orderCount > 0n) {
      rows.push({ tick: currentTick, totalAmount, orderCount });
    }

    currentTick -= 1;
  }

  return rows;
}

export async function sbbook(ctx: SDKContext, args: string[]): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, marketKey } = ctx;
  const soothBook = config.contracts.SoothBook;
  if (!soothBook) {
    return { result: { success: false, message: 'SoothBook not configured' }, output: [error('SoothBook not available on this chain')] };
  }
  if (!marketKey) {
    return { result: { success: false, message: 'No market selected' }, output: [error('No market selected. Use: sbsetmarket <key>')] };
  }
  if (args.length > 0) {
    return { result: { success: false, message: 'Usage: sbbook' }, output: [error('Usage: sbbook')] };
  }

  try {
    const [yesRows, noRows] = await Promise.all([
      scanSideTopTicks(ctx, soothBook, marketKey, YES_SIDE, 10),
      scanSideTopTicks(ctx, soothBook, marketKey, NO_SIDE, 10),
    ]);

    const output: OutputLine[] = [
      plain(''),
      bold('SoothBook Orderbook'),
      separator(76),
      info('YES side (top ticks)'),
      plain('  tick   price    total amount               orders'),
    ];

    if (yesRows.length === 0) {
      output.push(dim('  (no YES orders found)'));
    } else {
      for (const row of yesRows) {
        output.push(plain(`  ${row.tick.toString().padStart(4)}   ${formatPriceFromTick(row.tick).padEnd(5)}    ${formatWad(row.totalAmount).padStart(24)}   ${row.orderCount.toString().padStart(6)}`));
      }
    }

    output.push(plain(''));
    output.push(warn('NO side (top ticks)'));
    output.push(plain('  tick   price    total amount               orders'));

    if (noRows.length === 0) {
      output.push(dim('  (no NO orders found)'));
    } else {
      for (const row of noRows) {
        output.push(plain(`  ${row.tick.toString().padStart(4)}   ${formatPriceFromTick(row.tick).padEnd(5)}    ${formatWad(row.totalAmount).padStart(24)}   ${row.orderCount.toString().padStart(6)}`));
      }
    }

    output.push(plain(''));

    return { result: { success: true, data: { yesRows, noRows } }, output };
  } catch (err) {
    return { result: { success: false, message: (err as Error).message }, output: [error(`sbbook failed: ${(err as Error).message}`)] };
  }
}

export async function sbbalance(ctx: SDKContext, args: string[]): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, address, marketKey } = ctx;
  const soothBook = config.contracts.SoothBook;
  if (!soothBook) {
    return { result: { success: false, message: 'SoothBook not configured' }, output: [error('SoothBook not available on this chain')] };
  }
  if (!marketKey) {
    return { result: { success: false, message: 'No market selected' }, output: [error('No market selected. Use: sbsetmarket <key>')] };
  }
  if (!address) {
    return { result: { success: false, message: 'No wallet connected' }, output: [error('No wallet connected')] };
  }
  if (args.length > 0) {
    return { result: { success: false, message: 'Usage: sbbalance' }, output: [error('Usage: sbbalance')] };
  }

  try {
    const [yes, no] = await config.publicClient.readContract({
      address: soothBook,
      abi: ABIS.SoothBook,
      functionName: 'getBalance',
      args: [marketKey, address],
    }) as [bigint, bigint];

    return {
      result: { success: true, data: { yes, no } },
      output: [
        plain(''),
        bold('SoothBook Balance'),
        separator(50),
        info(`YES: ${formatWad(yes)}`),
        warn(`NO:  ${formatWad(no)}`),
        plain(''),
      ],
    };
  } catch (err) {
    return { result: { success: false, message: (err as Error).message }, output: [error(`sbbalance failed: ${(err as Error).message}`)] };
  }
}

export async function sbstate(ctx: SDKContext, args: string[]): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, marketKey } = ctx;
  const soothBook = config.contracts.SoothBook;
  if (!soothBook) {
    return { result: { success: false, message: 'SoothBook not configured' }, output: [error('SoothBook not available on this chain')] };
  }
  if (!marketKey) {
    return { result: { success: false, message: 'No market selected' }, output: [error('No market selected. Use: sbsetmarket <key>')] };
  }
  if (args.length > 0) {
    return { result: { success: false, message: 'Usage: sbstate' }, output: [error('Usage: sbstate')] };
  }

  try {
    const [market, implied, backing] = await Promise.all([
      config.publicClient.readContract({
        address: soothBook,
        abi: ABIS.SoothBook,
        functionName: 'markets',
        args: [marketKey],
      }) as Promise<[Address, Address, Address, boolean, boolean, number]>,
      config.publicClient.readContract({
        address: soothBook,
        abi: ABIS.SoothBook,
        functionName: 'getImpliedPrice',
        args: [marketKey],
      }) as Promise<[bigint, bigint]>,
      config.publicClient.readContract({
        address: soothBook,
        abi: ABIS.SoothBook,
        functionName: 'getCollateralBacking',
        args: [marketKey],
      }) as Promise<bigint>,
    ]);

    const [collateral, yesToken, noToken, active, finalized, outcome] = market;
    const [yesPrice, noPrice] = implied;

    return {
      result: {
        success: true,
        data: { collateral, yesToken, noToken, active, finalized, outcome, yesPrice, noPrice, backing },
      },
      output: [
        plain(''),
        bold('SoothBook Market State'),
        separator(76),
        plain(`Market Key:  ${marketKey}`),
        plain(`Collateral:  ${collateral}`),
        plain(`YES Token:   ${yesToken}`),
        plain(`NO Token:    ${noToken}`),
        plain(`Active:      ${active ? 'YES' : 'NO'}`),
        plain(`Finalized:   ${finalized ? 'YES' : 'NO'}`),
        plain(`Outcome:     ${formatOutcome(outcome)}`),
        plain(`YES Price:   ${formatWad(yesPrice)}`),
        plain(`NO Price:    ${formatWad(noPrice)}`),
        plain(`Backing:     ${formatWad(backing)}`),
        plain(''),
      ],
    };
  } catch (err) {
    return { result: { success: false, message: (err as Error).message }, output: [error(`sbstate failed: ${(err as Error).message}`)] };
  }
}

export async function sbprice(ctx: SDKContext, args: string[]): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config, marketKey } = ctx;
  const soothBook = config.contracts.SoothBook;
  if (!soothBook) {
    return { result: { success: false, message: 'SoothBook not configured' }, output: [error('SoothBook not available on this chain')] };
  }
  if (!marketKey) {
    return { result: { success: false, message: 'No market selected' }, output: [error('No market selected. Use: sbsetmarket <key>')] };
  }
  if (args.length > 0) {
    return { result: { success: false, message: 'Usage: sbprice' }, output: [error('Usage: sbprice')] };
  }

  try {
    const [yesPrice, noPrice] = await config.publicClient.readContract({
      address: soothBook,
      abi: ABIS.SoothBook,
      functionName: 'getImpliedPrice',
      args: [marketKey],
    }) as [bigint, bigint];

    return {
      result: { success: true, data: { yesPrice, noPrice } },
      output: [
        plain(''),
        bold('SoothBook Implied Price'),
        separator(50),
        info(`YES: ${formatWad(yesPrice)}`),
        warn(`NO:  ${formatWad(noPrice)}`),
        plain(''),
      ],
    };
  } catch (err) {
    return { result: { success: false, message: (err as Error).message }, output: [error(`sbprice failed: ${(err as Error).message}`)] };
  }
}

export async function sbsetmarket(ctx: SDKContext, args: string[]): Promise<{ result: CommandResult; output: OutputLine[] }> {
  const { config } = ctx;
  const soothBook = config.contracts.SoothBook;
  if (!soothBook) {
    return { result: { success: false, message: 'SoothBook not configured' }, output: [error('SoothBook not available on this chain')] };
  }
  if (args.length < 1) {
    return { result: { success: false, message: 'Usage: sbsetmarket <key|index>' }, output: [error('Usage: sbsetmarket <key|index>')] };
  }

  try {
    const marketKey = parseMarketKeyInput(args[0]);
    const [collateral, yesToken, noToken, active, finalized, outcome] = await readMarket(ctx, soothBook, marketKey);

    if (collateral.toLowerCase() === ZERO_ADDRESS) {
      return { result: { success: false, message: 'Market not found' }, output: [error('Market not found in SoothBook')] };
    }

    ctx.marketKey = marketKey;

    return {
      result: { success: true, data: { marketKey, active, finalized, outcome } },
      output: [
        success(`SoothBook market selected: ${marketKey}`),
        plain(`Collateral: ${collateral}`),
        plain(`YES Token:  ${yesToken}`),
        plain(`NO Token:   ${noToken}`),
        plain(`Active:     ${active ? 'YES' : 'NO'}`),
        plain(`Finalized:  ${finalized ? 'YES' : 'NO'}`),
        plain(`Outcome:    ${formatOutcome(outcome)}`),
      ],
    };
  } catch (err) {
    return { result: { success: false, message: (err as Error).message }, output: [error(`sbsetmarket failed: ${(err as Error).message}`)] };
  }
}

export const soothbookCommands = {
  buyyes,
  buyno,
  sbmint,
  sbmerge,
  sbcancel,
  sbredeem,
  sbbook,
  sbbalance,
  sbstate,
  sbprice,
  sbsetmarket,
};
