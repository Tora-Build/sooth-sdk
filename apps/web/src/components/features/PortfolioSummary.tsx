import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Wallet, TrendingUp, Layers, ArrowLeft, ArrowDownCircle } from 'lucide-react';
import { useAccount, useReadContracts } from 'wagmi';
import { formatUnits } from 'viem';
import { ERC20_ABI, SOOTH_VAULT_ABI, SOOTH_MARKET_ABI } from '../../config/abis';
import { useDeployments } from '../../hooks/useDeployments';
import { useTraderVault } from '../../hooks/useTraderVault';
import marketsConfig from '../../config/markets.json';
import { useMarketStore } from '../../store/useMarketStore';

export const PortfolioSummary: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { mode, markets: demoMarkets } = useMarketStore();
  const deployments = useDeployments();
  const [isFlipped, setIsFlipped] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const { deposit } = useTraderVault();
  
  const usdcAddress = deployments.MockERC20 as `0x${string}`;
  // LP vault - use SoothGovernorVault in v2, fallback to SoothVault for v1
  const vaultAddress = (deployments.SoothGovernorVault || deployments.SoothVault) as `0x${string}`;


  // 1. Get Wallet & Vault Data
  const { data: baseData, isLoading: isLoadingBase } = useReadContracts({
    contracts: [
      { address: usdcAddress, abi: ERC20_ABI, functionName: 'balanceOf', args: [address || '0x0'] },
      { address: vaultAddress, abi: SOOTH_VAULT_ABI, functionName: 'balanceOf', args: [address || '0x0'] },
      { address: usdcAddress, abi: ERC20_ABI, functionName: 'decimals' }, // Check decimals
    ],
    query: {
      enabled: mode === 'real' && !!address,
      refetchInterval: 5000,
    }
  });

  // 2. Get Market Positions (Iterate all known markets)
  const realMarkets = marketsConfig.markets.filter(m => m.mode === 'real');
  
  const marketContracts = realMarkets.flatMap(m => [
    {
      address: m.contractAddress as `0x${string}`,
      abi: SOOTH_MARKET_ABI,
      functionName: 'yesBalance',
      args: [address || '0x0'],
    },
    {
      address: m.contractAddress as `0x${string}`,
      abi: SOOTH_MARKET_ABI,
      functionName: 'noBalance',
      args: [address || '0x0'],
    },
    {
      address: m.contractAddress as `0x${string}`,
      abi: SOOTH_MARKET_ABI,
      functionName: 'ammState',
      args: [],
    },
    {
      address: m.contractAddress as `0x${string}`,
      abi: SOOTH_MARKET_ABI,
      functionName: 'b',
      args: [],
    },
  ]);

  const { data: positionData, isLoading: isLoadingPositions } = useReadContracts({
    contracts: marketContracts as any,
    query: {
      enabled: mode === 'real' && !!address,
      refetchInterval: 5000,
    }
  });

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(val);

  // Determine values based on mode
  let displayUsdc = 0;
  let displayLp = 0;
  let isMockData = false;
  let activePositions: any[] = [];
  let totalPositionValue = 0;

  if (mode === 'demo') {
    displayUsdc = 100000;
    displayLp = 5000;
    isMockData = true;
    
    // Get demo positions from store
    Object.entries(demoMarkets).forEach(([marketId, market]) => {
      const yesShares = market.userYesShares || 0;
      const noShares = market.userNoShares || 0;
      
      if (yesShares > 0 || noShares > 0) {
        const yesValue = yesShares * (market.priceYes || 0.5);
        const noValue = noShares * (market.priceNo || 0.5);
        
        activePositions.push({ 
          name: market.question, 
          yesShares,
          noShares,
          yesValue,
          noValue,
          totalValue: yesValue + noValue
        });
        totalPositionValue += (yesValue + noValue);
      }
    });
  } else {
    // Real mode
    const [usdcBal, lpBal, decimalsVal] = baseData?.map(r => r.result) || [];
    const decimals = Number(decimalsVal || 18); // Default to 18 if fetch fails
    
    displayUsdc = usdcBal ? parseFloat(formatUnits(usdcBal as bigint, decimals)) : 0;
    displayLp = lpBal ? parseFloat(formatUnits(lpBal as bigint, 18)) : 0; // LP is always 18

    // Process Positions
    if (positionData) {
      realMarkets.forEach((market, idx) => {
        const baseIdx = idx * 4;
        const yesBalResult = positionData[baseIdx];
        const noBalResult = positionData[baseIdx + 1];
        const ammStateResult = positionData[baseIdx + 2];
        const bParamResult = positionData[baseIdx + 3];

        // Calculate prices - use fallback if data missing
        let priceYes = 0.5;
        let priceNo = 0.5;

        if (ammStateResult?.result && bParamResult?.result) {
          const [qYes, qNo] = ammStateResult.result as [bigint, bigint];
          const bVal = bParamResult.result as bigint;
          
          const qYesNum = parseFloat(formatUnits(qYes, 18));
          const qNoNum = parseFloat(formatUnits(qNo, 18));
          const bNum = parseFloat(formatUnits(bVal, 18));
          
          // Calculate prices using LMSR formula
          if (bNum > 0) {
            const expYes = Math.exp(qYesNum / bNum);
            const expNo = Math.exp(qNoNum / bNum);
            const sumExp = expYes + expNo;
            priceYes = expYes / sumExp;
            priceNo = expNo / sumExp;
          }
        }

        let yesShares = 0;
        let yesValue = 0;
        let noShares = 0;
        let noValue = 0;

        if (yesBalResult?.result && (yesBalResult.result as bigint) > 0n) {
          yesShares = parseFloat(formatUnits(yesBalResult.result as bigint, 18));
          yesValue = yesShares * priceYes;
        }

        if (noBalResult?.result && (noBalResult.result as bigint) > 0n) {
          noShares = parseFloat(formatUnits(noBalResult.result as bigint, 18));
          noValue = noShares * priceNo;
        }

        if (yesShares > 0 || noShares > 0) {
          activePositions.push({
            name: market.name,
            yesShares,
            noShares,
            yesValue,
            noValue,
            totalValue: yesValue + noValue
          });
          totalPositionValue += (yesValue + noValue);
        }
      });
    }
  }

  // Show connection prompt only in Real mode when not connected
  if (mode === 'real' && !isConnected) {
    return (
      <Card className="h-full border-slate-800/60 bg-slate-900/40">
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">
          My Portfolio
        </h3>
        <div className="text-center py-8">
          <Wallet className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Connect wallet to view portfolio</p>
        </div>
      </Card>
    );
  }

  // Handle deposit
  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) return;
    await deposit(depositAmount);
    setDepositAmount('');
    setIsFlipped(false);
  };

  // Flip card back side (Trading Account management)
  if (isFlipped) {
    return (
      <Card className="h-full border-slate-800/60 bg-slate-900/40 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
            Trading Account
          </h3>
          <button
            onClick={() => setIsFlipped(false)}
            className="p-1 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
        </div>
        
        <div className="space-y-4 flex-1">


          {/* Balance Display */}
          <TradingAccountDetails />
        </div>
      </Card>
    );
  }

  return (
    <Card className="h-full border-slate-800/60 bg-slate-900/40 flex flex-col">
      <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">
        My Portfolio
      </h3>
      <div className="space-y-4 flex-1">
        
        {/* Trading Vault Balance (V3) */}
        <TradingVaultBalance onFlip={() => setIsFlipped(true)} />

        {/* Vault Balance */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <TrendingUp size={16} />
            </div>
            <div>
              <div className="text-sm font-medium text-white">Vault Balance</div>
              <div className="text-xs text-slate-500">LP Tokens</div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono font-medium text-white">
              {mode === 'real' && isLoadingBase ? (
                <span className="text-slate-600">Loading...</span>
              ) : (
                formatCurrency(displayLp)
              )}
            </div>
            {!isMockData && !isLoadingBase && displayLp === 0 && (
              <div className="text-[10px] text-slate-600 mt-1">No deposits</div>
            )}
          </div>
        </div>

        {/* Active Positions */}
        <div className="flex items-center justify-between group cursor-help relative">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Layers size={16} />
            </div>
            <div>
              <div className="text-sm font-medium text-white">Positions</div>
              <div className="text-xs text-slate-500">
                {activePositions.length} {activePositions.length === 1 ? 'market' : 'markets'}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono font-medium text-white">
              {formatCurrency(totalPositionValue)}
            </div>
            {activePositions.length > 0 && (
              <div className="text-[10px] text-slate-600 mt-1">Hover for details</div>
            )}
          </div>

          {/* Details on hover */}
          {activePositions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar">
                {activePositions.map((pos, i) => (
                  <div key={i} className="flex flex-col text-xs bg-slate-800/30 p-2 rounded gap-1">
                    <div className="truncate text-slate-300 font-medium mb-1" title={pos.name}>{pos.name}</div>
                    
                    {pos.yesShares > 0 && (
                      <div className="flex justify-between items-center pl-2 border-l-2 border-emerald-500/30">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-emerald-400">YES</span>
                          <span className="text-slate-400">{pos.yesShares.toFixed(2)} shares</span>
                        </div>
                        <div className="font-mono font-bold text-white">{formatCurrency(pos.yesValue)}</div>
                      </div>
                    )}

                    {pos.noShares > 0 && (
                      <div className="flex justify-between items-center pl-2 border-l-2 border-rose-500/30">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-rose-400">NO</span>
                          <span className="text-slate-400">{pos.noShares.toFixed(2)} shares</span>
                        </div>
                        <div className="font-mono font-bold text-white">{formatCurrency(pos.noValue)}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </Card>
  );
};

/**
 * Trading Vault Balance Component (V3)
 * Shows available and pending balances from TraderVaultV3
 * With flip card for deposit functionality
 */
const TradingVaultBalance: React.FC<{ onFlip: () => void }> = ({ onFlip }) => {
  const { availableBalance, pendingBalance, isLoading } = useTraderVault();
  const { mode } = useMarketStore();
  
  const available = parseFloat(formatUnits(availableBalance, 18));
  const pending = parseFloat(formatUnits(pendingBalance, 18));
  const total = available + pending;

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(val);

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400">
          <Wallet size={16} />
        </div>
        <div>
          <div className="text-sm font-medium text-white">Trading Account</div>
          <div className="text-xs text-slate-500">
            {pending > 0 ? `${formatCurrency(available)} + ${formatCurrency(pending)} pending` : 'Available'}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="flex items-center justify-end gap-3">
          <Button
            variant="success"
            size="sm"
            onClick={onFlip}
            className="h-7 px-2 text-xs gap-1.5"
          >
            <ArrowDownCircle size={12} />
            Deposit
          </Button>
          <div className="font-mono font-medium text-white">
            {mode === 'real' && isLoading ? (
              <span className="text-slate-600">Loading...</span>
            ) : (
              formatCurrency(total)
            )}
          </div>
        </div>
        {pending > 0 && (
          <div className="text-[10px] text-amber-400 mt-1">48h lock</div>
        )}
      </div>
    </div>
  );
};

/**
 * Trading Account Details (shown on flip side)
 * Redesigned to match MarketCard style
 */
const TradingAccountDetails: React.FC = () => {
  const { availableBalance, pendingBalance, withdraw, claimUnlocked, deposit, userUsdcBalance } = useTraderVault();
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit');
  
  const available = parseFloat(formatUnits(availableBalance, 18));
  const pending = parseFloat(formatUnits(pendingBalance, 18));
  const walletBalance = parseFloat(formatUnits(userUsdcBalance, 18)); // Assuming 18 decimals for now, ideally fetch from token

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(val);

  const handleAction = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    if (mode === 'deposit') {
      await deposit(amount);
    } else {
      await withdraw(amount);
    }
    setAmount('');
  };

  const setMax = () => {
    if (mode === 'deposit') {
      setAmount(walletBalance.toString());
    } else {
      setAmount(available.toString());
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Mode Toggles */}
      <div className="mb-4">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setMode('deposit')}
            className={`h-11 rounded-lg border-2 font-bold text-white transition-all ${
              mode === 'deposit' 
                ? 'border-emerald-500 bg-emerald-500/10' 
                : 'border-slate-800 hover:border-emerald-500/30'
            }`}
          >
            DEPOSIT
          </button>
          <button
            onClick={() => setMode('withdraw')}
            className={`h-11 rounded-lg border-2 font-bold text-white transition-all ${
              mode === 'withdraw' 
                ? 'border-rose-500 bg-rose-500/10' 
                : 'border-slate-800 hover:border-rose-500/30'
            }`}
          >
            WITHDRAW
          </button>
        </div>
      </div>

      {/* Stats Panel */}
      <div className="mb-4 space-y-3">
        <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800 space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Wallet Balance</span>
            <span className="font-mono text-white">{formatCurrency(walletBalance)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Available to Trade</span>
            <span className="font-mono text-emerald-400">{formatCurrency(available)}</span>
          </div>
          {pending > 0 && (
            <div className="flex justify-between text-sm border-t border-slate-800 pt-1.5">
              <span className="text-slate-500">Locked (48h)</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-amber-400">{formatCurrency(pending)}</span>
                <button
                  onClick={claimUnlocked}
                  className="px-1.5 py-0.5 text-[10px] bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 rounded transition-colors border border-amber-500/20"
                >
                  Claim
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Section */}
      <div className="mt-auto space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-slate-500">Amount</label>
            <button 
              onClick={setMax}
              className="text-xs text-indigo-400 hover:text-indigo-300"
            >
              Max: {formatCurrency(mode === 'deposit' ? walletBalance : available)}
            </button>
          </div>
          <div className="relative">
             <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-slate-950/50 border border-slate-800 rounded-lg pl-4 pr-24 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
              <span className="text-sm font-bold text-slate-400">USDC</span>
            </div>
          </div>
        </div>

        <Button
          onClick={handleAction}
          disabled={
            !amount || 
            parseFloat(amount) <= 0 || 
            (mode === 'deposit' && parseFloat(amount) > walletBalance) ||
            (mode === 'withdraw' && parseFloat(amount) > available)
          }
          className={`w-full ${
            mode === 'deposit'
              ? 'bg-emerald-600 hover:bg-emerald-700'
              : 'bg-rose-600 hover:bg-rose-700'
          }`}
        >
          {mode === 'deposit' ? 'Confirm Deposit' : 'Confirm Withdraw'}
        </Button>
      </div>
    </div>
  );
};
