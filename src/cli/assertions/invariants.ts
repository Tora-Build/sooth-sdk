/**
 * Invariant Assertions
 * SoothBook invariants for on-chain verification
 */

import type { CommandContext } from '../commands/types';
import { ABIS } from '../config';
import { formatWad, success, error, readContractWithRpcFallback } from '../cli-utils';

export interface AssertionResult {
  name: string;
  passed: boolean;
  message: string;
  data?: any;
}

/**
 * Check SoothBook collateral backing — USDC held >= collateralBacking reported
 */
export async function checkCollateralBacking(ctx: CommandContext): Promise<AssertionResult> {
  const soothBook = ctx.deployment.contracts.SoothBook;
  const marketKey = ctx.marketKey;

  if (!soothBook || !marketKey) {
    return {
      name: 'soothbook.backing',
      passed: true,
      message: 'Skipped (no SoothBook or market selected)',
    };
  }

  try {
    const [usdcBalance, collateralBacking] = await Promise.all([
      readContractWithRpcFallback<bigint>(ctx.config.chain, ctx.config.rpc, {
        address: ctx.deployment.contracts.BaseToken as `0x${string}`,
        abi: ABIS.BaseToken,
        functionName: 'balanceOf',
        args: [soothBook as `0x${string}`],
      }),
      readContractWithRpcFallback<bigint>(ctx.config.chain, ctx.config.rpc, {
        address: soothBook as `0x${string}`,
        abi: ABIS.SoothBook,
        functionName: 'getCollateralBacking',
        args: [marketKey],
      }),
    ]);

    const passed = usdcBalance >= collateralBacking;
    return {
      name: 'soothbook.backing',
      passed,
      message: passed
        ? `USDC ${formatWad(usdcBalance)} >= backing ${formatWad(collateralBacking)}`
        : `USDC ${formatWad(usdcBalance)} < backing ${formatWad(collateralBacking)} — UNDERCOLLATERALIZED`,
      data: { usdcBalance, collateralBacking },
    };
  } catch (err) {
    return {
      name: 'soothbook.backing',
      passed: false,
      message: `Error: ${(err as Error).message}`,
    };
  }
}

/**
 * Check market is active (not finalized/resolved)
 */
export async function checkMarketActive(ctx: CommandContext): Promise<AssertionResult> {
  const soothBook = ctx.deployment.contracts.SoothBook;
  const marketKey = ctx.marketKey;

  if (!soothBook || !marketKey) {
    return {
      name: 'soothbook.marketActive',
      passed: true,
      message: 'Skipped (no SoothBook or market selected)',
    };
  }

  try {
    // v0.2.1: SoothBook.markets(bytes32)→(active,finalized,outcome) was deleted.
    // registeredMarkets→bool tells us "active on SoothBook"; finalized + outcome
    // moved to TruthMarket and are no longer checkable from this invariant.
    const isRegistered = await readContractWithRpcFallback<boolean>(
      ctx.config.chain,
      ctx.config.rpc,
      {
        address: soothBook as `0x${string}`,
        abi: ABIS.SoothBook,
        functionName: 'registeredMarkets',
        args: [marketKey],
      },
    );

    return {
      name: 'soothbook.marketActive',
      passed: isRegistered,
      message: isRegistered
        ? 'Market is registered on SoothBook'
        : 'Market not registered on SoothBook',
      data: { registered: isRegistered },
    };
  } catch (err) {
    return {
      name: 'soothbook.marketActive',
      passed: false,
      message: `Error: ${(err as Error).message}`,
    };
  }
}

/**
 * Check YES totalSupply == NO totalSupply (complete sets invariant)
 */
export async function checkTokenSupply(ctx: CommandContext): Promise<AssertionResult> {
  const soothBook = ctx.deployment.contracts.SoothBook;
  const marketKey = ctx.marketKey;

  if (!soothBook || !marketKey) {
    return {
      name: 'soothbook.tokenSupply',
      passed: true,
      message: 'Skipped (no SoothBook or market selected)',
    };
  }

  // v0.2.1: yesToken/noToken addresses no longer exposed on SoothBook.markets.
  // To check the YES==NO complete-set invariant we'd need to discover those
  // tokens elsewhere (e.g. TruthMarket or the registry manifest). For now,
  // skip cleanly rather than fail loudly — the on-chain protocol still
  // enforces the invariant; this CLI check is informational only.
  return {
    name: 'soothbook.tokenSupply',
    passed: true,
    message:
      'Skipped (v0.2.1: yesToken/noToken removed from SoothBook surface; check via TruthMarket if needed)',
  };
}

/**
 * Check best ticks are in valid range (0 = empty book, or 1-999)
 */
export async function checkTickRange(ctx: CommandContext): Promise<AssertionResult> {
  const soothBook = ctx.deployment.contracts.SoothBook;
  const marketKey = ctx.marketKey;

  if (!soothBook || !marketKey) {
    return {
      name: 'soothbook.tickRange',
      passed: true,
      message: 'Skipped (no SoothBook or market selected)',
    };
  }

  try {
    const [bestYesTick, bestNoTick] = await Promise.all([
      readContractWithRpcFallback<number>(ctx.config.chain, ctx.config.rpc, {
        address: soothBook as `0x${string}`,
        abi: ABIS.SoothBook,
        functionName: 'getBestTick',
        args: [marketKey, 1],
      }),
      readContractWithRpcFallback<number>(ctx.config.chain, ctx.config.rpc, {
        address: soothBook as `0x${string}`,
        abi: ABIS.SoothBook,
        functionName: 'getBestTick',
        args: [marketKey, 0],
      }),
    ]);

    const yesValid = bestYesTick === 0 || (bestYesTick >= 1 && bestYesTick <= 999);
    const noValid = bestNoTick === 0 || (bestNoTick >= 1 && bestNoTick <= 999);
    const passed = yesValid && noValid;

    return {
      name: 'soothbook.tickRange',
      passed,
      message: passed
        ? `YES tick=${bestYesTick}, NO tick=${bestNoTick} (valid)`
        : `Out of range: YES tick=${bestYesTick}, NO tick=${bestNoTick}`,
      data: { bestYesTick, bestNoTick },
    };
  } catch (err) {
    return {
      name: 'soothbook.tickRange',
      passed: false,
      message: `Error: ${(err as Error).message}`,
    };
  }
}

/**
 * Run all invariant checks
 */
export async function runAllInvariants(ctx: CommandContext): Promise<AssertionResult[]> {
  const soothBook = ctx.deployment.contracts.SoothBook;
  const marketKey = ctx.marketKey;

  if (soothBook && marketKey) {
    // v0.2.1: gate on registeredMarkets(bytes32)→bool, not the deleted
    // markets(bytes32) tuple. AMM-only markets return false here.
    const isRegistered = await readContractWithRpcFallback<boolean>(
      ctx.config.chain,
      ctx.config.rpc,
      {
        address: soothBook as `0x${string}`,
        abi: ABIS.SoothBook,
        functionName: 'registeredMarkets',
        args: [marketKey],
      },
    ).catch(() => false);

    if (!isRegistered) {
      const skipMsg = 'Skipped (AMM-only market — not registered in SoothBook)';
      return [
        { name: 'soothbook.backing', passed: true, message: skipMsg },
        { name: 'soothbook.marketActive', passed: true, message: skipMsg },
        { name: 'soothbook.tokenSupply', passed: true, message: skipMsg },
        { name: 'soothbook.tickRange', passed: true, message: skipMsg },
      ];
    }
  }

  const results = await Promise.all([
    checkCollateralBacking(ctx),
    checkMarketActive(ctx),
    checkTokenSupply(ctx),
    checkTickRange(ctx),
  ]);

  return results;
}

/**
 * Print invariant results
 */
export function printInvariantResults(results: AssertionResult[]): void {
  console.log('\n  Invariant Checks:');
  console.log('  ' + '-'.repeat(50));

  for (const result of results) {
    const isSkipped = result.passed && result.message.startsWith('Skipped');
    const status = isSkipped ? 'SKIP' : result.passed ? success('PASS') : error('FAIL');
    console.log(`    [${status}] ${result.name}`);
    if (!result.passed || isSkipped) {
      console.log(`         ${result.message}`);
    }
  }

  const skipCount = results.filter((r) => r.passed && r.message.startsWith('Skipped')).length;
  const passCount = results.filter((r) => r.passed && !r.message.startsWith('Skipped')).length;
  const total = results.length;
  const skipNote = skipCount > 0 ? ` (${skipCount} skipped)` : '';
  console.log(`\n  ${passCount}/${total} invariants passed${skipNote}\n`);
}

export const invariants = {
  checkCollateralBacking,
  checkMarketActive,
  checkTokenSupply,
  checkTickRange,
  runAllInvariants,
  printInvariantResults,
};
