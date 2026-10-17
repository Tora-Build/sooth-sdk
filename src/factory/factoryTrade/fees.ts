/** Factory v7.1 fee arithmetic. Amounts are WAD in engines, native in vaults. */
export interface AmmForecastConfig {
  feeBps: number;
  capitalBps: number;
  lpBps: number;
  resolutionBps: number;
  operatorBps: number;
}
export function validateAmmConfig(c: AmmForecastConfig) {
  const values = Object.values(c);
  if (
    values.some((v) => !Number.isInteger(v) || v < 0 || v > 10000) ||
    c.capitalBps + c.lpBps + c.resolutionBps + c.operatorBps !== 10000
  )
    throw new Error('AMM allocation must total 10000 bps; each rate must be an integer in range');
}
function unit(decimals: number) {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18)
    throw new Error('Unsupported pinned decimals');
  return 10n ** BigInt(18 - decimals);
}

/** Invert PositionTraded.cost. Sells can have several valid WAD bases; use the
 * upper bound. This does not recover the engine's interval quote or LP ledger. */
export function reconstructAmmBaseCost(costWad: bigint, side: 'buy' | 'sell', feeBps: number) {
  if (costWad < 0n || !Number.isInteger(feeBps) || feeBps < 0 || feeBps > 10000)
    throw new Error('Invalid AMM event cost or fee rate');
  const rate = BigInt(feeBps);
  if (side === 'sell' && rate === 10000n)
    throw new Error('A maximum-rate sell base cost cannot be reconstructed');
  const denominator = side === 'buy' ? 10000n + rate : 10000n - rate;
  const base =
    side === 'buy'
      ? (costWad * 10000n + denominator - 1n) / denominator
      : (costWad * 10000n) / denominator;
  const fee = (base * rate) / 10000n;
  if ((side === 'buy' ? base + fee : base - fee) !== costWad)
    throw new Error('Event cost does not match the pinned AMM rate');
  return base;
}
export function allocateAmmFee(baseCostWad: bigint, c: AmmForecastConfig, decimals: number) {
  validateAmmConfig(c);
  if (baseCostWad < 0n) throw new Error('Negative base cost');
  const u = unit(decimals),
    feeWad = (baseCostWad * BigInt(c.feeBps)) / 10000n;
  const capitalWad = (feeWad * BigInt(c.capitalBps)) / 10000n;
  const revenueNative = (feeWad - capitalWad) / u;
  const d = BigInt(10000 - c.capitalBps);
  const lpNative = d === 0n ? 0n : (revenueNative * BigInt(c.lpBps)) / d;
  const resolutionNative = d === 0n ? 0n : (revenueNative * BigInt(c.resolutionBps)) / d;
  return {
    feeWad,
    capitalWad,
    revenueNative,
    lpNative,
    resolutionNative,
    operatorNative: revenueNative - lpNative - resolutionNative,
    remainderWad: feeWad - capitalWad - revenueNative * u,
  };
}
/** basisWad is the SUM of min(p, 1-p) * q for ONE taker action. */
export function allocateBookFee(
  basisWad: bigint,
  rateBps: number,
  resolutionBps: number,
  decimals: number,
) {
  if (
    basisWad < 0n ||
    [rateBps, resolutionBps].some((v) => !Number.isInteger(v) || v < 0 || v > 10000)
  )
    throw new Error('Invalid book input');
  const denominator = 10000n * unit(decimals),
    numerator = basisWad * BigInt(rateBps);
  const feeNative = (numerator + denominator - 1n) / denominator;
  const resolutionNative = (feeNative * BigInt(resolutionBps)) / 10000n;
  return {
    feeNative,
    resolutionNative,
    protocolNative: feeNative - resolutionNative,
  };
}
