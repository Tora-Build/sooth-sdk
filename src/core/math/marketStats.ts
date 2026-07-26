/**
 * Market Stats Math (pure functions, no React dependencies)
 *
 * LMSR Accounting Model:
 * - Seed = bBase * ln(2)
 * - Fees = feesAccrued
 * - P&L = C(qYes, qNo, bCurrent) - C(0, 0, bCurrent)
 * - Gross Cash = Seed + Fees + P&L
 * - Liability = max(qYes, qNo) = worst-case payout to traders
 * - Floor = Gross - Liability = LP's guaranteed minimum equity
 */

export const LN2 = 0.693147180559945309;

export interface MarketStatsInput {
  /** Creator deposit in token units */
  creatorDeposit: bigint;
  /** Fees accrued in token units */
  feesAccrued: bigint;
  /** LP yield pool in token units */
  lpYieldPool: bigint;
  /** Total LP supply (WAD) */
  lpSupply: bigint;
  /** Current b parameter (WAD) */
  currentBBase: bigint;
  /** Initial b parameter (WAD) */
  initialBBase: bigint;
  /** Current qYes (WAD) */
  qYes: bigint;
  /** Current qNo (WAD) */
  qNo: bigint;
  /** Locked proceeds in AMMEngine (token units) */
  lockedProceeds?: bigint;
  /** BaseToken decimals. Optional for legacy compat; pass on-chain `decimals()` for correctness. */
  usdcDecimals?: number;
}

export interface MarketStats {
  seed: bigint;
  fees: bigint;
  pnl: bigint;
  gross: bigint;
  lpYieldPool: bigint;
  maxLoss: bigint;
  cash: bigint;
  lockedProceeds: bigint;
  tvl: bigint;
  liability: bigint;
  floor: bigint;
  ceilingEquity: bigint;
  supply: bigint;
  floorRate: number;
  ceilingRate: number;
  b: bigint;
  bBase: bigint;
  liquidityGrowth: bigint;
  anchorSupply: number;
  qYes: bigint;
  qNo: bigint;
  rawQYes: bigint;
  rawQNo: bigint;
  decimals: number;
}

/**
 * Stable log-sum-exp LMSR cost function: C(q) = b * ln(e^(qYes/b) + e^(qNo/b))
 * Accepts bigint inputs (WAD), returns number.
 */
export function calculateMarketStatsCost(qYes: bigint, qNo: bigint, b: bigint): number {
  if (b === 0n) return 0;
  const bNum = Number(b) / 1e18;
  const qYesNum = Number(qYes) / 1e18;
  const qNoNum = Number(qNo) / 1e18;

  const x = qYesNum / bNum;
  const y = qNoNum / bNum;
  const max = x > y ? x : y;
  const diff = Math.abs(x - y);

  return bNum * (max + Math.log(1 + Math.exp(-diff)));
}

/**
 * Compute full market stats from on-chain data.
 * Pure function — no React dependencies.
 */
export function computeMarketStats(input: MarketStatsInput): MarketStats {
  const usdcDecimals = input.usdcDecimals ?? 18;
  const usdcFactor = BigInt(10 ** usdcDecimals);
  const wad = 1_000_000_000_000_000_000n;

  const seed = input.creatorDeposit;
  const fees = input.feesAccrued;
  const lpYieldPool = input.lpYieldPool;
  const bCurrent = input.currentBBase;
  const bBase = input.initialBBase;
  const rawQYes = input.qYes;
  const rawQNo = input.qNo;

  // 1. LMSR Cost Components
  const currentCostNum = calculateMarketStatsCost(rawQYes, rawQNo, bCurrent);
  const initialCostNum = calculateMarketStatsCost(0n, 0n, bCurrent);

  const pnlNum = currentCostNum - initialCostNum;
  const pnlStr = pnlNum.toFixed(usdcDecimals);
  const pnl = parseFixedToBigInt(pnlStr, usdcDecimals);

  // 2. Cash = MaxLoss + Yield + P&L. Max loss = the creator deposit, which is
  //    the LMSR worst case b·-ln(min(p,1-p)) and is passed in as `seed`. Using
  //    b·ln2 here would be wrong for skewed (non-50/50) markets and inconsistent
  //    with `gross` below, which already uses the real deposit.
  const maxLoss = seed;
  const cash = maxLoss + lpYieldPool + pnl;

  const gross = seed + fees + pnl;

  // 3. Liability = max(qYes, qNo)
  const qYesUsdc = usdcDecimals === 18 ? rawQYes : rawQYes / (wad / usdcFactor);
  const qNoUsdc = usdcDecimals === 18 ? rawQNo : rawQNo / (wad / usdcFactor);
  const liability = qYesUsdc > qNoUsdc ? qYesUsdc : qNoUsdc;

  // 4. Floor = Cash - max(qYes, qNo)
  const floor = cash > liability ? cash - liability : 0n;

  // 5. Ceiling = Cash - min(qYes, qNo)
  const minLiability = qYesUsdc < qNoUsdc ? qYesUsdc : qNoUsdc;
  const ceilingEquity = cash > minLiability ? cash - minLiability : 0n;

  // 6. Supply & Rates
  const supply = input.lpSupply;
  const supplyNum = Number(supply) / 1e18;
  const floorRate = supplyNum > 0 ? Number(floor) / 10 ** usdcDecimals / supplyNum : 0;
  const ceilingRate = supplyNum > 0 ? Number(ceilingEquity) / 10 ** usdcDecimals / supplyNum : 0;

  // 7. Anchor Supply
  const anchorSupply = (Number(bBase) / 1e18) * LN2;

  // 8. Liquidity growth
  const liquidityGrowth = bCurrent > bBase ? bCurrent - bBase : 0n;

  // 9. TVL
  const lockedProceeds = input.lockedProceeds ?? 0n;
  const tvl = cash + lockedProceeds;

  return {
    seed,
    fees,
    pnl,
    gross,
    lpYieldPool,
    maxLoss,
    cash,
    lockedProceeds,
    tvl,
    liability,
    floor,
    ceilingEquity,
    supply,
    floorRate,
    ceilingRate,
    b: bCurrent,
    bBase,
    liquidityGrowth,
    anchorSupply,
    qYes: qYesUsdc,
    qNo: qNoUsdc,
    rawQYes,
    rawQNo,
    decimals: usdcDecimals,
  };
}

/** Helper: parse a fixed-point string to bigint at given decimals */
function parseFixedToBigInt(str: string, decimals: number): bigint {
  const [intPart, fracPart = ''] = str.split('.');
  const paddedFrac = (fracPart + '0'.repeat(decimals)).slice(0, decimals);
  const negative = str.startsWith('-');
  const absInt = intPart.replace('-', '');
  const raw = BigInt(absInt + paddedFrac);
  return negative ? -raw : raw;
}
