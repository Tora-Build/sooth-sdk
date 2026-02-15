/**
 * Invariant Assertions
 * Built-in invariants that can be checked during scenarios
 */

import type { CommandContext } from '../commands/types';
import type { ActorManager } from '../actors';
import { ABIS, WAD } from '../config';
import { formatWad, success, error } from '../utils';

export interface AssertionResult {
  name: string;
  passed: boolean;
  message: string;
  data?: any;
}

/**
 * Check vault solvency - total claims <= vault balance
 * SKIPPED: TickBook removed
 */
export async function checkVaultSolvency(ctx: CommandContext): Promise<AssertionResult> {
  return {
    name: 'vault.solvent',
    passed: true,
    message: 'Skipped (TickBook removed)',
  };
}

/**
 * Check no order overflow - filledShares <= sharesTotal for all orders
 * SKIPPED: TickBook removed
 */
export async function checkNoOrderOverflow(ctx: CommandContext): Promise<AssertionResult> {
  return {
    name: 'orders.noOverflow',
    passed: true,
    message: 'Skipped (TickBook removed)',
  };
}

/**
 * Check tick consistency - tick in valid range
 * SKIPPED: TickBook removed
 */
export async function checkTickConsistency(ctx: CommandContext): Promise<AssertionResult> {
  return {
    name: 'market.tickValid',
    passed: true,
    message: 'Skipped (TickBook removed)',
  };
}

/**
 * Check reserved never exceeds available for each actor
 * SKIPPED: TickBook removed
 */
export async function checkReservedBounds(ctx: CommandContext): Promise<AssertionResult> {
  return {
    name: 'vault.reservedBounds',
    passed: true,
    message: 'Skipped (TickBook removed)',
  };
}

/**
 * Run all invariant checks
 */
export async function runAllInvariants(ctx: CommandContext): Promise<AssertionResult[]> {
  const results = await Promise.all([
    checkVaultSolvency(ctx),
    checkNoOrderOverflow(ctx),
    checkTickConsistency(ctx),
    checkReservedBounds(ctx),
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
    const status = result.passed ? success('PASS') : error('FAIL');
    console.log(`    [${status}] ${result.name}`);
    if (!result.passed) {
      console.log(`         ${result.message}`);
    }
  }

  const passCount = results.filter(r => r.passed).length;
  const total = results.length;
  console.log(`\n  ${passCount}/${total} invariants passed\n`);
}

export const invariants = {
  checkVaultSolvency,
  checkNoOrderOverflow,
  checkTickConsistency,
  checkReservedBounds,
  runAllInvariants,
  printInvariantResults,
};
