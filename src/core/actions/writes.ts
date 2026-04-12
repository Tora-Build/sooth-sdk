/**
 * Pure write actions shared between the Node CLI and browser demo.
 *
 * Each function takes an ActionContext (public + wallet client + contracts +
 * address) plus typed params plus an optional reporter, and performs one
 * multi-step flow against the sooth-core contracts.
 *
 * These are the canonical implementations — the demo's Geek page and the
 * Node CLI both call them, so any contract-interaction bug only has to be
 * fixed in one place.
 */

import {
  decodeEventLog,
  encodeAbiParameters,
  maxUint256,
  parseAbi,
  zeroAddress,
  type Address,
} from "viem";
import { LaunchpadEngineABI } from "../abis/LaunchpadEngine.js";
import { AMMEngineABI } from "../abis/AMMEngine.js";
import { SoothBookABI } from "../abis/SoothBook.js";
import {
  type ActionContext,
  type ActionReporter,
  noopReporter,
} from "./types.js";

const WAD = 10n ** 18n;
const LN2_WAD = 693147180559945309n;

const ERC20_ABI = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function mint(address to, uint256 amount)",
  "function totalSupply() view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
]);

// Local extended ABI for write functions the minimal core LaunchpadEngine
// ABI in core/abis/LaunchpadEngine.ts doesn't declare. Declared here so
// actions don't need a broader ABI change.
const LAUNCHPAD_WRITE_ABI = parseAbi([
  "function dismissMarket(address market)",
  "function claimRefund(address market) returns (uint256)",
]);

function formatWad(value: bigint): string {
  const whole = value / WAD;
  const frac = (value % WAD) / 10n ** 16n;
  return `${whole}.${frac.toString().padStart(2, "0")}`;
}

function requireWallet(ctx: ActionContext) {
  if (!ctx.walletClient.account) {
    throw new Error("walletClient has no bound account");
  }
  return ctx.walletClient.account;
}

//
// ─── USDC ──────────────────────────────────────────────────────────────────
//

export interface MintUsdcParams {
  amount: bigint; // WAD
}

export async function runMintUsdc(
  ctx: ActionContext,
  params: MintUsdcParams,
  report: ActionReporter = noopReporter,
): Promise<`0x${string}`> {
  const account = requireWallet(ctx);
  report({
    type: "info",
    message: `Minting ${formatWad(params.amount)} USDC...`,
  });
  const hash = await ctx.walletClient.writeContract({
    address: ctx.contracts.MockUSDC,
    abi: ERC20_ABI,
    functionName: "mint",
    args: [ctx.address, params.amount],
    account,
    chain: null,
  });
  await ctx.publicClient.waitForTransactionReceipt({ hash });
  report({
    type: "success",
    message: `Minted ${formatWad(params.amount)} USDC`,
  });
  return hash;
}

export interface ApproveParams {
  /** logical target name(s) to approve USDC for */
  targets: Array<"launchpad" | "ammengine" | "soothbook" | "orderengine">;
  amount?: bigint; // default max
}

export async function runApprove(
  ctx: ActionContext,
  params: ApproveParams,
  report: ActionReporter = noopReporter,
): Promise<`0x${string}`[]> {
  const account = requireWallet(ctx);
  const amount = params.amount ?? maxUint256;
  const hashes: `0x${string}`[] = [];

  const resolve = (
    t: ApproveParams["targets"][number],
  ): Address | undefined => {
    switch (t) {
      case "launchpad":
        return ctx.contracts.LaunchpadEngine;
      case "ammengine":
        return ctx.contracts.AMMEngine;
      case "soothbook":
        return ctx.contracts.SoothBook;
      case "orderengine":
        return ctx.contracts.OrderEngine;
    }
  };

  for (const target of params.targets) {
    const addr = resolve(target);
    if (!addr) {
      report({
        type: "warn",
        message: `Skipping ${target}: not deployed on chain ${ctx.chainId}`,
      });
      continue;
    }
    report({ type: "info", message: `Approving ${target}...` });
    const hash = await ctx.walletClient.writeContract({
      address: ctx.contracts.MockUSDC,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [addr, amount],
      account,
      chain: null,
    });
    await ctx.publicClient.waitForTransactionReceipt({ hash });
    hashes.push(hash);
    report({ type: "success", message: `Approved ${target}` });
  }
  return hashes;
}

//
// ─── CREATE MARKET ─────────────────────────────────────────────────────────
//

export interface CreateMarketParams {
  question: string;
  /** unix seconds; 0 means "now" */
  startTime: bigint;
  deadline: bigint;
  adjudicator: Address;
  /** b parameter in WAD */
  bBase: bigint;
  /** 0 < p < 1e18 — v0.1.2 rejects 0 and 1e18 */
  initialProbabilityWad: bigint;
  /** encoded (resolver, deadline, vetoPeriod, typeConfig); pass null to build a default from the caller's address + deadline */
  adjudicatorConfig?: `0x${string}`;
}

export interface CreateMarketResult {
  marketAddress: Address;
  txHash: `0x${string}`;
}

export async function runCreateMarket(
  ctx: ActionContext,
  params: CreateMarketParams,
  report: ActionReporter = noopReporter,
): Promise<CreateMarketResult> {
  const account = requireWallet(ctx);

  // Ensure deposit: depositWad = b × ln(max(p, 1-p) inverse). For simplicity
  // and matching the canonical demo/Launchpad UX, approve generously via
  // runApprove(launchpad) instead of computing exact allowance. Caller should
  // hold enough USDC — we mint a safety buffer if balance is low.
  const deposit = (params.bBase * LN2_WAD) / WAD;
  const balance = (await ctx.publicClient.readContract({
    address: ctx.contracts.MockUSDC,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [ctx.address],
  })) as bigint;
  if (balance < deposit * 2n) {
    await runMintUsdc(ctx, { amount: deposit * 3n }, report);
  }

  await runApprove(ctx, { targets: ["launchpad"] }, report);

  const adjConfig: `0x${string}` =
    params.adjudicatorConfig ??
    encodeAbiParameters(
      [
        { type: "address" },
        { type: "uint64" },
        { type: "uint48" },
        { type: "bytes" },
      ],
      [ctx.address, params.deadline, 0, "0x"],
    );

  report({ type: "info", message: "Creating market in LaunchpadEngine..." });
  const hash = await ctx.walletClient.writeContract({
    address: ctx.contracts.LaunchpadEngine,
    abi: LaunchpadEngineABI,
    functionName: "createMarket",
    args: [
      params.question,
      params.startTime,
      params.deadline,
      params.adjudicator,
      params.bBase,
      params.initialProbabilityWad,
      adjConfig,
    ],
    account,
    chain: null,
  });
  const receipt = await ctx.publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status === "reverted") {
    throw new Error("createMarket reverted");
  }

  let marketAddress: Address | undefined;
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: LaunchpadEngineABI,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === "MarketCreated") {
        marketAddress = (decoded.args as { market: Address }).market;
        break;
      }
    } catch {
      continue;
    }
  }
  if (!marketAddress) throw new Error("MarketCreated event not found");

  report({
    type: "success",
    message: `Market created: ${marketAddress}`,
    data: { marketAddress, txHash: hash },
  });
  return { marketAddress, txHash: hash };
}

//
// ─── GRADUATE ──────────────────────────────────────────────────────────────
//

const FEE_ROUTER_ABI = parseAbi([
  "function getGraduationProgress(address market) view returns (uint256 accrued, uint256 threshold, uint256 bps)",
  "function preGradFeeBps() view returns (uint256)",
]);

export interface GraduateParams {
  marketAddress: Address;
  numTrades?: number; // default 8
}

export interface GraduateResult {
  tradesExecuted: number;
  totalGas: bigint;
  graduated: boolean;
}

export async function runGraduate(
  ctx: ActionContext,
  params: GraduateParams,
  report: ActionReporter = noopReporter,
): Promise<GraduateResult> {
  const account = requireWallet(ctx);
  const { marketAddress } = params;
  const numTrades = params.numTrades ?? 8;

  // 1. Check graduation status
  const alreadyGraduated = (await ctx.publicClient.readContract({
    address: ctx.contracts.LaunchpadEngine,
    abi: LaunchpadEngineABI,
    functionName: "isGraduated",
    args: [marketAddress],
  })) as boolean;
  if (alreadyGraduated) {
    report({ type: "success", message: "Market is already graduated" });
    return { tradesExecuted: 0, totalGas: 0n, graduated: true };
  }

  // 2. Compute trade size from FeeRouter progress (same formula as CLI)
  let tradeSize = 500n * WAD;
  if (ctx.contracts.FeeRouter) {
    try {
      const [accrued, threshold] = (await ctx.publicClient.readContract({
        address: ctx.contracts.FeeRouter,
        abi: FEE_ROUTER_ABI,
        functionName: "getGraduationProgress",
        args: [marketAddress],
      })) as readonly [bigint, bigint, bigint];
      if (threshold > 0n) {
        const target = (threshold * 11n) / 10n;
        const remaining = target > accrued ? target - accrued : 0n;
        if (remaining > 0n) {
          const PER_TRADE_FEE_PER_SHARE_WAD = 18_750_000_000_000_000n;
          const computed =
            (remaining * WAD) /
            (PER_TRADE_FEE_PER_SHARE_WAD * BigInt(numTrades));
          if (computed > tradeSize) tradeSize = computed;
        }
        report({
          type: "info",
          message: `Progress: ${formatWad(accrued)}/${formatWad(threshold)} USDC, tradeSize=${formatWad(tradeSize)}`,
        });
      }
    } catch {
      report({ type: "warn", message: "FeeRouter progress unavailable" });
    }
  }

  // 3. Ensure USDC + approve AMMEngine
  const required = tradeSize * BigInt(numTrades) * 2n;
  const balance = (await ctx.publicClient.readContract({
    address: ctx.contracts.MockUSDC,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [ctx.address],
  })) as bigint;
  if (balance < required) {
    await runMintUsdc(ctx, { amount: required * 2n }, report);
  }
  await runApprove(ctx, { targets: ["ammengine"] }, report);

  // 4. Execute trades, alternating BUY/SELL YES, stop early if graduated
  let totalGas = 0n;
  let tradesExecuted = 0;
  let consecutiveFailures = 0;

  for (let i = 0; i < numTrades; i++) {
    const isBuy = i % 2 === 0;
    const outcome = 1; // YES
    const delta = isBuy ? tradeSize : -tradeSize / 2n;
    const limit = isBuy ? maxUint256 : 0n;
    const label = isBuy ? "BUY" : "SELL";

    try {
      const hash = await ctx.walletClient.writeContract({
        address: ctx.contracts.AMMEngine,
        abi: AMMEngineABI,
        functionName: "tradePositions",
        args: [marketAddress, outcome, delta, limit],
        account,
        chain: null,
      });
      const receipt = await ctx.publicClient.waitForTransactionReceipt({
        hash,
      });
      totalGas += receipt.gasUsed;
      tradesExecuted++;
      consecutiveFailures = 0;
      report({
        type: "success",
        message: `[${i + 1}/${numTrades}] ${label} ${formatWad(
          delta > 0n ? delta : -delta,
        )} (gas: ${receipt.gasUsed})`,
      });

      const graduated = (await ctx.publicClient.readContract({
        address: ctx.contracts.LaunchpadEngine,
        abi: LaunchpadEngineABI,
        functionName: "isGraduated",
        args: [marketAddress],
      })) as boolean;
      if (graduated) {
        report({
          type: "success",
          message: `MARKET GRADUATED after ${tradesExecuted} trades`,
        });
        return { tradesExecuted, totalGas, graduated: true };
      }
    } catch (err) {
      const msg = (err as Error).message.slice(0, 120);
      report({
        type: "error",
        message: `[${i + 1}/${numTrades}] ${label} failed: ${msg}`,
      });
      consecutiveFailures++;
      if (consecutiveFailures >= 3) {
        report({
          type: "warn",
          message: "Stopping after 3 consecutive failures",
        });
        break;
      }
    }
  }

  const finalGraduated = (await ctx.publicClient.readContract({
    address: ctx.contracts.LaunchpadEngine,
    abi: LaunchpadEngineABI,
    functionName: "isGraduated",
    args: [marketAddress],
  })) as boolean;
  return { tradesExecuted, totalGas, graduated: finalGraduated };
}

//
// ─── LP TOKEN OPERATIONS ───────────────────────────────────────────────────
//

export interface LpAmountParams {
  marketAddress: Address;
  /** omit or null = use full balance */
  amount?: bigint;
}

async function resolveLpToken(
  ctx: ActionContext,
  marketAddress: Address,
): Promise<Address> {
  const lp = (await ctx.publicClient.readContract({
    address: ctx.contracts.LaunchpadEngine,
    abi: LaunchpadEngineABI,
    functionName: "getLPToken",
    args: [marketAddress],
  })) as Address;
  if (!lp || lp === zeroAddress) {
    throw new Error("Market not found in LaunchpadEngine");
  }
  return lp;
}

export async function runRedeemLp(
  ctx: ActionContext,
  params: LpAmountParams,
  report: ActionReporter = noopReporter,
): Promise<`0x${string}`> {
  const account = requireWallet(ctx);
  const lp = await resolveLpToken(ctx, params.marketAddress);
  const balance = (await ctx.publicClient.readContract({
    address: lp,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [ctx.address],
  })) as bigint;
  if (balance === 0n) throw new Error("No LP tokens to redeem");
  const amount = params.amount ?? balance;
  if (amount > balance) {
    throw new Error(`Insufficient LP balance: ${formatWad(balance)}`);
  }
  report({
    type: "info",
    message: `Redeeming ${formatWad(amount)} LP tokens...`,
  });
  const hash = await ctx.walletClient.writeContract({
    address: ctx.contracts.AMMEngine,
    abi: AMMEngineABI,
    functionName: "redeemLP",
    args: [params.marketAddress, amount],
    account,
    chain: null,
  });
  await ctx.publicClient.waitForTransactionReceipt({ hash });
  report({
    type: "success",
    message: `Redeemed ${formatWad(amount)} LP`,
  });
  return hash;
}

export interface TransferLpParams extends LpAmountParams {
  recipient: Address;
}

export async function runTransferLp(
  ctx: ActionContext,
  params: TransferLpParams,
  report: ActionReporter = noopReporter,
): Promise<`0x${string}`> {
  const account = requireWallet(ctx);
  if (params.recipient.toLowerCase() === ctx.address.toLowerCase()) {
    throw new Error("Cannot transfer to yourself");
  }
  const lp = await resolveLpToken(ctx, params.marketAddress);
  const balance = (await ctx.publicClient.readContract({
    address: lp,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [ctx.address],
  })) as bigint;
  if (balance === 0n) throw new Error("No LP tokens to transfer");
  const amount = params.amount ?? balance;
  if (amount > balance) {
    throw new Error(`Insufficient LP balance: ${formatWad(balance)}`);
  }
  report({
    type: "info",
    message: `Transferring ${formatWad(amount)} LP to ${params.recipient}...`,
  });
  const hash = await ctx.walletClient.writeContract({
    address: lp,
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [params.recipient, amount],
    account,
    chain: null,
  });
  await ctx.publicClient.waitForTransactionReceipt({ hash });
  report({ type: "success", message: `Transferred ${formatWad(amount)} LP` });
  return hash;
}

//
// ─── DISMISS / CLAIMREFUND ─────────────────────────────────────────────────
//

export interface MarketOnlyParams {
  marketAddress: Address;
}

export async function runDismiss(
  ctx: ActionContext,
  params: MarketOnlyParams,
  report: ActionReporter = noopReporter,
): Promise<`0x${string}`> {
  const account = requireWallet(ctx);
  // Preflight: trial expired and not graduated. LaunchpadEngine revert
  // messages are more actionable than silent failures.
  let isTrialExpired = false;
  try {
    isTrialExpired = (await ctx.publicClient.readContract({
      address: ctx.contracts.LaunchpadEngine,
      abi: LaunchpadEngineABI,
      functionName: "isTrialExpiredWithoutGraduation",
      args: [params.marketAddress],
    })) as boolean;
  } catch {
    // fall through — let contract produce authoritative revert
  }
  if (!isTrialExpired) {
    throw new Error(
      "Market cannot be dismissed (trial not expired or already graduated)",
    );
  }
  report({ type: "info", message: "Dismissing market..." });
  const hash = await ctx.walletClient.writeContract({
    address: ctx.contracts.LaunchpadEngine,
    abi: LAUNCHPAD_WRITE_ABI,
    functionName: "dismissMarket",
    args: [params.marketAddress],
    account,
    chain: null,
  });
  await ctx.publicClient.waitForTransactionReceipt({ hash });
  report({ type: "success", message: "Market dismissed" });
  return hash;
}

export async function runClaimRefund(
  ctx: ActionContext,
  params: MarketOnlyParams,
  report: ActionReporter = noopReporter,
): Promise<`0x${string}`> {
  const account = requireWallet(ctx);
  report({ type: "info", message: "Claiming refund..." });
  const hash = await ctx.walletClient.writeContract({
    address: ctx.contracts.LaunchpadEngine,
    abi: LAUNCHPAD_WRITE_ABI,
    functionName: "claimRefund",
    args: [params.marketAddress],
    account,
    chain: null,
  });
  await ctx.publicClient.waitForTransactionReceipt({ hash });
  report({ type: "success", message: "Refund claimed" });
  return hash;
}

//
// ─── SOOTHBOOK WRITES ──────────────────────────────────────────────────────
//
// All SoothBook writes need BOTH SoothBook AND OrderEngine approvals because
// SoothBook internally pulls USDC via OrderEngine. Callers should have run
// runApprove({targets: ['soothbook', 'orderengine']}) at least once.
//

function requireSoothBook(ctx: ActionContext): Address {
  if (!ctx.contracts.SoothBook) {
    throw new Error("SoothBook not deployed on this chain");
  }
  return ctx.contracts.SoothBook;
}

export interface SoothBookBuyParams {
  marketKey: `0x${string}`;
  tick: number;
  amount: bigint;
  escrow?: boolean;
  matchLimit?: number;
}

export async function runSoothBookBuyYes(
  ctx: ActionContext,
  params: SoothBookBuyParams,
  report: ActionReporter = noopReporter,
): Promise<`0x${string}`> {
  const account = requireWallet(ctx);
  const soothBook = requireSoothBook(ctx);
  report({
    type: "info",
    message: `buyYes tick=${params.tick} size=${formatWad(params.amount)}`,
  });
  const hash = await ctx.walletClient.writeContract({
    address: soothBook,
    abi: SoothBookABI,
    functionName: "buyYes",
    args: [
      params.marketKey,
      params.tick,
      params.amount,
      params.escrow ?? false,
      params.matchLimit ?? 100,
    ],
    account,
    chain: null,
  });
  await ctx.publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

export async function runSoothBookBuyNo(
  ctx: ActionContext,
  params: SoothBookBuyParams,
  report: ActionReporter = noopReporter,
): Promise<`0x${string}`> {
  const account = requireWallet(ctx);
  const soothBook = requireSoothBook(ctx);
  report({
    type: "info",
    message: `buyNo tick=${params.tick} size=${formatWad(params.amount)}`,
  });
  const hash = await ctx.walletClient.writeContract({
    address: soothBook,
    abi: SoothBookABI,
    functionName: "buyNo",
    args: [
      params.marketKey,
      params.tick,
      params.amount,
      params.escrow ?? false,
      params.matchLimit ?? 100,
    ],
    account,
    chain: null,
  });
  await ctx.publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

export interface SoothBookAmountParams {
  marketKey: `0x${string}`;
  amount: bigint;
}

export async function runSoothBookMint(
  ctx: ActionContext,
  params: SoothBookAmountParams,
  report: ActionReporter = noopReporter,
): Promise<`0x${string}`> {
  const account = requireWallet(ctx);
  const soothBook = requireSoothBook(ctx);
  report({
    type: "info",
    message: `sb.mint ${formatWad(params.amount)}`,
  });
  const hash = await ctx.walletClient.writeContract({
    address: soothBook,
    abi: SoothBookABI,
    functionName: "mint",
    args: [params.marketKey, params.amount],
    account,
    chain: null,
  });
  await ctx.publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

export async function runSoothBookMerge(
  ctx: ActionContext,
  params: SoothBookAmountParams,
  report: ActionReporter = noopReporter,
): Promise<`0x${string}`> {
  const account = requireWallet(ctx);
  const soothBook = requireSoothBook(ctx);
  report({
    type: "info",
    message: `sb.merge ${formatWad(params.amount)}`,
  });
  const hash = await ctx.walletClient.writeContract({
    address: soothBook,
    abi: SoothBookABI,
    functionName: "merge",
    args: [params.marketKey, params.amount],
    account,
    chain: null,
  });
  await ctx.publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

export interface SoothBookCancelParams {
  marketKey: `0x${string}`;
  side: 0 | 1; // 0 = NO side, 1 = YES side
  tick: number;
}

export async function runSoothBookCancel(
  ctx: ActionContext,
  params: SoothBookCancelParams,
  report: ActionReporter = noopReporter,
): Promise<`0x${string}`> {
  const account = requireWallet(ctx);
  const soothBook = requireSoothBook(ctx);
  report({
    type: "info",
    message: `sb.cancel side=${params.side} tick=${params.tick}`,
  });
  const hash = await ctx.walletClient.writeContract({
    address: soothBook,
    abi: SoothBookABI,
    functionName: "cancel",
    args: [params.marketKey, params.side, params.tick],
    account,
    chain: null,
  });
  await ctx.publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

export async function runSoothBookRedeem(
  ctx: ActionContext,
  params: { marketKey: `0x${string}` },
  report: ActionReporter = noopReporter,
): Promise<`0x${string}`> {
  const account = requireWallet(ctx);
  const soothBook = requireSoothBook(ctx);
  report({ type: "info", message: "sb.redeem" });
  const hash = await ctx.walletClient.writeContract({
    address: soothBook,
    abi: SoothBookABI,
    functionName: "redeem",
    args: [params.marketKey],
    account,
    chain: null,
  });
  await ctx.publicClient.waitForTransactionReceipt({ hash });
  return hash;
}
