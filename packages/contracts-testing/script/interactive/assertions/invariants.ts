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
 */
export async function checkVaultSolvency(ctx: CommandContext): Promise<AssertionResult> {
  const { actorManager, deployment } = ctx;
  const publicClient = actorManager.getPublicClient();
  const actors = actorManager.listActors();

  // Get vault USDC balance
  const vaultBalance = await publicClient.readContract({
    address: deployment.contracts.MockUSDC as `0x${string}`,
    abi: ABIS.MockUSDC,
    functionName: 'balanceOf',
    args: [deployment.contracts.TickBookVault as `0x${string}`],
  }) as bigint;

  // Sum all actor claims
  let totalClaims = 0n;
  for (const actor of actors) {
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
    totalClaims += available + reserved;
  }

  const passed = totalClaims <= vaultBalance;

  return {
    name: 'vault.solvent',
    passed,
    message: passed
      ? `Vault solvent: claims ${formatWad(totalClaims)} <= balance ${formatWad(vaultBalance)}`
      : `INSOLVENCY: claims ${formatWad(totalClaims)} > balance ${formatWad(vaultBalance)}`,
    data: { totalClaims, vaultBalance },
  };
}

/**
 * Check no order overflow - filledShares <= sharesTotal for all orders
 */
export async function checkNoOrderOverflow(ctx: CommandContext): Promise<AssertionResult> {
  const { actorManager, deployment, marketKey } = ctx;
  const publicClient = actorManager.getPublicClient();

  if (!marketKey) {
    return {
      name: 'orders.noOverflow',
      passed: true,
      message: 'No market selected - skipped',
    };
  }

  // Get order count
  const nextOrderId = await publicClient.readContract({
    address: deployment.contracts.TickBookPoolManager as `0x${string}`,
    abi: ABIS.TickBookPoolManager,
    functionName: 'getNextOrderId',
  }) as bigint;

  const overflowOrders: number[] = [];

  // Check each order
  for (let i = 1; i < Number(nextOrderId); i++) {
    try {
      const order = await publicClient.readContract({
        address: deployment.contracts.TickBookPoolManager as `0x${string}`,
        abi: ABIS.TickBookPoolManager,
        functionName: 'getOrder',
        args: [marketKey, BigInt(i)],
      }) as any;

      if (order.filledShares > order.sharesTotal) {
        overflowOrders.push(i);
      }
    } catch {
      // Order doesn't exist
    }
  }

  const passed = overflowOrders.length === 0;

  return {
    name: 'orders.noOverflow',
    passed,
    message: passed
      ? `All orders have filledShares <= sharesTotal`
      : `OVERFLOW in orders: ${overflowOrders.join(', ')}`,
    data: { overflowOrders },
  };
}

/**
 * Check tick consistency - tick in valid range
 */
export async function checkTickConsistency(ctx: CommandContext): Promise<AssertionResult> {
  const { actorManager, deployment, marketKey } = ctx;
  const publicClient = actorManager.getPublicClient();

  if (!marketKey) {
    return {
      name: 'market.tickValid',
      passed: true,
      message: 'No market selected - skipped',
    };
  }

  const [tick, , , prob] = await publicClient.readContract({
    address: deployment.contracts.TickBookPoolManager as `0x${string}`,
    abi: ABIS.TickBookPoolManager,
    functionName: 'getMarketState',
    args: [marketKey],
  }) as [number, bigint, bigint, bigint];

  const tickValid = tick >= 1 && tick <= 999;
  const probValid = prob > 0n && prob < WAD;

  // Check tick-probability consistency
  const expectedProb = (BigInt(tick) * WAD) / 1000n;
  const diff = prob > expectedProb ? prob - expectedProb : expectedProb - prob;
  const tolerance = WAD / 100n; // 1%
  const consistent = diff <= tolerance;

  const passed = tickValid && probValid && consistent;

  return {
    name: 'market.tickValid',
    passed,
    message: passed
      ? `Tick ${tick} valid and consistent with probability ${(Number(prob) / 1e18 * 100).toFixed(2)}%`
      : `Tick/probability issue: tick=${tick}, prob=${Number(prob) / 1e18}`,
    data: { tick, prob: Number(prob) / 1e18, tickValid, probValid, consistent },
  };
}

/**
 * Check reserved never exceeds available for each actor
 */
export async function checkReservedBounds(ctx: CommandContext): Promise<AssertionResult> {
  const { actorManager, deployment } = ctx;
  const publicClient = actorManager.getPublicClient();
  const actors = actorManager.listActors();

  const violations: string[] = [];

  for (const actor of actors) {
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

    if (reserved > available) {
      violations.push(`${actor.name}: reserved ${formatWad(reserved)} > available ${formatWad(available)}`);
    }
  }

  const passed = violations.length === 0;

  return {
    name: 'vault.reservedBounds',
    passed,
    message: passed
      ? 'All actors have reserved <= available'
      : `VIOLATION: ${violations.join('; ')}`,
    data: { violations },
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
