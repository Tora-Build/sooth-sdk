import { useMemo, useState, useEffect, useCallback } from 'react';
import { useAccount, useReadContract, useReadContracts } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import {
  Wallet, ShieldCheck, TrendingUp, Clock,
  Database, Zap, Lock,
  Activity, CheckCircle
} from 'lucide-react';
import { Tooltip } from '../components/ui/Tooltip';
import { useChainStore } from '../store/useChainStore';
import { useDeployments } from '../hooks/useDeployments';
import { useAvailableBalance, useLockQueue, useTokenBalances, useOnChainMarkets } from '../hooks';
import { useAMMPositionDirect, useTickBookVaultDirect } from '../hooks';
import { usePortfolioIndexed, useMarketsIndexed } from '../hooks/indexer';
import { calculateLMSRCost, LN2 } from '../hooks/useMarketStatsMath';
import { Card } from '../components/ui/Card';
import { ERC20_ABI, ABIS } from '../config/abis';
import type { OnChainMarket } from '../hooks/useOnChainMarkets';

// --- Components ---

const EmptyState = ({ message }: { message: string }) => (
  <div className="p-10 text-center text-slate-600 font-mono text-xs opacity-40 uppercase tracking-[0.2em] leading-relaxed">
    {message}
  </div>
);

const AMMPositionRow = ({ market, price, onValueUpdate }: {
  market: OnChainMarket,
  price?: bigint,
  onValueUpdate?: (marketAddr: string, value: number) => void
}) => {
  const { data: position, isLoading } = useAMMPositionDirect(market.address as `0x${string}`);

  const yesShares = position?.yesShares ?? 0n;
  const noShares = position?.noShares ?? 0n;

  // Estimate value based on current AMM price
  const priceYes = price ? Number(formatUnits(price, 18)) : 0.5;
  const priceNo = 1 - priceYes;
  const valueUsd = (Number(formatUnits(yesShares, 18)) * priceYes) + (Number(formatUnits(noShares, 18)) * priceNo);

  useEffect(() => {
    if (!isLoading && onValueUpdate && (yesShares > 0n || noShares > 0n)) {
      onValueUpdate(market.address, valueUsd);
    } else if (!isLoading && onValueUpdate) {
      onValueUpdate(market.address, 0);
    }
  }, [isLoading, valueUsd, market.address, onValueUpdate, yesShares, noShares]);

  if (isLoading || (yesShares === 0n && noShares === 0n)) return null;

  return (
    <div className="bg-slate-900/40 rounded-lg p-3 border border-cyan-500/10 hover:border-cyan-500/30 transition-colors mb-2">
      <div className="flex justify-between items-start mb-2">
        <div className="text-xs font-bold text-white uppercase tracking-tight">{market.name}</div>
        <div className="text-xs font-mono text-slate-500">${valueUsd.toFixed(2)}</div>
      </div>
      <div className="flex gap-2">
        {yesShares > 0n && (
          <div className="flex-1 flex justify-between items-center bg-emerald-950/10 rounded px-2 py-1 border border-emerald-900/20">
            <span className="text-xs font-mono text-emerald-500">YES</span>
            <span className="text-xs font-mono font-bold text-white">{parseFloat(formatUnits(yesShares, 18)).toFixed(1)}</span>
          </div>
        )}
        {noShares > 0n && (
          <div className="flex-1 flex justify-between items-center bg-rose-950/10 rounded px-2 py-1 border border-rose-900/20">
            <span className="text-xs font-mono text-rose-500">NO</span>
            <span className="text-xs font-mono font-bold text-white">{parseFloat(formatUnits(noShares, 18)).toFixed(1)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

const LPPositionRow = ({ market, lpBalance, lpSupply, floorValue, bCurrent, qYes, qNo, decimals, onValueUpdate }: {
  market: OnChainMarket,
  lpBalance?: bigint,
  lpSupply?: bigint,
  floorValue?: bigint,
  bCurrent?: bigint,
  qYes?: bigint,
  qNo?: bigint,
  decimals: number,
  onValueUpdate?: (marketAddr: string, value: number) => void
}) => {
  const valueUsd = useMemo(() => {
    if (!lpBalance || !lpSupply || lpSupply === 0n) return 0;
    const userLpNum = Number(formatUnits(lpBalance, 18));
    const totalLpNum = Number(formatUnits(lpSupply, 18));

    // 1. Try to use direct floorValue from contract (works for un-graduated markets)
    if (floorValue && floorValue > 0n) {
      const rate = Number(formatUnits(floorValue, decimals)) / totalLpNum;
      return userLpNum * rate;
    }

    // 2. For graduated markets, calculate Floor = Cash - Liability via LMSR formula
    // This aligns with LPHolders / useMarketStatsMath logic
    if (bCurrent && bCurrent > 0n && qYes !== undefined && qNo !== undefined) {
      // Calculate Cash = MaxLoss + P&L (ignoring yield for now as it's small)
      // MaxLoss = b * ln(2)
      // P&L = C(q) - C(0)

      const currentCost = calculateLMSRCost(qYes, qNo, bCurrent);
      const initialCost = calculateLMSRCost(0n, 0n, bCurrent);
      const pnl = currentCost - initialCost;

      const bNum = Number(formatUnits(bCurrent, 18));
      const maxLoss = bNum * LN2;
      const cash = maxLoss + pnl;

      // Liability = max(qYes, qNo) in USDC terms (assuming 1 share = 1 USDC payout)
      const qYesNum = Number(formatUnits(qYes, 18));
      const qNoNum = Number(formatUnits(qNo, 18));
      const liability = Math.max(qYesNum, qNoNum);

      // Floor = Cash - Liability
      const floor = Math.max(0, cash - liability);
      const rate = floor / totalLpNum;
      return userLpNum * rate;
    }

    // 3. Fallback: Estimate Floor as Cash (b * ln(2)) if AMM state missing
    if (bCurrent && bCurrent > 0n) {
      const bNum = Number(formatUnits(bCurrent, 18));
      const cash = bNum * LN2;
      return userLpNum * (cash / totalLpNum);
    }

    return 0;
  }, [lpBalance, lpSupply, floorValue, bCurrent, qYes, qNo, decimals]);

  useEffect(() => {
    if (onValueUpdate) {
      onValueUpdate(market.address, valueUsd);
    }
  }, [valueUsd, market.address, onValueUpdate]);

  if (!lpBalance || lpBalance === 0n) return null;

  return (
    <div className="flex justify-between items-center p-3 bg-slate-900/40 rounded border border-slate-800/50 mb-2">
      <div className="flex items-center gap-3">
        <div className="text-xs font-bold text-white uppercase tracking-wider">{market.name}</div>
      </div>
      <div className="text-right">
        <div className="text-sm font-mono font-bold text-white">${valueUsd.toFixed(2)}</div>
        <div className="text-xs text-slate-500 font-mono">{parseFloat(formatUnits(lpBalance, 18)).toFixed(2)} LP</div>
      </div>
    </div>
  );
};



/**
 * TickBookInternalRow - Displays fills/outcomes earned inside the TickBookVault
 */
const TickBookInternalRow = ({ market, userAddress, price, onValueUpdate }: {
  market: OnChainMarket,
  userAddress: `0x${string}`,
  price?: bigint,
  onValueUpdate?: (marketAddr: string, value: number) => void
}) => {
  const { vault, isLoading } = useTickBookVaultDirect(userAddress, market.address as `0x${string}`);

  const yesInternal = vault?.yesInternal ?? 0n;
  const noInternal = vault?.noInternal ?? 0n;

  // Outcome: YES=1, NO=0 (V8.13.0 unified semantics)
  const yesPriceNum = price ? Number(price) / 1e18 : 0.5;
  const noPriceNum = 1 - yesPriceNum;

  const valueUsd = (Number(yesInternal) / 1e18 * yesPriceNum) + (Number(noInternal) / 1e18 * noPriceNum);

  useEffect(() => {
    if (!isLoading && onValueUpdate && (yesInternal > 0n || noInternal > 0n)) {
      onValueUpdate(market.address, valueUsd);
    }
  }, [isLoading, valueUsd, market.address, onValueUpdate, yesInternal, noInternal]);

  if (isLoading || (yesInternal === 0n && noInternal === 0n)) return null;

  return (
    <div className="bg-slate-900/40 rounded-lg p-3 border border-cyan-500/10 hover:border-cyan-500/30 transition-colors mb-2">
      <div className="flex justify-between items-start mb-2">
        <div className="text-xs font-bold text-white uppercase tracking-tight">{market.name}</div>
        <div className="text-xs font-mono text-slate-500">${valueUsd.toFixed(2)}</div>
      </div>
      <div className="flex gap-2">
        {yesInternal > 0n && (
          <div className="flex-1 flex justify-between items-center bg-emerald-950/10 rounded px-2 py-1 border border-emerald-900/20">
            <span className="text-xs font-mono text-emerald-500">YES</span>
            <span className="text-xs font-mono font-bold text-white">{parseFloat(formatUnits(yesInternal, 18)).toFixed(1)}</span>
          </div>
        )}
        {noInternal > 0n && (
          <div className="flex-1 flex justify-between items-center bg-rose-950/10 rounded px-2 py-1 border border-rose-900/20">
            <span className="text-xs font-mono text-rose-500">NO</span>
            <span className="text-xs font-mono font-bold text-white">{parseFloat(formatUnits(noInternal, 18)).toFixed(1)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

const LockedSharesRow = ({ market, userAddress, price, onValueUpdate }: {
  market: OnChainMarket,
  userAddress: `0x${string}`,
  price?: bigint,
  onValueUpdate?: (marketAddr: string, value: number) => void
}) => {
  const { vault, isLoading } = useTickBookVaultDirect(userAddress, market.address as `0x${string}`);
  const yesLocked = vault?.yesLocked ?? 0n;
  const noLocked = vault?.noLocked ?? 0n;

  const yesPriceNum = price ? Number(price) / 1e18 : 0.5;
  const noPriceNum = 1 - yesPriceNum;
  const valueUsd = (Number(yesLocked) / 1e18 * yesPriceNum) + (Number(noLocked) / 1e18 * noPriceNum);

  useEffect(() => {
    if (!isLoading && onValueUpdate) {
      onValueUpdate(market.address, valueUsd);
    }
  }, [isLoading, valueUsd, market.address, onValueUpdate]);

  if (isLoading || (yesLocked === 0n && noLocked === 0n)) return null;

  return (
    <div className="bg-slate-900/40 rounded-lg p-3 border border-amber-500/10 hover:border-amber-500/30 transition-colors mb-2">
      <div className="flex justify-between items-start mb-2">
        <div className="text-xs font-bold text-white uppercase tracking-tight">{market.name}</div>
        <div className="text-xs font-mono text-slate-500">${valueUsd.toFixed(2)}</div>
      </div>

      <div className="flex gap-2">
        {yesLocked > 0n && (
          <div className="flex-1 flex justify-between items-center bg-emerald-950/10 rounded px-2 py-1 border border-emerald-900/20">
            <span className="text-xs font-mono text-emerald-500">YES</span>
            <span className="text-xs font-mono font-bold text-white">{parseFloat(formatUnits(yesLocked, 18)).toFixed(1)}</span>
          </div>
        )}
        {noLocked > 0n && (
          <div className="flex-1 flex justify-between items-center bg-rose-950/10 rounded px-2 py-1 border border-rose-900/20">
            <span className="text-xs font-mono text-rose-500">NO</span>
            <span className="text-xs font-mono font-bold text-white">{parseFloat(formatUnits(noLocked, 18)).toFixed(1)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export const Portfolio = () => {
  useChainStore();
  const deployments = useDeployments();
  const ammEngineAddress = deployments?.contracts?.AMMEngine as `0x${string}`;
  const launchpadEngineAddress = deployments?.contracts?.LaunchpadEngine as `0x${string}`;
  const { address: userAddress } = useAccount();

  // Indexer hooks (primary data source when available)
  const indexedPortfolio = usePortfolioIndexed(userAddress);
  const indexedMarkets = useMarketsIndexed();
  const useIndexer = indexedPortfolio.isIndexerReady && indexedMarkets.isIndexerReady;

  // 1. Core Account Balances (from Engine) - RPC fallback
  useAvailableBalance(ammEngineAddress);

  // 2. Lock Queue (Pending Unlocks) - RPC fallback
  const rpcLockQueue = useLockQueue(ammEngineAddress);
  const queue = useIndexer
    ? indexedPortfolio.lockEntries.map(e => ({
      amount: BigInt(e.amountWad),
      expiryDate: new Date(Number(e.unlockTime) * 1000),
      isUnlocked: Date.now() >= Number(e.unlockTime) * 1000,
      timeUntilUnlock: Math.max(0, Number(e.unlockTime) * 1000 - Date.now()),
    }))
    : rpcLockQueue.entries;
  const queueTotal = useIndexer
    ? indexedPortfolio.lockEntries.reduce((acc, e) => acc + BigInt(e.amountWad), 0n)
    : rpcLockQueue.totalLocked;
  const queueTotalFormatted = formatUnits(queueTotal, 18);

  // 3. Pro Account Balances (from TickBookVault) - always RPC (indexer can't track accurately)
  const rpcVault = useTickBookVaultDirect(userAddress, undefined);
  const proAvailableWad = rpcVault.vault?.availableUsdcWad ?? 0n;
  const proReservedWad = rpcVault.vault?.reservedUsdcWad ?? 0n;
  const proAvailableFormatted = formatUnits(proAvailableWad, 18);
  const proReservedFormatted = formatUnits(proReservedWad, 18);
  const isLoadingProVault = rpcVault.isLoading;

  // 4. Markets Data for Aggregation - prefer indexer for addresses, RPC for names
  // The indexer doesn't store market names, so we always use RPC for name/symbol
  const rpcMarkets = useOnChainMarkets();
  const onChainMarkets: OnChainMarket[] = useMemo(() => {
    // Always prefer RPC markets since they include the full name from contract
    // Indexer is still used for other portfolio data (positions, LP balances, etc.)
    return rpcMarkets.markets;
  }, [rpcMarkets.markets]);

  const [lpValues, setLpValues] = useState<Record<string, number>>({});
  const [ammValues, setAmmValues] = useState<Record<string, number>>({});
  const [vaultSharesValues, setVaultSharesValues] = useState<Record<string, number>>({});
  const [lockedSharesValues, setLockedSharesValues] = useState<Record<string, number>>({});

  const totalLpVal = useMemo(() => Object.values(lpValues).reduce((a, b) => a + b, 0), [lpValues]);
  const totalAmmVal = useMemo(() => Object.values(ammValues).reduce((a, b) => a + b, 0), [ammValues]);
  const totalVaultSharesVal = useMemo(() => Object.values(vaultSharesValues).reduce((a, b) => a + b, 0), [vaultSharesValues]);
  const totalLockedSharesVal = useMemo(() => Object.values(lockedSharesValues).reduce((a, b) => a + b, 0), [lockedSharesValues]);

  const handleLpValueUpdate = useCallback((addr: string, val: number) => {
    setLpValues(prev => prev[addr] === val ? prev : { ...prev, [addr]: val });
  }, []);
  const handleAmmValueUpdate = useCallback((addr: string, val: number) => {
    setAmmValues(prev => prev[addr] === val ? prev : { ...prev, [addr]: val });
  }, []);
  const handleVaultSharesUpdate = useCallback((addr: string, val: number) => {
    setVaultSharesValues(prev => prev[addr] === val ? prev : { ...prev, [addr]: val });
  }, []);
  const handleLockedSharesUpdate = useCallback((addr: string, val: number) => {
    setLockedSharesValues(prev => prev[addr] === val ? prev : { ...prev, [addr]: val });
  }, []);

  const totalActiveCollateral = parseFloat(proReservedFormatted) + totalLockedSharesVal;

  // 4. Wallet Balance & Decimals
  const usdcAddress = deployments?.contracts?.MockUSDC as `0x${string}`;
  const { balances } = useTokenBalances(usdcAddress ? [usdcAddress] : []);
  const walletUsdc = balances[0] ?? 0n;

  const { data: usdcDecimals } = useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: 'decimals',
    query: { enabled: !!usdcAddress, staleTime: Infinity, refetchInterval: false },
  });
  const decimals = Number(usdcDecimals ?? 18);

  // Batch Read: Market Prices, Internal Shares, LP Balances
  const { data: batchData, isLoading: isLoadingBatch } = useReadContracts({
    contracts: onChainMarkets.flatMap(m => [
      { address: ammEngineAddress, abi: ABIS.AMMEngine, functionName: 'getMarketState', args: [m.address] },
      { address: ammEngineAddress, abi: ABIS.AMMEngine, functionName: 'getPosition', args: [m.address, userAddress] },
      { address: launchpadEngineAddress, abi: ABIS.LaunchpadEngine, functionName: 'getLPBalance', args: [m.address, userAddress] },
      { address: launchpadEngineAddress, abi: ABIS.LaunchpadEngine, functionName: 'getMarketState', args: [m.address] }
    ]),
    query: { enabled: !!userAddress && !!ammEngineAddress && !!launchpadEngineAddress && onChainMarkets.length > 0 }
  });

  // Aggregate values
  const aggregates = useMemo(() => {
    if (!batchData || batchData.length === 0) return { lpValue: 0, ammValue: 0, hasAnyLpBalance: false };
    let lpValue = 0;
    let ammValue = 0;
    let hasAnyLpBalance = false;

    for (let i = 0; i < onChainMarkets.length; i++) {
      const baseIdx = i * 4;
      const priceResult = batchData[baseIdx]?.result as readonly [bigint, bigint, bigint];
      const sharesResult = batchData[baseIdx + 1]?.result as readonly [bigint, bigint];
      const lpBalResult = batchData[baseIdx + 2]?.result as bigint;
      const lpStateResult = batchData[baseIdx + 3]?.result as any;

      // Price is the 3rd element in getMarketState return
      const price = priceResult?.[2] ?? parseUnits('0.5', 18);
      const priceYes = Number(formatUnits(price, 18));
      const priceNo = 1 - priceYes;

      if (sharesResult && Array.isArray(sharesResult)) {
        const yesShares = Number(formatUnits(sharesResult[0] || 0n, 18));
        const noShares = Number(formatUnits(sharesResult[1] || 0n, 18));
        ammValue += (yesShares * priceYes) + (noShares * priceNo);
      }

      if (lpBalResult && lpBalResult > 0n) {
        hasAnyLpBalance = true;
      }

      if (lpBalResult && lpStateResult) {
        // totalLPSupply is index 3, floorValue is index 5
        const lpSupply = lpStateResult[3] as bigint;
        const floorValue = lpStateResult[5] as bigint;
        if (lpSupply && lpSupply > 0n) {
          const userLpNum = Number(formatUnits(lpBalResult, 18));
          const totalLpNum = Number(formatUnits(lpSupply, 18));
          const floorRate = Number(formatUnits(floorValue, decimals)) / totalLpNum;
          lpValue += userLpNum * floorRate;
        }
      }
    }
    return { lpValue, ammValue, hasAnyLpBalance };
  }, [batchData, onChainMarkets, decimals]);

  const walletUsdcFormatted = formatUnits(walletUsdc, decimals);

  // Account Aggregates
  const selfCustodyTotal = parseFloat(walletUsdcFormatted) + totalLpVal + totalAmmVal + parseFloat(queueTotalFormatted);
  const proVaultTotal = parseFloat(proAvailableFormatted) + parseFloat(proReservedFormatted) + totalVaultSharesVal + totalLockedSharesVal;

  // Helper to extract specific market price from batch
  const getMarketPrice = (marketAddr: string) => {
    const idx = onChainMarkets.findIndex(m => m.address === marketAddr);
    if (idx === -1 || !batchData) return undefined;
    return (batchData[idx * 4]?.result as any)?.[2];
  };

  return (
    <div className="min-h-dvh pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Account Summaries */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">

          {/* Wallet Assets (External) */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                <Wallet className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <Tooltip
                  content="Self-custody assets you control directly: wallet USDC, LP shares from AMM pools, and outcome tokens from trading."
                  position="right"
                  showIcon={true}
                >
                  <h2 className="text-lg font-bold text-white uppercase tracking-wider leading-none">Wallet</h2>
                </Tooltip>
              </div>
            </div>

            <Card className="bg-gradient-to-br from-emerald-950/20 to-slate-950 border-emerald-500/20 p-6 min-h-[240px] flex flex-col justify-between">
              <div className="mb-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="text-xs text-emerald-500/80 font-bold flex items-center gap-2 uppercase tracking-tighter">
                    <ShieldCheck className="w-3 h-3" /> Total Net Value
                  </div>
                </div>
                <div className="text-4xl font-mono font-bold text-white tracking-tight">
                  ${selfCustodyTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-900/40 rounded p-2.5 border border-slate-800/50">
                  <div className="text-xs text-slate-500 font-bold mb-1 flex items-center gap-1 uppercase">
                    <TrendingUp className="w-2.5 h-2.5" /> LP Shares
                  </div>
                  <div className="font-mono text-white font-bold text-sm">
                    ${totalLpVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="bg-slate-900/40 rounded p-2.5 border border-slate-800/50">
                  <div className="text-xs text-slate-500 font-bold mb-1 flex items-center gap-1 uppercase">
                    <ShieldCheck className="w-2.5 h-2.5" /> Owned Shares
                  </div>
                  <div className="font-mono text-white font-bold text-sm">
                    ${totalAmmVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="bg-slate-900/40 rounded p-2.5 border border-slate-800/50">
                  <div className="text-xs text-slate-500 font-bold mb-1 flex items-center gap-1 uppercase">
                    <Clock className="w-2.5 h-2.5" /> Pending Exits
                  </div>
                  <div className="font-mono text-white font-bold text-sm">
                    ${parseFloat(queueTotalFormatted).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="bg-slate-900/40 rounded p-2.5 border border-slate-800/50">
                  <div className="text-xs text-slate-500 font-bold mb-1 flex items-center gap-1 uppercase">
                    <Wallet className="w-2.5 h-2.5" /> USDC
                  </div>
                  <div className="font-mono text-slate-400 font-bold text-sm">
                    ${parseFloat(walletUsdcFormatted).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* TickBook Vault (Isolated Margin) */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                <Database className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <Tooltip
                  content="Protocol-managed vault for orderbook trading: available USDC, collateral backing active orders, and settled outcome tokens."
                  position="right"
                  showIcon={true}
                >
                  <h2 className="text-lg font-bold text-white uppercase tracking-wider leading-none">TickBook Vault</h2>
                </Tooltip>
              </div>
            </div>

            <Card className="bg-gradient-to-br from-cyan-950/40 to-slate-950 border-cyan-500/20 p-6 min-h-[240px] flex flex-col justify-between">
              <div className="mb-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="text-xs text-cyan-300 font-bold flex items-center gap-2 uppercase tracking-tighter">
                    <Database className="w-3 h-3" /> Total Vault Value
                    {isLoadingProVault && <div className="animate-spin w-2 h-2 border-2 border-cyan-500 border-t-transparent rounded-full" />}
                  </div>
                </div>
                <div className="text-4xl font-mono font-bold text-white tracking-tight">
                  ${proVaultTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-900/40 rounded p-2.5 border border-slate-800/50">
                  <div className="text-xs text-slate-500 font-bold mb-1 flex items-center gap-1 uppercase">
                    <Activity className="w-2.5 h-2.5" /> Owned Shares
                  </div>
                  <div className="font-mono text-white font-bold text-sm">
                    ${totalVaultSharesVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="bg-slate-900/40 rounded p-2.5 border border-slate-800/50">
                  <div className="text-xs text-slate-500 font-bold mb-1 flex items-center gap-1 uppercase">
                    <Lock className="w-2.5 h-2.5" /> Active Collateral
                  </div>
                  <div className="font-mono text-white font-bold text-sm">
                    ${totalActiveCollateral.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="bg-slate-900/40 rounded p-2.5 border border-slate-800/50">
                  <div className="text-xs text-slate-500 font-bold mb-1 flex items-center gap-1 uppercase">
                    <Database className="w-2.5 h-2.5" /> Unused USDC
                  </div>
                  <div className="font-mono text-slate-400 font-bold text-sm">
                    ${parseFloat(proAvailableFormatted).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* AMM DASHBOARD (LEFT) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <Zap className="w-3 h-3 text-emerald-500" />
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">AMM & Bonding Curve Details</h3>
              </div>
              <div className="h-px flex-1 bg-slate-800/50 mx-4" />
            </div>

            {/* LP Shares */}
            <Card className="p-0 border-cyan-500/20 bg-slate-950/30 overflow-hidden">
              <div className="px-4 py-3 bg-cyan-950/20 border-b border-cyan-500/10 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">LP Shares</h3>
                </div>
                <div className="text-white font-mono font-bold text-sm">
                  ${totalLpVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="p-4">
                {onChainMarkets.length > 0 ? (
                  onChainMarkets.map((market, i) => {
                    const baseIdx = i * 4;
                    return (
                      <LPPositionRow
                        key={market.address}
                        market={market}
                        lpBalance={batchData?.[baseIdx + 2]?.result as bigint}
                        lpSupply={(batchData?.[baseIdx + 3]?.result as any)?.[3]}
                        floorValue={(batchData?.[baseIdx + 3]?.result as any)?.[5]}
                        bCurrent={(batchData?.[baseIdx + 3]?.result as any)?.[2]}
                        qYes={(batchData?.[baseIdx + 0]?.result as any)?.[0]}
                        qNo={(batchData?.[baseIdx + 0]?.result as any)?.[1]}
                        decimals={decimals}
                        onValueUpdate={handleLpValueUpdate}
                      />
                    );
                  })
                ) : (
                  <EmptyState message="No liquidity positions found" />
                )}
                {aggregates.lpValue === 0 && !aggregates.hasAnyLpBalance && !isLoadingBatch && onChainMarkets.length > 0 && (
                  <div className="mt-[-8px]">
                    <EmptyState message="No active liquidity" />
                  </div>
                )}
              </div>
            </Card>

            {/* Owned Shares (Consolidated) */}
            <Card className="p-0 border-emerald-500/20 bg-slate-950/30 overflow-hidden">
              <div className="px-4 py-3 bg-emerald-950/20 border-b border-emerald-500/10 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Owned Shares</h3>
                </div>
                <div className="text-white font-mono font-bold text-sm">
                  ${totalAmmVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="p-4">
                {onChainMarkets.length > 0 ? (
                  <>
                    {onChainMarkets.map(market => (
                      <AMMPositionRow
                        key={`amm-${market.address}`}
                        market={market}
                        price={getMarketPrice(market.address)}
                        onValueUpdate={handleAmmValueUpdate}
                      />
                    ))}
                  </>
                ) : (
                  <EmptyState message="No markets tracked" />
                )}
                {totalAmmVal === 0 && !isLoadingBatch && (
                  <div className="mt-[-8px]">
                    <EmptyState message="No owned shares found" />
                  </div>
                )}
              </div>
            </Card>

            {/* Pending Exits */}
            <Card className="p-0 border-slate-500/20 bg-slate-950/30 overflow-hidden">
              <div className="px-4 py-3 bg-slate-950/10 border-b border-slate-500/10 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Pending Exits</h3>
                </div>
                <div className="text-white font-mono font-bold text-sm">
                  ${parseFloat(queueTotalFormatted).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="p-4 space-y-3">
                {(queue || []).length === 0 ? (
                  <EmptyState message="No pending unlocks found" />
                ) : (
                  (queue || []).map((item, idx) => {
                    const isUnlocked = item.isUnlocked;
                    return (
                      <div key={idx} className="flex justify-between items-center p-3 bg-slate-900/40 rounded-xl border border-slate-800/80 hover:border-slate-500/30 transition-all group">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono font-bold text-white tracking-tight">
                              {parseFloat(formatUnits(item.amount, 18)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                            </span>
                            <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">USDC</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-tight">
                            {isUnlocked ? (
                              <span className="text-emerald-500 flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" /> Ready to Claim
                              </span>
                            ) : (
                              <span className="text-slate-500 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {item.expiryDate.toLocaleDateString()} {item.expiryDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`text-xs px-2 py-0.5 rounded font-black uppercase tracking-widest ${isUnlocked ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-500/20 text-slate-400 border border-slate-500/20'}`}>
                            {isUnlocked ? 'Liquid' : 'Locked'}
                          </span>
                          {!isUnlocked && (
                            <div className="text-[8px] text-slate-600 font-mono">
                              {item.timeUntilUnlock < 86400000
                                ? `${Math.ceil(item.timeUntilUnlock / 3600000)}h remaining`
                                : `${Math.ceil(item.timeUntilUnlock / 86400000)}d remaining`
                              }
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          </div>

          {/* PRO DASHBOARD (RIGHT) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <Activity className="w-3 h-3 text-cyan-500" />
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Pro Trading Details</h3>
              </div>
              <div className="h-px flex-1 bg-slate-800/50 mx-4" />
            </div>

            {/* Pro Vault Owned Shares */}
            <Card className="p-0 border-cyan-500/20 bg-slate-950/30 overflow-hidden">
              <div className="px-4 py-3 bg-cyan-950/20 border-b border-cyan-500/10 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Owned Shares</h3>
                </div>
                <div className="text-white font-mono font-bold text-sm">
                  ${totalVaultSharesVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="p-4">
                {onChainMarkets.length > 0 ? (
                  <>
                    {onChainMarkets.map(market => (
                      <TickBookInternalRow
                        key={market.address}
                        market={market}
                        userAddress={userAddress!}
                        price={getMarketPrice(market.address)}
                        onValueUpdate={handleVaultSharesUpdate}
                      />
                    ))}
                    {totalVaultSharesVal === 0 && !isLoadingBatch && (
                      <EmptyState message="No vault shares found" />
                    )}
                  </>
                ) : (
                  <EmptyState message="No markets tracked" />
                )}
              </div>
            </Card>

            {/* Active Collateral (Reserved USDC + Locked Shares) */}
            <Card className="p-0 border-cyan-500/20 bg-slate-950/30 overflow-hidden">
              <div className="px-4 py-3 bg-cyan-950/20 border-b border-cyan-500/10 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Active Collateral</h3>
                </div>
                <div className="text-white font-mono font-bold text-sm">
                  ${totalActiveCollateral.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="p-4 bg-slate-900/20">
                {proReservedWad > 0n && (
                  <div className="flex justify-between items-center p-3 bg-slate-900/40 rounded border border-slate-800/50 mb-3">
                    <div className="flex items-center gap-3">
                      <Database className="w-4 h-4 text-slate-400" />
                      <div>
                        <div className="text-xs font-bold text-white uppercase tracking-wider">Reserved USDC</div>
                        <div className="text-xs font-mono text-slate-500/80">For Range Buy Orders</div>
                      </div>
                    </div>
                    <div className="text-sm font-mono font-bold text-white">
                      ${parseFloat(proReservedFormatted).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                )}
                {onChainMarkets.map(market => (
                  <LockedSharesRow
                    key={market.address}
                    market={market}
                    userAddress={userAddress!}
                    price={getMarketPrice(market.address)}
                    onValueUpdate={handleLockedSharesUpdate}
                  />
                ))}
                {proReservedWad === 0n && totalLockedSharesVal === 0 && (
                  <EmptyState message="No active collateral" />
                )}
              </div>
            </Card>

            {/* Dashboard Legend / Status */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Security Model</h4>
                  <p className="text-xs text-slate-500 uppercase">Architecture Version: V10.8 Atomic Creation</p>
                </div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Sooth V10.8 uses atomic market creation with spot-first price discovery. Markets are created via Launchpad Engine (`{launchpadEngineAddress?.slice(0, 6)}...`) in a single transaction. The TickBook orderbook provides deep liquidity with range orders and spot sells crossing at best available prices.
              </p>
              <div className="flex items-center gap-4 pt-4 border-t border-slate-800">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xs text-slate-500 uppercase font-bold">{onChainMarkets.length} Active Markets</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-cyan-500" />
                  <span className="text-xs text-slate-500 uppercase font-bold">Pro Hardened</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
