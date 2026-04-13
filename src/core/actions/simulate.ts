/**
 * Orderbook simulation: runs N random SoothBook orders against a selected
 * market. Matches the canonical Node CLI implementation in
 * packages/sdk/src/cli/commands/market.ts — including the critical approval
 * of BOTH SoothBook AND OrderEngine (SoothBook.mint/buyYes/buyNo internally
 * pull USDC via OrderEngine).
 *
 * Both apps/demo (browser) and packages/sdk/src/cli (Node) call this.
 */

import { maxUint256, parseAbi } from "viem";
import { SoothBookABI } from "../abis/SoothBook.js";
import {
  type ActionContext,
  type ActionReporter,
  noopReporter,
} from "./types.js";
import {
  isMegaethChain,
  getMegaethNativeRpcUrl,
  writeContractRealtime,
} from "../megaeth.js";

const ERC20_ABI = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function mint(address to, uint256 amount)",
]);

export interface SimulateParams {
  marketKey: `0x${string}`;
  numOrders: number;
  avgSize: bigint;
  seed: number;
  realtimeMode?: boolean;
}

export interface SimulateResult {
  ordersPlaced: number;
  ordersCrossed: number;
  totalGas: bigint;
  stoppedEarly: boolean;
  latency?: {
    avg: number;
    p50: number;
    p95: number;
    min: number;
    max: number;
    mode: 'standard' | 'realtime';
  };
}

const WAD = 10n ** 18n;

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function formatWad(value: bigint): string {
  const whole = value / WAD;
  const frac = (value % WAD) / 10n ** 16n; // 2 decimals
  return `${whole}.${frac.toString().padStart(2, "0")}`;
}

export async function runSimulate(
  ctx: ActionContext,
  params: SimulateParams,
  report: ActionReporter = noopReporter,
): Promise<SimulateResult> {
  const { publicClient, walletClient, address, contracts } = ctx;

  const soothBook = contracts.SoothBook;
  const orderEngine = contracts.OrderEngine;
  if (!soothBook) throw new Error("SoothBook not deployed on this chain");
  if (!orderEngine) throw new Error("OrderEngine not deployed on this chain");
  if (!walletClient.account) throw new Error("walletClient has no account");

  const { marketKey, numOrders, avgSize, seed } = params;
  const useRealtime = params.realtimeMode && isMegaethChain(ctx.chainId);
  const realtimeRpcUrl = useRealtime ? getMegaethNativeRpcUrl(ctx.chainId) : undefined;
  if (!Number.isInteger(numOrders) || numOrders <= 0) {
    throw new Error("numOrders must be a positive integer");
  }
  if (avgSize <= 0n) throw new Error("avgSize must be > 0");

  const rng = mulberry32(seed);

  report({
    type: "info",
    message: `Simulate start: orders=${numOrders} avgSize=${formatWad(avgSize)} seed=${seed}${useRealtime ? ' [realtime]' : ''}`,
    data: { numOrders, avgSize, seed, useRealtime },
  });

  // Ensure USDC balance
  const estimatedUsdcNeeded = avgSize * BigInt(numOrders) * 2n;
  const usdcBalance = (await publicClient.readContract({
    address: contracts.MockUSDC,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [address],
  })) as bigint;

  if (usdcBalance < estimatedUsdcNeeded) {
    const mintAmount = estimatedUsdcNeeded - usdcBalance + avgSize * 5n;
    report({
      type: "info",
      message: `Minting ${formatWad(mintAmount)} USDC...`,
    });
    const mintHash = await walletClient.writeContract({
      address: contracts.MockUSDC,
      abi: ERC20_ABI,
      functionName: "mint",
      args: [address, mintAmount],
      account: walletClient.account,
      chain: null,
    });
    await publicClient.waitForTransactionReceipt({ hash: mintHash });
    report({
      type: "success",
      message: `Minted ${formatWad(mintAmount)} USDC`,
    });
  }

  // Approve BOTH SoothBook AND OrderEngine.
  // SoothBook.mint/buyYes/buyNo internally transferFrom via OrderEngine —
  // approving only SoothBook reverts with ERC20InsufficientAllowance.
  report({ type: "info", message: "Approving SoothBook + OrderEngine..." });
  const approveSBHash = await walletClient.writeContract({
    address: contracts.MockUSDC,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [soothBook, maxUint256],
    account: walletClient.account,
    chain: null,
  });
  await publicClient.waitForTransactionReceipt({ hash: approveSBHash });
  const approveOEHash = await walletClient.writeContract({
    address: contracts.MockUSDC,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [orderEngine, maxUint256],
    account: walletClient.account,
    chain: null,
  });
  await publicClient.waitForTransactionReceipt({ hash: approveOEHash });
  report({ type: "success", message: "SoothBook + OrderEngine approved" });

  // Pre-check: market must be active on SoothBook or all trades revert
  const marketState = (await publicClient.readContract({
    address: soothBook,
    abi: SoothBookABI,
    functionName: "markets",
    args: [marketKey],
  })) as readonly [boolean, boolean, number];
  if (!marketState[0]) {
    throw new Error(
      `Market not active on SoothBook. The market must graduate from Launchpad first. Run 'graduate' before 'simulate'.`,
    );
  }

  let totalGas = 0n;
  let ordersPlaced = 0;
  let ordersCrossed = 0;
  let consecutiveFailures = 0;
  let stoppedEarly = false;
  const orderTimings: number[] = [];

  for (let i = 0; i < numOrders; i++) {
    const r = rng();
    const sizeMultiplierBps = 500n + BigInt(Math.floor(rng() * 1001));
    const amount = (avgSize * sizeMultiplierBps) / 1000n || WAD;
    const tick = 100 + Math.floor(rng() * 801);

    let action: "buyyes" | "buyno" | "mint" | "merge";
    if (r < 0.4) action = "buyyes";
    else if (r < 0.8) action = "buyno";
    else if (r < 0.9) action = "mint";
    else action = "merge";

    try {
      let likelyCross = false;
      let fnName: string;
      let fnArgs: readonly unknown[];

      if (action === "buyyes") {
        const bestNoTick = (await publicClient.readContract({
          address: soothBook,
          abi: SoothBookABI,
          functionName: "getBestTick",
          args: [marketKey, 0],
        })) as number;
        likelyCross = bestNoTick > 0 && tick + bestNoTick >= 1000;
        fnName = "buyYes";
        fnArgs = [marketKey, tick, amount, false, 0];
      } else if (action === "buyno") {
        const bestYesTick = (await publicClient.readContract({
          address: soothBook,
          abi: SoothBookABI,
          functionName: "getBestTick",
          args: [marketKey, 1],
        })) as number;
        likelyCross = bestYesTick > 0 && tick + bestYesTick >= 1000;
        fnName = "buyNo";
        fnArgs = [marketKey, tick, amount, false, 0];
      } else if (action === "mint") {
        fnName = "mint";
        fnArgs = [marketKey, amount];
      } else {
        const balances = (await publicClient.readContract({
          address: soothBook,
          abi: SoothBookABI,
          functionName: "getBalance",
          args: [marketKey, address],
        })) as readonly [bigint, bigint];
        const mergeAmount =
          balances[0] < balances[1] ? balances[0] : balances[1];
        if (mergeAmount <= 0n) {
          report({
            type: "info",
            message: `[${i + 1}/${numOrders}] MERGE skipped (no complete sets)`,
          });
          continue;
        }
        fnName = "merge";
        fnArgs = [marketKey, mergeAmount < amount ? mergeAmount : amount];
      }

      if (useRealtime && realtimeRpcUrl && walletClient.account) {
        const { receipt, sendMs, prepareMs } = await writeContractRealtime({
          rpcUrl: realtimeRpcUrl,
          publicClient,
          account: walletClient.account as any,
          chainId: ctx.chainId,
          request: {
            address: soothBook,
            abi: SoothBookABI as any,
            functionName: fnName,
            args: fnArgs,
          },
        });
        totalGas += receipt.gasUsed;
        ordersPlaced++;
        if (likelyCross) ordersCrossed++;
        orderTimings.push(sendMs);
        consecutiveFailures = 0;
        report({
          type: "success",
          message: `[${i + 1}/${numOrders}] ${action.toUpperCase()} (gas: ${receipt.gasUsed}, ${prepareMs}ms prep, ${sendMs}ms realtime)`,
          data: { i, action, gasUsed: receipt.gasUsed, likelyCross, orderMs: sendMs, prepareMs },
        });
      } else {
        const hash = await walletClient.writeContract({
          address: soothBook,
          abi: SoothBookABI,
          functionName: fnName as any,
          args: fnArgs as any,
          account: walletClient.account,
          chain: null,
        });

        const orderStart = performance.now();
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        const orderMs = Number((performance.now() - orderStart).toFixed(1));
        totalGas += receipt.gasUsed;
        ordersPlaced++;
        if (likelyCross) ordersCrossed++;
        orderTimings.push(orderMs);
        consecutiveFailures = 0;
        report({
          type: "success",
          message: `[${i + 1}/${numOrders}] ${action.toUpperCase()} (gas: ${receipt.gasUsed}, ${orderMs}ms)`,
          data: { i, action, gasUsed: receipt.gasUsed, likelyCross, orderMs },
        });
      }
    } catch (err) {
      const msg = (err as Error).message.slice(0, 120);
      report({
        type: "error",
        message: `[${i + 1}/${numOrders}] ${action.toUpperCase()} failed: ${msg}`,
      });
      consecutiveFailures++;
      if (consecutiveFailures >= 3) {
        report({
          type: "warn",
          message: "Stopping after 3 consecutive failures",
        });
        stoppedEarly = true;
        break;
      }
    }
  }

  let latency: SimulateResult['latency'];
  if (orderTimings.length > 0) {
    const sorted = [...orderTimings].sort((a, b) => a - b);
    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    latency = {
      avg: Math.round(avg),
      p50: Math.round(sorted[Math.floor(sorted.length * 0.5)]),
      p95: Math.round(sorted[Math.floor(sorted.length * 0.95)]),
      min: Math.round(sorted[0]),
      max: Math.round(sorted[sorted.length - 1]),
      mode: useRealtime ? 'realtime' : 'standard',
    };
  }

  return { ordersPlaced, ordersCrossed, totalGas, stoppedEarly, latency };
}
