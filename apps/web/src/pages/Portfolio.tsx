
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useAccount, useReadContract, useReadContracts } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { Link } from 'react-router-dom';
import { 
  ShieldCheck, 
  Wallet, 
  TrendingUp, 
  Clock, 
  AlertCircle, 
  ArrowUpRight, 
  ArrowDownRight, 
  LayoutDashboard,
  Zap,
  Activity,
  Database,
  Lock,
  TrendingUp as TrendingUpIcon
} from 'lucide-react';
import { useChainStore } from '../store/useChainStore';
import { useDeployments } from '../hooks/useDeployments';
import { useAvailableBalance, useLockQueue, useTokenBalances } from '../hooks/v8';
import { useLaunchpadMarketDirect, useV8DirectRead, readContractSafe, useAMMPositionDirect } from '../hooks/v8';
import { useMarketStatsMath } from '../hooks/v8/useMarketStatsMath';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { ERC20_ABI, V8_ABIS } from '../config/abis';
import marketsConfig from '../config/markets.json';

// --- Components ---

/**
 * AMMPositionRow - Displays internal shares from AMMEngine
 */
const AMMPositionRow = ({ market, userAddress, ammEngineAddress, price, onValueUpdate }: { 
  market: typeof marketsConfig.markets[0], 
  userAddress: `0x${string}`, 
  ammEngineAddress: `0x${string}`,
  price?: bigint,
  onValueUpdate?: (marketAddr: string, value: number) => void
}) => {
  const { data: position, isLoading } = useAMMPositionDirect(market.contractAddress as `0x${string}`);

  const shares = position?.shares ?? 0n;
  const absShares = shares > 0n ? shares : -shares;
  
  // Estimate value based on current AMM price
  // price is WAD probability. Expected value (WAD USDC) = shares(WAD) * price(WAD) / 1e18
  const valueUsd = price ? Number(formatUnits((absShares * price) / 1_000_000_000_000_000_000n, 18)) : 0;

  useEffect(() => {
    if (!isLoading && onValueUpdate) {
      onValueUpdate(market.contractAddress, valueUsd);
    }
  }, [isLoading, valueUsd, market.contractAddress, onValueUpdate]);

  if (isLoading) {
    return (
      <div className="flex justify-between items-center p-3 bg-slate-900/40 rounded border border-slate-800/50 mb-2 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 bg-slate-800 rounded" />
          <div>
            <div className="h-3 w-20 bg-slate-800 rounded mb-1" />
            <div className="h-2 w-12 bg-slate-800 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (shares === 0n) return null;

  const isYes = shares > 0n;

  return (
    <div className="flex justify-between items-center p-3 bg-slate-900/40 rounded border border-slate-800/50 mb-2">
      <div className="flex items-center gap-3">
        {isYes ? <ArrowUpRight className="w-4 h-4 text-emerald-400" /> : <ArrowDownRight className="w-4 h-4 text-rose-400" />}
        <div>
          <div className="text-xs font-bold text-white">{market.name}</div>
          <div className={`text-[10px] font-mono ${isYes ? 'text-emerald-500' : 'text-rose-500'}`}>
            {isYes ? 'YES' : 'NO'} INTERNAL SHARES
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-mono font-bold text-white">{parseFloat(formatUnits(absShares, 18)).toFixed(2)}</div>
        <div className="text-[10px] text-slate-500 font-mono">${valueUsd.toFixed(2)}</div>
      </div>
    </div>
  );
};

/**
 * OutcomeTokenRow - Displays ERC20 tokens in wallet
 */
const OutcomeTokenRow = ({ market, userAddress, price, onValueUpdate }: { 
  market: typeof marketsConfig.markets[0], 
  userAddress: `0x${string}`,
  price?: bigint,
  onValueUpdate?: (marketAddr: string, value: number) => void
}) => {
  const { data: balances } = useReadContracts({
    contracts: [
      {
        address: market.yesToken as `0x${string}`,
        abi: V8_ABIS.OutcomeToken,
        functionName: 'balanceOf',
        args: [userAddress],
      },
      {
        address: market.noToken as `0x${string}`,
        abi: V8_ABIS.OutcomeToken,
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
        <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-tight">{market.name}</div>
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

const PortfolioLpRow = ({ market, onValueUpdate }: { 
  market: typeof marketsConfig.markets[0],
  onValueUpdate?: (marketAddr: string, value: number) => void
}) => {
  const { selectedChainId } = useChainStore();
  const chainId = typeof selectedChainId === 'number' ? selectedChainId : Number(selectedChainId);
  const deployments = useDeployments();
  const ammEngineAddress = deployments?.contracts?.AMMEngine as `0x${string}`;

  const { launchpad } = useLaunchpadMarketDirect(market.contractAddress as `0x${string}`);

  const { data: ammState } = useV8DirectRead({
    queryKey: ['v8', 'ammState', chainId, ammEngineAddress, market.contractAddress],
    enabled: !!market.contractAddress && !!chainId && !!ammEngineAddress,
    chainId,
    read: async (client) => {
      const result = await readContractSafe<readonly [bigint, bigint, bigint]>(client, {
        address: ammEngineAddress!,
        abi: V8_ABIS.AMMEngine,
        functionName: 'getMarketState',
        args: [market.contractAddress],
      });
      const [qYes, qNo, price] = result || [0n, 0n, 0n];
      return { qYes, qNo, price };
    },
  });

  const stats = useMarketStatsMath(launchpad as any, ammState);

  const userLpNum = launchpad?.userLpBalance ? Number(formatUnits(launchpad.userLpBalance, 18)) : 0;
  const userFloorVal = stats ? userLpNum * stats.floorRate : 0;
  const userCeilingVal = stats ? userLpNum * stats.ceilingRate : 0;

  useEffect(() => {
    if (launchpad && stats && onValueUpdate) {
      onValueUpdate(market.contractAddress, userFloorVal);
    }
  }, [launchpad, stats, userFloorVal, market.contractAddress, onValueUpdate]);

  if (!launchpad?.userLpBalance || launchpad.userLpBalance === 0n || !stats) {
    return null;
  }

  const totalLpNum = Number(formatUnits(launchpad.lpSupply, 18));
  const sharePct = totalLpNum > 0 ? (userLpNum / totalLpNum) * 100 : 0;

  const fmtUsd = (val: number) => val.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  const fmtLp = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="bg-slate-900/40 rounded-lg p-4 border border-slate-800/50 hover:border-emerald-500/30 transition-colors mb-3">
      <div className="flex justify-between items-start mb-2">
        <div>
          <Link to={`/trade/${market.contractAddress}`} className="text-sm font-bold text-white hover:text-emerald-400 transition-colors">
            {market.name}
          </Link>
          <div className="mt-1">
            {launchpad.isGraduated ?
              <Badge variant="warning" className="text-[10px] h-4 py-0">TICKBOOK</Badge> :
              <Badge variant="success" className="text-[10px] h-4 py-0 bg-emerald-950 text-emerald-400 border-emerald-900">BOND</Badge>
            }
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Floor Total</div>
          <div className="font-mono text-emerald-400 font-bold">{fmtUsd(userFloorVal)}</div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 text-xs font-mono pt-2 border-t border-slate-800/30">
        <div>
          <div className="text-[10px] text-slate-500 mb-0.5">LP</div>
          <div className="text-slate-300">{fmtLp(userLpNum)}</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 mb-0.5 text-emerald-500">Floor</div>
          <div className="text-emerald-400">{fmtUsd(userFloorVal)}</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 mb-0.5">Ceiling</div>
          <div className="text-slate-400">{fmtUsd(userCeilingVal)}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-slate-500 mb-0.5">Own</div>
          <div className="text-white">{sharePct.toFixed(1)}%</div>
        </div>
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
  
  // Differentiate Locked Balance: AMM Reserved vs TickBook Margin
  const tickBookLocked = locked > queueTotal ? locked - queueTotal : 0n;
  const tickBookLockedFormatted = formatUnits(tickBookLocked, 18);

  // 3. Markets Data for Aggregation
  const v8Markets = useMemo(() => {
    return marketsConfig.markets.filter(m => m.version.startsWith('v8') && m.chainId === chainId);
  }, [chainId]);

  // Value Tracking States
  const [lpValues, setLpValues] = useState<Record<string, number>>({});
  const [ammValues, setAmmValues] = useState<Record<string, number>>({});
  const [tokenValues, setTokenValues] = useState<Record<string, number>>({});

  const totalLpVal = useMemo(() => Object.values(lpValues).reduce((a, b) => a + b, 0), [lpValues]);
  const totalAmmVal = useMemo(() => Object.values(ammValues).reduce((a, b) => a + b, 0), [ammValues]);
  const totalTokenVal = useMemo(() => Object.values(tokenValues).reduce((a, b) => a + b, 0), [tokenValues]);

  const handleLpValueUpdate = useCallback((addr: string, val: number) => {
    setLpValues(prev => prev[addr] === val ? prev : { ...prev, [addr]: val });
  }, []);
  const handleAmmValueUpdate = useCallback((addr: string, val: number) => {
    setAmmValues(prev => prev[addr] === val ? prev : { ...prev, [addr]: val });
  }, []);
  const handleTokenValueUpdate = useCallback((addr: string, val: number) => {
    setTokenValues(prev => prev[addr] === val ? prev : { ...prev, [addr]: val });
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
      { address: ammEngineAddress, abi: V8_ABIS.AMMEngine, functionName: 'getMarketState', args: [m.contractAddress] },
      { address: ammEngineAddress, abi: V8_ABIS.AMMEngine, functionName: 'getPosition', args: [m.contractAddress, userAddress] },
      { address: launchpadEngineAddress, abi: V8_ABIS.LaunchpadEngine, functionName: 'getLPBalance', args: [m.contractAddress, userAddress] },
      { address: launchpadEngineAddress, abi: V8_ABIS.LaunchpadEngine, functionName: 'getMarketState', args: [m.contractAddress] }
    ]),
    query: { enabled: !!userAddress && !!ammEngineAddress && !!launchpadEngineAddress && v8Markets.length > 0 }
  });

  // Aggregate values
  const aggregates = useMemo(() => {
    if (!batchData || batchData.length === 0) return { lpValue: 0, ammValue: 0 };
    let lpValue = 0;
    let ammValue = 0;

    for (let i = 0; i < v8Markets.length; i++) {
      const baseIdx = i * 4;
      const priceResult = batchData[baseIdx]?.result as readonly [bigint, bigint, bigint];
      const sharesResult = batchData[baseIdx + 1]?.result as bigint;
      const lpBalResult = batchData[baseIdx + 2]?.result as bigint;
      const lpStateResult = batchData[baseIdx + 3]?.result as any;

      const price = priceResult?.[2] ?? parseUnits('0.5', 18);
      
      if (sharesResult) {
        const absShares = sharesResult > 0n ? sharesResult : -sharesResult;
        // price is WAD (18 dec), absShares is WAD (18 dec)
        ammValue += (Number(absShares) * Number(price)) / 1e36;
      }

      if (lpBalResult && lpStateResult) {
        const lpSupply = lpStateResult[3] as bigint;
        const floorValue = lpStateResult[5] as bigint; // USDC decimals
        if (lpSupply > 0n) {
          const userLpNum = Number(formatUnits(lpBalResult, 18));
          const totalLpNum = Number(formatUnits(lpSupply, 18));
          const floorRate = Number(formatUnits(floorValue, decimals)) / totalLpNum;
          lpValue += userLpNum * floorRate;
        }
      }
    }
    return { lpValue, ammValue };
  }, [batchData, v8Markets, decimals]);

  const walletUsdcFormatted = formatUnits(walletUsdc, decimals);

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

          {/* Wallet & AMM (External Focus) */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Wallet className="w-5 h-5 text-emerald-400" />
              <div>
                <h2 className="text-xs font-bold text-white uppercase tracking-wider">Wallet & LP Assets</h2>
                <div className="text-[10px] text-slate-500 font-mono uppercase">DIRECT OWNERSHIP • SELF-CUSTODY</div>
              </div>
            </div>

            <Card className="bg-gradient-to-br from-emerald-950/20 to-slate-950 border-emerald-500/20 p-6">
              <div className="mb-6">
                <div className="flex justify-between items-start mb-2">
                  <div className="text-xs text-emerald-500/80 font-bold flex items-center gap-2 uppercase tracking-tighter">
                    <Wallet className="w-3 h-3" /> Wallet (USDC)
                    {isLoadingWallet && <div className="animate-spin w-2 h-2 border-2 border-emerald-500 border-t-transparent rounded-full" />}
                  </div>
                </div>
                <div className="text-4xl font-mono font-bold text-white tracking-tight">
                  ${parseFloat(walletUsdcFormatted).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-900/40 rounded p-3 border border-slate-800">
                  <div className="text-[10px] text-cyan-500 font-bold mb-1 flex items-center gap-1 uppercase">
                    <TrendingUp className="w-3 h-3" /> LP Total Value
                  </div>
                  <div className="font-mono text-cyan-400 font-bold text-lg">
                    ${totalLpVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="bg-slate-900/40 rounded p-3 border border-slate-800 opacity-50">
                  <div className="text-[10px] text-slate-500 font-bold mb-1 flex items-center gap-1 uppercase">
                    <LayoutDashboard className="w-3 h-3" /> Active Markets
                  </div>
                  <div className="font-mono text-slate-300 font-bold text-lg">
                    {v8Markets.length}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Protocol Account (Internal Focus) */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Database className="w-5 h-5 text-indigo-400" />
              <div>
                <h2 className="text-xs font-bold text-white uppercase tracking-wider">Protocol Account</h2>
                <div className="text-[10px] text-slate-500 font-mono uppercase">AMM ENGINE VAULT • INTERNAL LEDGER</div>
              </div>
            </div>

            <Card className="bg-gradient-to-br from-indigo-950/40 to-slate-950 border-indigo-500/20 p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="text-xs text-indigo-300 font-bold flex items-center gap-2 uppercase tracking-tighter">
                    <Database className="w-3 h-3" /> Vault Total (Available)
                    {isLoadingBalance && <div className="animate-spin w-2 h-2 border-2 border-indigo-500 border-t-transparent rounded-full" />}
                  </div>
                  <div className="text-4xl font-mono font-bold text-white tracking-tight">
                    ${parseFloat(availableFormatted).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="outline" className="bg-indigo-950/50 text-indigo-400 border-indigo-500/30 text-[9px] uppercase">
                    <Lock className="w-2 h-2 mr-1" /> Custodial
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-slate-900/50 rounded p-3 border border-slate-800/50">
                  <div className="text-[10px] text-emerald-500 font-bold mb-1 flex items-center gap-1 uppercase">
                    <TrendingUpIcon className="w-3 h-3" /> Withdrawable
                  </div>
                  <div className="font-mono text-emerald-400 font-bold text-lg">
                    ${parseFloat(withdrawableFormatted).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="bg-slate-900/50 rounded p-3 border border-slate-800/50">
                  <div className="text-[10px] text-amber-500 font-bold mb-1 flex items-center gap-1 uppercase">
                    <Clock className="w-3 h-3" /> Total Reserved
                  </div>
                  <div className="font-mono text-amber-400 font-bold text-lg">
                    ${parseFloat(lockedFormatted).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center bg-indigo-950/30 rounded px-3 py-2 border border-indigo-500/10">
                <div className="flex flex-col">
                  <span className="text-[10px] text-indigo-300 font-mono uppercase flex items-center gap-1">
                    <Activity className="w-2 h-2" /> Internal Shares Value
                  </span>
                  <span className="text-[9px] text-indigo-500/70 font-mono">AMM-ONLY POSITIONS</span>
                </div>
                <span className="text-sm text-indigo-200 font-mono font-bold">
                  ${totalAmmVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
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
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Bonding Curve & LP</h3>
              </div>
              <div className="h-px flex-1 bg-slate-800/50 mx-4" />
            </div>

            {/* LP Dashboard */}
            <Card className="p-0 border-emerald-500/20 bg-slate-950/30 overflow-hidden">
              <div className="px-4 py-3 bg-emerald-950/20 border-b border-emerald-500/10 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <TrendingUpIcon className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">LP Positions</h3>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest">Floor Total</div>
                  <div className="text-emerald-400 font-mono font-bold text-sm">
                    ${totalLpVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-2">
                {v8Markets.map(market => (
                  <PortfolioLpRow key={market.contractAddress} market={market} onValueUpdate={handleLpValueUpdate} />
                ))}
              </div>
            </Card>

            {/* AMM Positions */}
            <Card className="p-0 border-cyan-500/20 bg-slate-950/30 overflow-hidden">
              <div className="px-4 py-3 bg-cyan-950/20 border-b border-cyan-500/10 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <TrendingUpIcon className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Internal Shares</h3>
                </div>
                <Badge variant="outline" className="text-[9px] h-4 text-cyan-400 border-cyan-900">VAULT</Badge>
              </div>
              <div className="p-4">
                {v8Markets.map(market => (
                  <AMMPositionRow 
                    key={market.contractAddress} 
                    market={market} 
                    userAddress={userAddress!} 
                    ammEngineAddress={ammEngineAddress} 
                    price={getMarketPrice(market.contractAddress)}
                    onValueUpdate={handleAmmValueUpdate}
                  />
                ))}
              </div>
            </Card>

            {/* AMM Pending Unlocks */}
            <Card className="p-0 border-amber-500/20 bg-slate-950/30 overflow-hidden">
              <div className="px-4 py-3 bg-amber-950/10 border-b border-amber-500/10 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">AMM Sells (Reserved)</h3>
                </div>
                <div className="text-amber-400 font-mono font-bold text-sm">
                  ${parseFloat(queueTotalFormatted).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              {(queue || []).length === 0 ? (
                <div className="p-8 text-center text-slate-600 font-mono text-[10px] opacity-50 uppercase tracking-widest">
                  No pending unlocks.
                </div>
              ) : (
                <div className="p-4 space-y-2">
                  {(queue || []).map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs font-mono p-2 bg-slate-900/50 rounded border border-slate-800">
                      <span className="text-slate-400">Unlock #{idx + 1}</span>
                      <span className="text-amber-400">{formatUnits(item.amount, 18)} USDC</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* PRO DASHBOARD (RIGHT) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <Activity className="w-3 h-3 text-indigo-500" />
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">TickBook & Outcome Tokens</h3>
              </div>
              <div className="h-px flex-1 bg-slate-800/50 mx-4" />
            </div>

            {/* Wallet Outcome Tokens */}
            <Card className="p-0 border-indigo-500/20 bg-slate-950/30 overflow-hidden">
              <div className="px-4 py-3 bg-indigo-950/20 border-b border-indigo-500/10 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Outcome Tokens</h3>
                </div>
                <Badge variant="outline" className="text-[9px] h-4 text-indigo-400 border-indigo-900">WALLET</Badge>
              </div>
              <div className="p-4">
                {v8Markets.map(market => (
                  <OutcomeTokenRow 
                    key={market.contractAddress} 
                    market={market} 
                    userAddress={userAddress!} 
                    price={getMarketPrice(market.contractAddress)}
                    onValueUpdate={handleTokenValueUpdate}
                  />
                ))}
              </div>
            </Card>

            {/* TickBook Margin */}
            <Card className="p-0 border-indigo-500/20 bg-slate-950/30 overflow-hidden">
              <div className="px-4 py-3 bg-indigo-950/20 border-b border-indigo-500/10 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Pro Margin (Locked)</h3>
                </div>
                <div className="text-indigo-400 font-mono font-bold text-sm">
                  ${parseFloat(tickBookLockedFormatted).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="p-8 text-center text-slate-600 font-mono text-[10px] opacity-50 uppercase tracking-widest">
                {tickBookLocked > 0n ? 'Active TickBook collateral.' : 'No active limit order margin.'}
              </div>
            </Card>

            {/* Placeholder for Limit Orders List */}
            <Card className="p-0 border-slate-800 bg-slate-950/30 overflow-hidden border-dashed">
              <div className="p-12 text-center text-slate-700 font-mono text-[10px] uppercase tracking-widest">
                Limit order history coming soon.
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
