/**
 * Invariant Assertions
 * SoothBook invariants for on-chain verification
 */

import type { CommandContext } from "../commands/types";
import { ABIS } from "../config";
import {
  formatWad,
  success,
  error,
  readContractWithRpcFallback,
} from "../cli-utils";

export interface AssertionResult {
  name: string;
  passed: boolean;
  message: string;
  data?: any;
}

/**
 * Check SoothBook collateral backing — USDC held >= collateralBacking reported
 */
export async function checkCollateralBacking(
  ctx: CommandContext,
): Promise<AssertionResult> {
  const soothBook = ctx.deployment.contracts.SoothBook;
  const marketKey = ctx.marketKey;

  if (!soothBook || !marketKey) {
    return {
      name: "soothbook.backing",
      passed: true,
      message: "Skipped (no SoothBook or market selected)",
    };
  }

  try {
    const [usdcBalance, collateralBacking] = await Promise.all([
      readContractWithRpcFallback<bigint>(ctx.config.chain, ctx.config.rpc, {
        address: ctx.deployment.contracts.BaseToken as `0x${string}`,
        abi: ABIS.BaseToken,
        functionName: "balanceOf",
        args: [soothBook as `0x${string}`],
      }),
      readContractWithRpcFallback<bigint>(ctx.config.chain, ctx.config.rpc, {
        address: soothBook as `0x${string}`,
        abi: ABIS.SoothBook,
        functionName: "getCollateralBacking",
        args: [marketKey],
      }),
    ]);

    const passed = usdcBalance >= collateralBacking;
    return {
      name: "soothbook.backing",
      passed,
      message: passed
        ? `USDC ${formatWad(usdcBalance)} >= backing ${formatWad(collateralBacking)}`
        : `USDC ${formatWad(usdcBalance)} < backing ${formatWad(collateralBacking)} — UNDERCOLLATERALIZED`,
      data: { usdcBalance, collateralBacking },
    };
  } catch (err) {
    return {
      name: "soothbook.backing",
      passed: false,
      message: `Error: ${(err as Error).message}`,
    };
  }
}

/**
 * Check market is active (not finalized/resolved)
 */
export async function checkMarketActive(
  ctx: CommandContext,
): Promise<AssertionResult> {
  const soothBook = ctx.deployment.contracts.SoothBook;
  const marketKey = ctx.marketKey;

  if (!soothBook || !marketKey) {
    return {
      name: "soothbook.marketActive",
      passed: true,
      message: "Skipped (no SoothBook or market selected)",
    };
  }

  try {
    const marketInfo = await readContractWithRpcFallback<
      readonly [
        `0x${string}`,
        `0x${string}`,
        `0x${string}`,
        boolean,
        boolean,
        number,
      ]
    >(ctx.config.chain, ctx.config.rpc, {
      address: soothBook as `0x${string}`,
      abi: ABIS.SoothBook,
      functionName: "markets",
      args: [marketKey],
    });

    const [, , , active, finalized, outcome] = marketInfo;
    const passed = active && !finalized;
    const outcomeLabels = ["NO", "YES", "INVALID"];

    return {
      name: "soothbook.marketActive",
      passed,
      message: passed
        ? "Market is active"
        : `Market inactive: active=${active}, finalized=${finalized}, outcome=${outcomeLabels[outcome] ?? outcome}`,
      data: { active, finalized, outcome },
    };
  } catch (err) {
    return {
      name: "soothbook.marketActive",
      passed: false,
      message: `Error: ${(err as Error).message}`,
    };
  }
}

/**
 * Check YES totalSupply == NO totalSupply (complete sets invariant)
 */
export async function checkTokenSupply(
  ctx: CommandContext,
): Promise<AssertionResult> {
  const soothBook = ctx.deployment.contracts.SoothBook;
  const marketKey = ctx.marketKey;

  if (!soothBook || !marketKey) {
    return {
      name: "soothbook.tokenSupply",
      passed: true,
      message: "Skipped (no SoothBook or market selected)",
    };
  }

  try {
    const marketInfo = await readContractWithRpcFallback<
      readonly [
        `0x${string}`,
        `0x${string}`,
        `0x${string}`,
        boolean,
        boolean,
        number,
      ]
    >(ctx.config.chain, ctx.config.rpc, {
      address: soothBook as `0x${string}`,
      abi: ABIS.SoothBook,
      functionName: "markets",
      args: [marketKey],
    });

    const [, yesToken, noToken] = marketInfo;

    const [yesSupply, noSupply] = await Promise.all([
      readContractWithRpcFallback<bigint>(ctx.config.chain, ctx.config.rpc, {
        address: yesToken,
        abi: ABIS.OutcomeToken,
        functionName: "totalSupply",
        args: [],
      }),
      readContractWithRpcFallback<bigint>(ctx.config.chain, ctx.config.rpc, {
        address: noToken,
        abi: ABIS.OutcomeToken,
        functionName: "totalSupply",
        args: [],
      }),
    ]);

    const passed = yesSupply === noSupply;
    return {
      name: "soothbook.tokenSupply",
      passed,
      message: passed
        ? `YES supply == NO supply (${formatWad(yesSupply)})`
        : `YES ${formatWad(yesSupply)} != NO ${formatWad(noSupply)} — SUPPLY MISMATCH`,
      data: { yesSupply, noSupply },
    };
  } catch (err) {
    return {
      name: "soothbook.tokenSupply",
      passed: false,
      message: `Error: ${(err as Error).message}`,
    };
  }
}

/**
 * Check best ticks are in valid range (0 = empty book, or 1-999)
 */
export async function checkTickRange(
  ctx: CommandContext,
): Promise<AssertionResult> {
  const soothBook = ctx.deployment.contracts.SoothBook;
  const marketKey = ctx.marketKey;

  if (!soothBook || !marketKey) {
    return {
      name: "soothbook.tickRange",
      passed: true,
      message: "Skipped (no SoothBook or market selected)",
    };
  }

  try {
    const [bestYesTick, bestNoTick] = await Promise.all([
      readContractWithRpcFallback<number>(ctx.config.chain, ctx.config.rpc, {
        address: soothBook as `0x${string}`,
        abi: ABIS.SoothBook,
        functionName: "getBestTick",
        args: [marketKey, 1],
      }),
      readContractWithRpcFallback<number>(ctx.config.chain, ctx.config.rpc, {
        address: soothBook as `0x${string}`,
        abi: ABIS.SoothBook,
        functionName: "getBestTick",
        args: [marketKey, 0],
      }),
    ]);

    const yesValid =
      bestYesTick === 0 || (bestYesTick >= 1 && bestYesTick <= 999);
    const noValid = bestNoTick === 0 || (bestNoTick >= 1 && bestNoTick <= 999);
    const passed = yesValid && noValid;

    return {
      name: "soothbook.tickRange",
      passed,
      message: passed
        ? `YES tick=${bestYesTick}, NO tick=${bestNoTick} (valid)`
        : `Out of range: YES tick=${bestYesTick}, NO tick=${bestNoTick}`,
      data: { bestYesTick, bestNoTick },
    };
  } catch (err) {
    return {
      name: "soothbook.tickRange",
      passed: false,
      message: `Error: ${(err as Error).message}`,
    };
  }
}

/**
 * Run all invariant checks
 */
export async function runAllInvariants(
  ctx: CommandContext,
): Promise<AssertionResult[]> {
  const soothBook = ctx.deployment.contracts.SoothBook;
  const marketKey = ctx.marketKey;

  if (soothBook && marketKey) {
    const registered = await readContractWithRpcFallback<
      readonly [
        `0x${string}`,
        `0x${string}`,
        `0x${string}`,
        boolean,
        boolean,
        number,
      ]
    >(ctx.config.chain, ctx.config.rpc, {
      address: soothBook as `0x${string}`,
      abi: ABIS.SoothBook,
      functionName: "markets",
      args: [marketKey],
    }).catch(() => null);

    if (
      !registered ||
      registered[0] === "0x0000000000000000000000000000000000000000"
    ) {
      const skipMsg = "Skipped (AMM-only market — not registered in SoothBook)";
      return [
        { name: "soothbook.backing", passed: true, message: skipMsg },
        { name: "soothbook.marketActive", passed: true, message: skipMsg },
        { name: "soothbook.tokenSupply", passed: true, message: skipMsg },
        { name: "soothbook.tickRange", passed: true, message: skipMsg },
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
  console.log("\n  Invariant Checks:");
  console.log("  " + "-".repeat(50));

  for (const result of results) {
    const isSkipped = result.passed && result.message.startsWith("Skipped");
    const status = isSkipped
      ? "SKIP"
      : result.passed
        ? success("PASS")
        : error("FAIL");
    console.log(`    [${status}] ${result.name}`);
    if (!result.passed || isSkipped) {
      console.log(`         ${result.message}`);
    }
  }

  const skipCount = results.filter(
    (r) => r.passed && r.message.startsWith("Skipped"),
  ).length;
  const passCount = results.filter(
    (r) => r.passed && !r.message.startsWith("Skipped"),
  ).length;
  const total = results.length;
  const skipNote = skipCount > 0 ? ` (${skipCount} skipped)` : "";
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
