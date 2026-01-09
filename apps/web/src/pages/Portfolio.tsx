import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useAccount, useReadContract, useReadContracts } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { Link } from 'react-router-dom';
import {
  PlusCircle, Wallet, ShieldCheck, TrendingUp, TrendingDown, Clock,
  ArrowUpRight, ArrowDownRight, Database, Zap, Lock,
  ChevronRight, BadgeInfo, AlertTriangle, ShieldAlert,
  HelpCircle, Info, Activity, History, ArrowRight,
  ExternalLink, User, CheckCircle
} from 'lucide-react';
import { Tooltip } from '../components/ui/Tooltip';
import { useChainStore } from '../store/useChainStore';
import { useDeployments } from '../hooks/useDeployments';
import { useAvailableBalance, useLockQueue, useTokenBalances } from '../hooks';
import { useDirectRead, readContractSafe, useAMMPositionDirect, useTickBookVaultDirect } from '../hooks';
import { useMarketStatsMath } from '../hooks/useMarketStatsMath';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { ERC20_ABI, ABIS } from '../config/abis';
import marketsConfigRaw from '../config/markets.json';
import { MarketConfig, MarketsConfigJson } from '../types';

const marketsConfig = marketsConfigRaw as MarketsConfigJson;

const CURRENT_VERSION_PREFIX = 'v10.7'; // Current canonical version

// --- Components ---

const EmptyState = ({ message }: { message: string }) => (
  <div className="p-10 text-center text-slate-600 font-mono text-[10px] opacity-40 uppercase tracking-[0.2em] leading-relaxed">
    {message}
  </div>
);

/**
 * AMMPositionRow - Displays internal shares from AMMEngine
 */
const AMMPositionRow = ({ market, userAddress, ammEngineAddress, price, onValueUpdate }: {
  market: MarketConfig,
  userAddress: `0x${string}`,
  ammEngineAddress: `0x${string}`,
  price?: bigint,
  onValueUpdate?: (marketAddr: string, value: number) => void
}) => {
  const { data: position, isLoading } = useAMMPositionDirect(market.contractAddress as `0x${string}`);

  const yesShares = position?.yesShares ?? 0n;
  const noShares = position?.noShares ?? 0n;

  // Estimate value based on current AMM price
  const priceYes = price ? Number(formatUnits(price, 18)) : 0.5;
  const priceNo = 1 - priceYes;
  const valueUsd = (Number(formatUnits(yesShares, 18)) * priceYes) + (Number(formatUnits(noShares, 18)) * priceNo);

  useEffect(() => {
    if (!isLoading && onValueUpdate && (yesShares > 0n || noShares > 0n)) {
      onValueUpdate(market.contractAddress, valueUsd);
    } else if (!isLoading && onValueUpdate) {
      onValueUpdate(market.contractAddress, 0);
    }
  }, [isLoading, valueUsd, market.contractAddress, onValueUpdate, yesShares, noShares]);

  if (isLoading || (yesShares === 0n && noShares === 0n)) return null;

  return (
    <div className="bg-slate-900/40 rounded-lg p-3 border border-indigo-500/10 hover:border-indigo-500/30 transition-colors mb-2">
      <div className="flex justify-between items-start mb-2">
        <div className="text-[10px] font-bold text-white uppercase tracking-tight">{market.name} Internal</div>
        <div className="text-[10px] font-mono text-slate-500">${valueUsd.toFixed(2)}</div>
      </div>
      <div className="flex gap-2">
        {yesShares > 0n && (
          <div className="flex-1 flex justify-between items-center bg-emerald-950/10 rounded px-2 py-1 border border-emerald-900/20">
            <span className="text-[10px] font-mono text-emerald-500">YES</span>
            <span className="text-[10px] font-mono font-bold text-white">{parseFloat(formatUnits(yesShares, 18)).toFixed(1)}</span>
          </div>
        )}
        {noShares > 0n && (
          <div className="flex-1 flex justify-between items-center bg-rose-950/10 rounded px-2 py-1 border border-rose-900/20">
            <span className="text-[10px] font-mono text-rose-500">NO</span>
            <span className="text-[10px] font-mono font-bold text-white">{parseFloat(formatUnits(noShares, 18)).toFixed(1)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * LPPositionRow - Displays LP balance and its USDC value
 */
const LPPositionRow = ({ market, userAddress, lpBalance, lpSupply, floorValue, decimals, onValueUpdate }: {
  market: MarketConfig,
  userAddress: `0x${string}`,
  lpBalance?: bigint,
  lpSupply?: bigint,
  floorValue?: bigint,
  decimals: number,
  onValueUpdate?: (marketAddr: string, value: number) => void
}) => {
  const valueUsd = useMemo(() => {
    if (!lpBalance || !lpSupply || lpSupply === 0n || !floorValue) return 0;
    const userLpNum = Number(formatUnits(lpBalance, 18));
    const totalLpNum = Number(formatUnits(lpSupply, 18));
    const floorRate = Number(formatUnits(floorValue, decimals)) / totalLpNum;
    return userLpNum * floorRate;
  }, [lpBalance, lpSupply, floorValue, decimals]);

  useEffect(() => {
    if (onValueUpdate) {
      onValueUpdate(market.contractAddress, valueUsd);
    }
  }, [valueUsd, market.contractAddress, onValueUpdate]);

  if (!lpBalance || lpBalance === 0n) return null;

  return (
    <div className="flex justify-between items-center p-3 bg-slate-900/40 rounded border border-slate-800/50 mb-2">
      <div className="flex items-center gap-3">
        <TrendingUp className="w-4 h-4 text-cyan-400" />
        <div>
          <div className="text-xs font-bold text-white uppercase tracking-wider">{market.name}</div>
          <div className="text-[10px] font-mono text-cyan-500/80">LIQUIDITY POOL</div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-mono font-bold text-white">{parseFloat(formatUnits(lpBalance, 18)).toFixed(2)} LP</div>
        <div className="text-[10px] text-slate-500 font-mono">${valueUsd.toFixed(2)}</div>
      </div>
    </div>
  );
};

/**
 * OutcomeTokenRow - Displays ERC20 tokens in wallet
 */
const OutcomeTokenRow = ({ market, userAddress, price, onValueUpdate }: {
  market: MarketConfig,
  userAddress: `0x${string}`,
  price?: bigint,
  onValueUpdate?: (marketAddr: string, value: number) => void
}) => {
  const { data: balances } = useReadContracts({
    contracts: [
      {
        address: market.yesToken as `0x${string}`,
        abi: ABIS.OutcomeToken,
        functionName: 'balanceOf',
        args: [userAddress],
      },
      {
        address: market.noToken as `0x${string}`,
        abi: ABIS.OutcomeToken,
        functionName: 'balanceOf',
        args: [userAddress],
      }
    ],
    query: { enabled: !!market.yesToken && !!market.noToken && !!userAddress }
  });

  const yesBalance = balances?.[0]?.result as bigint ?? 0n;
  const noBalance = balances?.[1]?.result as bigint ?? 0n;

  // Use price for YES, (1-price) for NO
  const yesPriceNum = price ? Number(price) / 1e18 : 0.5;
  const noPriceNum = 1 - yesPriceNum;

  const valueUsd = (Number(yesBalance) / 1e18 * yesPriceNum) + (Number(noBalance) / 1e18 * noPriceNum);

  useEffect(() => {
    if (onValueUpdate) {
      onValueUpdate(market.contractAddress, valueUsd);
    }
  }, [valueUsd, market.contractAddress, onValueUpdate]);

  if (yesBalance === 0n && noBalance === 0n) return null;

  return (
    <div className="bg-slate-900/40 rounded-lg p-3 border border-indigo-500/10 hover:border-indigo-500/30 transition-colors mb-2">
      <div className="flex justify-between items-start mb-2">
        <div className="text-[10px] font-bold text-white uppercase tracking-tight">{market.name}</div>
        <div className="text-[10px] font-mono text-slate-500">${valueUsd.toFixed(2)}</div>
      </div>
      <div className="flex gap-2">
        {yesBalance > 0n && (
          <div className="flex-1 flex justify-between items-center bg-emerald-950/10 rounded px-2 py-1 border border-emerald-900/20">
            <span className="text-[10px] font-mono text-emerald-500">YES</span>
            <span className="text-[10px] font-mono font-bold text-white">{parseFloat(formatUnits(yesBalance, 18)).toFixed(1)}</span>
          </div>
        )}
        {noBalance > 0n && (
          <div className="flex-1 flex justify-between items-center bg-rose-950/10 rounded px-2 py-1 border border-rose-900/20">
            <span className="text-[10px] font-mono text-rose-500">NO</span>
            <span className="text-[10px] font-mono font-bold text-white">{parseFloat(formatUnits(noBalance, 18)).toFixed(1)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * TickBookInternalRow - Displays fills/outcomes earned inside the TickBookVault
 */
const TickBookInternalRow = ({ market, userAddress, price, onValueUpdate }: {
  market: MarketConfig,
  userAddress: `0x${string}`,
  price?: bigint,
  onValueUpdate?: (marketAddr: string, value: number) => void
}) => {
  const { vault, isLoading } = useTickBookVaultDirect(userAddress, market.contractAddress as `0x${string}`);

  const yesInternal = vault?.yesInternal ?? 0n;
  const noInternal = vault?.noInternal ?? 0n;

  // Outcome: YES=1, NO=0 (V8.13.0 unified semantics)
  const yesPriceNum = price ? Number(price) / 1e18 : 0.5;
  const noPriceNum = 1 - yesPriceNum;

  const valueUsd = (Number(yesInternal) / 1e18 * yesPriceNum) + (Number(noInternal) / 1e18 * noPriceNum);

  useEffect(() => {
    if (!isLoading && onValueUpdate && (yesInternal > 0n || noInternal > 0n)) {
      onValueUpdate(market.contractAddress, valueUsd);
    }
  }, [isLoading, valueUsd, market.contractAddress, onValueUpdate, yesInternal, noInternal]);

  if (isLoading || (yesInternal === 0n && noInternal === 0n)) return null;

  return (
    <div className="bg-slate-900/40 rounded-lg p-3 border border-indigo-500/10 hover:border-indigo-500/30 transition-colors mb-2">
      <div className="flex justify-between items-start mb-2">
        <div className="text-[10px] font-bold text-white uppercase tracking-tight">{market.name} Position</div>
        <div className="text-[10px] font-mono text-slate-500">${valueUsd.toFixed(2)}</div>
      </div>
      <div className="flex gap-2">
        {yesInternal > 0n && (
          <div className="flex-1 flex justify-between items-center bg-emerald-950/10 rounded px-2 py-1 border border-emerald-900/20">
            <span className="text-[10px] font-mono text-emerald-500">YES</span>
            <span className="text-[10px] font-mono font-bold text-white">{parseFloat(formatUnits(yesInternal, 18)).toFixed(1)}</span>
          </div>
        )}
        {noInternal > 0n && (
          <div className="flex-1 flex justify-between items-center bg-rose-950/10 rounded px-2 py-1 border border-rose-900/20">
            <span className="text-[10px] font-mono text-rose-500">NO</span>
            <span className="text-[10px] font-mono font-bold text-white">{parseFloat(formatUnits(noInternal, 18)).toFixed(1)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * ProMarginRow - Displays margin reserved for a specific market
 */
const ProMarginRow = ({ market, userAddress }: {
  market: MarketConfig,
  userAddress: `0x${string}`
}) => {
  const { vault, isLoading } = useTickBookVaultDirect(userAddress, market.contractAddress as `0x${string}`);
  const reserved = vault?.reservedUsdcWad ?? 0n;

  if (isLoading || reserved === 0n) return null;

  return (
    <div className="flex justify-between items-center p-3 bg-slate-900/40 rounded border border-slate-800/50 mb-2">
      <div className="flex items-center gap-3">
        <Lock className="w-4 h-4 text-amber-400" />
        <div>
          <div className="text-xs font-bold text-white uppercase tracking-wider">{market.name}</div>
          <div className="text-[10px] font-mono text-amber-500/80">RESERVED MARGIN</div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-mono font-bold text-white">${parseFloat(formatUnits(reserved, 18)).toFixed(2)}</div>
      </div>
    </div>
  );
};

export const Portfolio = () => {
  const { selectedChainId } = useChainStore();
  const chainId = typeof selectedChainId === 'number' ? selectedChainId : Number(selectedChainId);
  const deployments = useDeployments();
  const ammEngineAddress = deployments?.contracts?.AMMEngine as `0x${string}`;
  const launchpadEngineAddress = deployments?.contracts?.LaunchpadEngine as `0x${string}`;
  const { address: userAddress } = useAccount();

  // 1. Core Account Balances (from Engine)
  const { available, locked, availableFormatted, lockedFormatted, withdrawableFormatted, isLoading: isLoadingBalance } = useAvailableBalance(ammEngineAddress);

  // 2. Lock Queue (Pending Unlocks)
  const { entries: queue, totalLocked: queueTotal, isLoading: isLoadingQueue } = useLockQueue(ammEngineAddress);
  const queueTotalFormatted = formatUnits(queueTotal, 18);

  // 3. Pro Account Balances (from TickBookVault)
  const { vault: proVault, isLoading: isLoadingProVault } = useTickBookVaultDirect(userAddress, undefined);
  const proAvailableWad = proVault?.availableUsdcWad ?? 0n;
  const proReservedWad = proVault?.reservedUsdcWad ?? 0n;
  const proAvailableFormatted = formatUnits(proAvailableWad, 18);
  const proReservedFormatted = formatUnits(proReservedWad, 18);

  // 4. Markets Data for Aggregation - STRICT VERSION FILTERING
  const v8Markets = useMemo(() => {
    return marketsConfig.markets.filter(m =>
      m.chainId === chainId &&
      m.version?.startsWith('v')
    );
  }, [chainId]);

  // Value Tracking States
  const [lpValues, setLpValues] = useState<Record<string, number>>({});
  const [ammValues, setAmmValues] = useState<Record<string, number>>({});
  const [tokenValues, setTokenValues] = useState<Record<string, number>>({});
  const [vaultSharesValues, setVaultSharesValues] = useState<Record<string, number>>({});

  const totalLpVal = useMemo(() => Object.values(lpValues).reduce((a, b) => a + b, 0), [lpValues]);
  const totalAmmVal = useMemo(() => Object.values(ammValues).reduce((a, b) => a + b, 0), [ammValues]);
  const totalTokenVal = useMemo(() => Object.values(tokenValues).reduce((a, b) => a + b, 0), [tokenValues]);
  const totalVaultSharesVal = useMemo(() => Object.values(vaultSharesValues).reduce((a, b) => a + b, 0), [vaultSharesValues]);

  const handleLpValueUpdate = useCallback((addr: string, val: number) => {
    setLpValues(prev => prev[addr] === val ? prev : { ...prev, [addr]: val });
  }, []);
  const handleAmmValueUpdate = useCallback((addr: string, val: number) => {
    setAmmValues(prev => prev[addr] === val ? prev : { ...prev, [addr]: val });
  }, []);
  const handleTokenValueUpdate = useCallback((addr: string, val: number) => {
    setTokenValues(prev => prev[addr] === val ? prev : { ...prev, [addr]: val });
  }, []);
  const handleVaultSharesUpdate = useCallback((addr: string, val: number) => {
    setVaultSharesValues(prev => prev[addr] === val ? prev : { ...prev, [addr]: val });
  }, []);

  // 4. Wallet Balance & Decimals
  const usdcAddress = deployments?.contracts?.MockUSDC as `0x${string}`;
  const { balances, isLoading: isLoadingWallet } = useTokenBalances(usdcAddress ? [usdcAddress] : []);
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
    contracts: v8Markets.flatMap(m => [
      { address: ammEngineAddress, abi: ABIS.AMMEngine, functionName: 'getMarketState', args: [m.contractAddress] },
      { address: ammEngineAddress, abi: ABIS.AMMEngine, functionName: 'getPosition', args: [m.contractAddress, userAddress] },
      { address: launchpadEngineAddress, abi: ABIS.LaunchpadEngine, functionName: 'getLPBalance', args: [m.contractAddress, userAddress] },
      { address: launchpadEngineAddress, abi: ABIS.LaunchpadEngine, functionName: 'getMarketState', args: [m.contractAddress] }
    ]),
    query: { enabled: !!userAddress && !!ammEngineAddress && !!launchpadEngineAddress && v8Markets.length > 0 }
  });

  // Aggregate values
  const aggregates = useMemo(() => {
    if (!batchData || batchData.length === 0) return { lpValue: 0, ammValue: 0, hasAnyLpBalance: false };
    let lpValue = 0;
    let ammValue = 0;
    let hasAnyLpBalance = false;

    for (let i = 0; i < v8Markets.length; i++) {
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
  }, [batchData, v8Markets, decimals]);

  const walletUsdcFormatted = formatUnits(walletUsdc, decimals);

  // Account Aggregates
  const selfCustodyTotal = parseFloat(walletUsdcFormatted) + totalLpVal + totalTokenVal + totalAmmVal + parseFloat(queueTotalFormatted);
  const proVaultTotal = parseFloat(proAvailableFormatted) + parseFloat(proReservedFormatted) + totalVaultSharesVal;

  // Helper to extract specific market price from batch
  const getMarketPrice = (marketAddr: string) => {
    const idx = v8Markets.findIndex(m => m.contractAddress === marketAddr);
    if (idx === -1 || !batchData) return undefined;
    return (batchData[idx * 4]?.result as any)?.[2];
  };

  return (
    <div className="min-h-screen pb-20">
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
                  content="Your personal self-custody account. Includes USDC held directly in your wallet, Liquidity Provider (LP) shares in AMM pools, and outcome tokens (Owned Shares) acquired via bonding curves or AMM swaps. You have full control over these assets."
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
                  <div className="text-[9px] text-slate-500 font-bold mb-1 flex items-center gap-1 uppercase">
                    <TrendingUp className="w-2.5 h-2.5" /> LP Shares
                  </div>
                  <div className="font-mono text-white font-bold text-sm">
                    ${totalLpVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="bg-slate-900/40 rounded p-2.5 border border-slate-800/50">
                  <div className="text-[9px] text-slate-500 font-bold mb-1 flex items-center gap-1 uppercase">
                    <ShieldCheck className="w-2.5 h-2.5" /> Owned Shares
                  </div>
                  <div className="font-mono text-white font-bold text-sm">
                    ${(totalTokenVal + totalAmmVal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="bg-slate-900/40 rounded p-2.5 border border-slate-800/50">
                  <div className="text-[9px] text-slate-500 font-bold mb-1 flex items-center gap-1 uppercase">
                    <Clock className="w-2.5 h-2.5" /> Pending Exits
                  </div>
                  <div className="font-mono text-white font-bold text-sm">
                    ${parseFloat(queueTotalFormatted).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="bg-slate-900/40 rounded p-2.5 border border-slate-800/50">
                  <div className="text-[9px] text-slate-500 font-bold mb-1 flex items-center gap-1 uppercase">
                    <Wallet className="w-2.5 h-2.5" /> USDC
                  </div>
                  <div className="font-mono text-amber-400 font-bold text-sm">
                    ${parseFloat(walletUsdcFormatted).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* TickBook Vault (Isolated Margin) */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                <Database className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <Tooltip
                  content="The protocol-managed execution vault for professional trading. Includes USDC reserved as margin for active limit orders, unused USDC available for new trades, and outcome tokens settled within the TickBook V2 engine. This vault isolates and executes orders efficiently."
                  position="right"
                  showIcon={true}
                >
                  <h2 className="text-lg font-bold text-white uppercase tracking-wider leading-none">TickBook Vault</h2>
                </Tooltip>
              </div>
            </div>

            <Card className="bg-gradient-to-br from-indigo-950/40 to-slate-950 border-indigo-500/20 p-6 min-h-[240px] flex flex-col justify-between">
              <div className="mb-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="text-xs text-indigo-300 font-bold flex items-center gap-2 uppercase tracking-tighter">
                    <Database className="w-3 h-3" /> Total Vault Value
                    {isLoadingProVault && <div className="animate-spin w-2 h-2 border-2 border-indigo-500 border-t-transparent rounded-full" />}
                  </div>
                </div>
                <div className="text-4xl font-mono font-bold text-white tracking-tight">
                  ${proVaultTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-900/40 rounded p-2.5 border border-slate-800/50">
                  <div className="text-[9px] text-slate-500 font-bold mb-1 flex items-center gap-1 uppercase">
                    <Activity className="w-2.5 h-2.5" /> Owned Shares
                  </div>
                  <div className="font-mono text-white font-bold text-sm">
                    ${totalVaultSharesVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="bg-slate-900/40 rounded p-2.5 border border-slate-800/50">
                  <div className="text-[9px] text-slate-500 font-bold mb-1 flex items-center gap-1 uppercase">
                    <Lock className="w-2.5 h-2.5" /> Active Margin
                  </div>
                  <div className="font-mono text-white font-bold text-sm">
                    ${parseFloat(proReservedFormatted).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="bg-slate-900/40 rounded p-2.5 border border-slate-800/50">
                  <div className="text-[9px] text-slate-500 font-bold mb-1 flex items-center gap-1 uppercase">
                    <Database className="w-2.5 h-2.5" /> Unused USDC
                  </div>
                  <div className="font-mono text-amber-400 font-bold text-sm">
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
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">AMM & Bonding Curve Details</h3>
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
                {v8Markets.length > 0 ? (
                  v8Markets.map((market, i) => {
                    const baseIdx = i * 4;
                    return (
                      <LPPositionRow
                        key={market.contractAddress}
                        market={market}
                        userAddress={userAddress!}
                        lpBalance={batchData?.[baseIdx + 2]?.result as bigint}
                        lpSupply={(batchData?.[baseIdx + 3]?.result as any)?.[3]}
                        floorValue={(batchData?.[baseIdx + 3]?.result as any)?.[5]}
                        decimals={decimals}
                        onValueUpdate={handleLpValueUpdate}
                      />
                    );
                  })
                ) : (
                  <EmptyState message="No liquidity positions found" />
                )}
                {aggregates.lpValue === 0 && !aggregates.hasAnyLpBalance && !isLoadingBatch && v8Markets.length > 0 && (
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
                  ${(totalTokenVal + totalAmmVal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="p-4">
                {v8Markets.length > 0 ? (
                  <>
                    {/* Wallet Rows */}
                    {v8Markets.map(market => (
                      <OutcomeTokenRow
                        key={`wallet-${market.contractAddress}`}
                        market={market}
                        userAddress={userAddress!}
                        price={getMarketPrice(market.contractAddress)}
                        onValueUpdate={handleTokenValueUpdate}
                      />
                    ))}
                    {/* AMM Engine Rows */}
                    {v8Markets.map(market => (
                      <AMMPositionRow
                        key={`amm-${market.contractAddress}`}
                        market={market}
                        userAddress={userAddress!}
                        ammEngineAddress={ammEngineAddress}
                        price={getMarketPrice(market.contractAddress)}
                        onValueUpdate={handleAmmValueUpdate}
                      />
                    ))}
                  </>
                ) : (
                  <EmptyState message="No markets tracked" />
                )}
                {totalTokenVal + totalAmmVal === 0 && !isLoadingBatch && (
                  <div className="mt-[-8px]">
                    <EmptyState message="No owned shares found" />
                  </div>
                )}
              </div>
            </Card>

            {/* Pending Exits */}
            <Card className="p-0 border-amber-500/20 bg-slate-950/30 overflow-hidden">
              <div className="px-4 py-3 bg-amber-950/10 border-b border-amber-500/10 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
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
                      <div key={idx} className="flex justify-between items-center p-3 bg-slate-900/40 rounded-xl border border-slate-800/80 hover:border-amber-500/30 transition-all group">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono font-bold text-white tracking-tight">
                              {parseFloat(formatUnits(item.amount, 18)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                            </span>
                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">USDC</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-tight">
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
                          <span className={`text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-widest ${isUnlocked ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/20 text-amber-400 border border-amber-500/20'}`}>
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
                <Activity className="w-3 h-3 text-indigo-500" />
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pro Trading Details</h3>
              </div>
              <div className="h-px flex-1 bg-slate-800/50 mx-4" />
            </div>

            {/* Pro Vault Owned Shares */}
            <Card className="p-0 border-indigo-500/20 bg-slate-950/30 overflow-hidden">
              <div className="px-4 py-3 bg-indigo-950/20 border-b border-indigo-500/10 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Owned Shares</h3>
                </div>
                <div className="text-white font-mono font-bold text-sm">
                  ${totalVaultSharesVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="p-4">
                {totalVaultSharesVal === 0 ? (
                  <EmptyState message="No vault shares found" />
                ) : (
                  v8Markets.map(market => (
                    <TickBookInternalRow
                      key={market.contractAddress}
                      market={market}
                      userAddress={userAddress!}
                      price={getMarketPrice(market.contractAddress)}
                      onValueUpdate={handleVaultSharesUpdate}
                    />
                  ))
                )}
              </div>
            </Card>

            {/* Active Margin */}
            <Card className="p-0 border-indigo-500/20 bg-slate-950/30 overflow-hidden">
              <div className="px-4 py-3 bg-indigo-950/20 border-b border-indigo-500/10 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Active Margin</h3>
                </div>
                <div className="text-white font-mono font-bold text-sm">
                  ${parseFloat(proReservedFormatted).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="p-4 bg-slate-900/20">
                {proReservedWad === 0n ? (
                  <EmptyState message="No active margin reserved" />
                ) : (
                  v8Markets.map(market => (
                    <ProMarginRow
                      key={market.contractAddress}
                      market={market}
                      userAddress={userAddress!}
                    />
                  ))
                )}
              </div>
            </Card>

            {/* Dashboard Legend / Status */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Security Model</h4>
                  <p className="text-[10px] text-slate-500 uppercase">Architecture Version: V10.7 Unified Crossing</p>
                </div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Sooth V10.7 uses a unified crossing architecture with spot-first price discovery. Markets are created via Launchpad Engine (`{launchpadEngineAddress?.slice(0, 6)}...`). The TickBook orderbook provides deep liquidity with range orders and spot sells crossing at best available prices.
              </p>
              <div className="flex items-center gap-4 pt-4 border-t border-slate-800">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-[9px] text-slate-500 uppercase font-bold">{v8Markets.length} Active Markets</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-indigo-500" />
                  <span className="text-[9px] text-slate-500 uppercase font-bold">Pro Hardened</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
