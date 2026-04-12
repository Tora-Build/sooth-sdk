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
}

export interface SimulateResult {
  ordersPlaced: number;
  ordersCrossed: number;
  totalGas: bigint;
  stoppedEarly: boolean;
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
  if (!Number.isInteger(numOrders) || numOrders <= 0) {
    throw new Error("numOrders must be a positive integer");
  }
  if (avgSize <= 0n) throw new Error("avgSize must be > 0");

  const rng = mulberry32(seed);

  report({
    type: "info",
    message: `Simulate start: orders=${numOrders} avgSize=${formatWad(avgSize)} seed=${seed}`,
    data: { numOrders, avgSize, seed },
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

  let totalGas = 0n;
  let ordersPlaced = 0;
  let ordersCrossed = 0;
  let consecutiveFailures = 0;
  let stoppedEarly = false;

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
      let hash: `0x${string}`;

      if (action === "buyyes") {
        const bestNoTick = (await publicClient.readContract({
          address: soothBook,
          abi: SoothBookABI,
          functionName: "getBestTick",
          args: [marketKey, 0],
        })) as number;
        likelyCross = bestNoTick > 0 && tick + bestNoTick >= 1000;
        hash = await walletClient.writeContract({
          address: soothBook,
          abi: SoothBookABI,
          functionName: "buyYes",
          args: [marketKey, tick, amount, false, 0],
          account: walletClient.account,
          chain: null,
        });
      } else if (action === "buyno") {
        const bestYesTick = (await publicClient.readContract({
          address: soothBook,
          abi: SoothBookABI,
          functionName: "getBestTick",
          args: [marketKey, 1],
        })) as number;
        likelyCross = bestYesTick > 0 && tick + bestYesTick >= 1000;
        hash = await walletClient.writeContract({
          address: soothBook,
          abi: SoothBookABI,
          functionName: "buyNo",
          args: [marketKey, tick, amount, false, 0],
          account: walletClient.account,
          chain: null,
        });
      } else if (action === "mint") {
        hash = await walletClient.writeContract({
          address: soothBook,
          abi: SoothBookABI,
          functionName: "mint",
          args: [marketKey, amount],
          account: walletClient.account,
          chain: null,
        });
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
        hash = await walletClient.writeContract({
          address: soothBook,
          abi: SoothBookABI,
          functionName: "merge",
          args: [marketKey, mergeAmount < amount ? mergeAmount : amount],
          account: walletClient.account,
          chain: null,
        });
      }

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      totalGas += receipt.gasUsed;
      ordersPlaced++;
      if (likelyCross) ordersCrossed++;
      consecutiveFailures = 0;
      report({
        type: "success",
        message: `[${i + 1}/${numOrders}] ${action.toUpperCase()} (gas: ${receipt.gasUsed})`,
        data: { i, action, gasUsed: receipt.gasUsed, likelyCross },
      });
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

  return { ordersPlaced, ordersCrossed, totalGas, stoppedEarly };
}
