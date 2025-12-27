/**
 * SimpleTradingPanel - V8 Trading Panel with Real-time Quotes
 * 
 * Uses useAMMQuoteDirect for accurate LMSR cost/fee calculations
 */
import { useState, useMemo, useEffect } from 'react';
import { TrendingUp, TrendingDown, AlertCircle, Wallet, Loader2, ArrowRight, Unlock, Info } from 'lucide-react';
import { Button } from '../../ui/Button';
import { useAccount, usePublicClient, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { useAmmMarketDirect, useAMMQuoteDirect, useLaunchpadMarketDirect, useAMMPositionDirect, useAvailableBalance } from '../../../hooks/v8';
import { useDeployments } from '../../../hooks/useDeployments';
import { V8_ABIS, ERC20_ABI } from '../../../config/abis';
import { parseUnits, formatUnits } from 'viem';
import toast from 'react-hot-toast';
import { cn } from '../../../lib/utils';
import { useChainStore } from '../../../store/useChainStore';

interface SimpleTradingPanelProps {
  address: `0x${string}`;
  isGraduated?: boolean;
  isSettled?: boolean;
}

export const SimpleTradingPanel = ({
  address,
  isGraduated = false,
  isSettled = false,
}: SimpleTradingPanelProps) => {
  const { isConnected, address: userAddress } = useAccount();
  const { selectedChainId } = useChainStore();
  const chainId = typeof selectedChainId === 'number' ? selectedChainId : Number(selectedChainId);
  const publicClient = usePublicClient({ chainId });
  const { amm, isLoading } = useAmmMarketDirect(address);
  const { launchpad } = useLaunchpadMarketDirect(address);
  const { contracts } = useDeployments();
  const ammEngineAddress = contracts.AMMEngine as `0x${string}` | undefined;
  const { available: spendableProceeds } = useAvailableBalance(ammEngineAddress);
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

  const [selectedOutcome, setSelectedOutcome] = useState<0 | 1>(0);
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('10');
  const [amountError, setAmountError] = useState<string | null>(null);

  // Contract write hooks
  const { writeContract: approve, data: approveTxHash, isPending: isApproving } = useWriteContract();
  const { writeContract: trade, data: tradeTxHash, isPending: isTrading } = useWriteContract();

  const { isLoading: isApprovePending } = useWaitForTransactionReceipt({ hash: approveTxHash, pollingInterval: 2000 });
  const { isLoading: isTradePending, isSuccess: isTradeSuccess, isError: isTradeError, error: tradeReceiptError } = useWaitForTransactionReceipt({ hash: tradeTxHash, pollingInterval: 2000 });

  // Clear errors on mode/outcome switch
  useEffect(() => {
    setAmountError(null);
  }, [tradeMode, selectedOutcome]);

  const trimDecimals = (s: string, maxDecimals = 2) => {
    if (!s.includes('.')) return s;
    const [i, d] = s.split('.');
    const clipped = d.slice(0, maxDecimals).replace(/0+$/, '');
    return clipped.length ? `${i}.${clipped}` : i;
  };

  const wadToSharesInput = (wad: bigint) => trimDecimals(formatUnits(wad, 18), 2);

  // Bug #1 & #2: Handle amount change with validation
  const handleAmountChange = (val: string) => {
    if (val === '') {
      setAmount('');
      setAmountError(null);
      return;
    }
    const num = parseFloat(val);
    if (isNaN(num)) {
      setAmountError('Enter a number.');
      return;
    }
    
    // Prevent negative numbers (Bug #1)
    if (num < 0) {
      setAmountError('Enter a positive number.');
      return;
    }
    
    // Reasonable upper limit (Bug #2)
    if (num > 100000000) {
      setAmountError('That size is too large.');
      return;
    }
    
    setAmount(val);
    setAmountError(null);
  };

  // Parse shares as a number for the quote hook
  const sharesNum = useMemo(() => {
    const parsed = parseFloat(amount);
    return isNaN(parsed) || parsed <= 0 ? 0 : parsed;
  }, [amount]);

  // Get real-time quote from LMSR calculator
  const quote = useAMMQuoteDirect(address, sharesNum, selectedOutcome, tradeMode === 'buy');

  // Get USDC decimals, balance and allowance
  const { data: usdcDecimals } = useReadContract({
    address: contracts.MockUSDC as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'decimals',
    chainId,
    query: { 
      enabled: !!contracts.MockUSDC,
      staleTime: Infinity,
      refetchInterval: false,
    },
  });

  const { data: usdcBalance } = useReadContract({
    address: contracts.MockUSDC as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [userAddress!],
    chainId,
    query: { 
      enabled: !!userAddress && !!contracts.MockUSDC,
      refetchInterval: 15000,
    },
  });

  const { data: usdcAllowance, refetch: refetchAllowance } = useReadContract({
    address: contracts.MockUSDC as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [userAddress!, contracts.LaunchpadEngine as `0x${string}`],
    chainId,
    query: { 
      enabled: !!userAddress && !!contracts.MockUSDC && !!contracts.LaunchpadEngine,
      refetchInterval: 30000,
    },
  });

  // Refetch allowance after approval or trade
  useEffect(() => {
    if (approveTxHash && !isApprovePending) {
      refetchAllowance();
    }
  }, [approveTxHash, isApprovePending, refetchAllowance]);

  useEffect(() => {
    if (tradeTxHash && !isTradePending) {
      refetchAllowance();
    }
  }, [tradeTxHash, isTradePending, refetchAllowance]);

  // USDC decimals (default to 18 for MockUSDC on testnets)
  const decimals = Number(usdcDecimals ?? 18);

  // --- Position + Balances (for MAX + validation) ---

  const { data: ammPosition, isLoading: isLoadingPosition, refetch: refetchPosition } = useAMMPositionDirect(address);
  const { refetch: refetchAmm } = useAmmMarketDirect(address);
  const { refetch: refetchLaunchpad } = useLaunchpadMarketDirect(address);

  // Refetch after trade or approval
  useEffect(() => {
    if (isTradeSuccess) {
      refetchPosition();
      refetchAmm();
      refetchLaunchpad();
      refetchAllowance();
    }
  }, [isTradeSuccess, refetchPosition, refetchAmm, refetchLaunchpad, refetchAllowance]);

  const yesPositionWad = ammPosition?.yesShares ?? 0n;
  const noPositionWad = ammPosition?.noShares ?? 0n;
  const maxSellWad = selectedOutcome === 0 ? yesPositionWad : noPositionWad;

  const walletUsdcToken = (usdcBalance as bigint | undefined) ?? 0n;
  const walletWad = useMemo(() => {
    if (decimals === 18) return walletUsdcToken;
    if (decimals < 18) return walletUsdcToken * BigInt(10 ** (18 - decimals));
    // Defensive: if token decimals > 18, downscale to WAD
    return walletUsdcToken / BigInt(10 ** (decimals - 18));
  }, [walletUsdcToken, decimals]);

  // LaunchpadEngine now uses spendable proceeds first for the base cost,
  // then pulls the remainder (+ fee) from wallet. So buying power = wallet + spendable.
  const buyingPowerWad = walletWad + (spendableProceeds ?? 0n);

  // Log transaction hash when it's set
  useEffect(() => {
    if (tradeTxHash) {
      console.log('[Trade] Transaction hash received:', tradeTxHash);
    }
  }, [tradeTxHash]);

  // Log trade receipt status
  useEffect(() => {
    if (isTradeSuccess) {
      console.log('[Trade] Transaction confirmed!');
    }
    if (isTradeError) {
      console.error('[Trade] Transaction failed:', tradeReceiptError);
    }
  }, [isTradeSuccess, isTradeError, tradeReceiptError]);

  const yesPrice = amm?.yesProbability ?? 0.5;
  const noPrice = amm?.noProbability ?? 0.5;
  const isMarketCreated = !!launchpad && launchpad.creator !== ZERO_ADDRESS;
  const isAmmInitialized = (amm?.liquidity ?? 0n) > 0n;
  const canTrade = isMarketCreated && isAmmInitialized;

  // Formatters
  const fmtQty = (val: bigint) => Number(formatUnits(val, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 });

  // Check if approval is needed
  // MockUSDC has 6 decimals, but quote.cost is in WAD (18 decimals)
  // Need to convert cost to token decimals for comparison
  const needsApproval = useMemo(() => {
    // If no quote cost, no approval needed
    if (!quote.cost || quote.cost === 0n) return false;

    // If allowance is undefined, we're still loading - don't show approval button yet
    if (usdcAllowance === undefined) return false;

    // Convert cost from WAD (18 decimals) to token decimals (6)
    // ceiling division: (cost + 10^12 - 1) / 10^12
    const factor = BigInt(10 ** (18 - decimals));
    const costInTokenDecimals = (quote.cost + factor - 1n) / factor;

    // Add 1% buffer for slippage
    const requiredAllowance = (costInTokenDecimals * 101n) / 100n;
    const currentAllowance = usdcAllowance as bigint;

    return currentAllowance < requiredAllowance;
  }, [usdcAllowance, quote.cost, decimals]);

  // Check if user has enough balance (compare in token decimals)
  const hasEnoughBalance = useMemo(() => {
    if (!quote.cost) return true;
    // Convert cost from WAD to token decimals (ceiling division)
    const factor = BigInt(10 ** (18 - decimals));
    const costInTokenDecimals = (quote.cost + factor - 1n) / factor;
    return walletUsdcToken >= costInTokenDecimals;
  }, [walletUsdcToken, quote.cost, decimals]);

  const hasEnoughBuyingPower = useMemo(() => {
    if (!quote.cost) return true;
    return buyingPowerWad >= quote.cost;
  }, [buyingPowerWad, quote.cost]);

  // Check if user has enough shares to sell
  const hasEnoughShares = useMemo(() => {
    if (tradeMode === 'buy') return true;
    const sharesWad = parseUnits(amount || '0', 18);
    return maxSellWad >= sharesWad;
  }, [tradeMode, amount, maxSellWad]);

  // Connect wallet handler
  const handleConnect = () => {
    const connectBtn = document.querySelector('appkit-button') as HTMLElement;
    connectBtn?.click();
  };

  // Approve USDC for LaunchpadEngine
  const handleApprove = () => {
    if (!contracts.MockUSDC || !contracts.LaunchpadEngine) return;

    // Approve a large amount in the token's actual decimals
    const approvalAmount = parseUnits('1000000', decimals);
    console.log('[Approve] Amount:', approvalAmount.toString(), 'decimals:', decimals);

    approve({
      address: contracts.MockUSDC as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [contracts.LaunchpadEngine as `0x${string}`, approvalAmount],
    }, {
      onSuccess: () => {
        toast.success('USDC approved!');
      },
      onError: (error) => {
        toast.error(`Approval failed: ${error.message}`);
      },
    });
  };

  const handleMax = async () => {
    if (!isConnected) return;

    if (tradeMode === 'sell') {
      const sellable = selectedOutcome === 0 ? yesPositionWad : noPositionWad;
      if (sellable <= 0n) {
        setAmount('0');
        setAmountError('No position to sell.');
        return;
      }
      setAmount(wadToSharesInput(sellable));
      setAmountError(null);
      return;
    }

    // BUY MAX — use real quotes (WAD) against total buying power (wallet + spendable)
    if (!publicClient || !ammEngineAddress || !canTrade) return;
    if (buyingPowerWad <= 0n) {
      setAmount('0');
      setAmountError('No funds available.');
      return;
    }

    const feeRateBps = Number(launchpad?.currentFeeBps ?? 500n);
    const price = selectedOutcome === 0 ? yesPrice : noPrice;
    const priceWad = BigInt(Math.max(1, Math.floor(price * 1e18)));

    const capSharesWad = 1_000_000n * 10n ** 18n;
    const estimate = (buyingPowerWad * 10n ** 18n) / priceWad; // sharesWad ~ budget / spot
    let high = estimate * 2n;
    if (high > capSharesWad) high = capSharesWad;

    const totalCostForBuyShares = async (sharesWad: bigint) => {
      // V8.2: deltaShares is always positive for buys, outcome determines YES/NO
      const deltaShares = sharesWad;
      
      try {
        const [netCost] = await publicClient.readContract({
          address: ammEngineAddress,
          abi: V8_ABIS.AMMEngine,
          functionName: 'getPositionQuote',
          args: [address, selectedOutcome, deltaShares],
        }) as readonly [bigint, bigint];

        const absNet = netCost < 0n ? -netCost : netCost;
        const fee = (absNet * BigInt(feeRateBps)) / 10000n;
        return netCost + fee;
      } catch (e) {
        // If contract reverts (e.g. overflow in LMSR for huge sizes), 
        // treat it as "too expensive" so binary search moves lower.
        return buyingPowerWad + 1n;
      }
    };

    try {
      // If the 2x estimate still fits, use it (rare but nice UX)
      const costHigh = await totalCostForBuyShares(high);
      if (costHigh <= buyingPowerWad) {
        setAmount(wadToSharesInput(high));
        setAmountError(null);
        return;
      }

      // Binary search for best share amount under budget
      let low = 0n;
      let hi = high;
      let best = 0n;

      // ~16 iterations gives 1e6 precision down to < 0.1 share scale, enough for UX
      for (let i = 0; i < 18; i++) {
        const mid = (low + hi) / 2n;
        if (mid <= 0n) {
          low = 0n;
          continue;
        }
        const cost = await totalCostForBuyShares(mid);
        if (cost <= buyingPowerWad) {
          best = mid;
          low = mid;
        } else {
          hi = mid;
        }
      }

      if (best <= 0n) {
        setAmount('0');
        setAmountError('Not enough to buy 1 share.');
        return;
      }

      setAmount(wadToSharesInput(best));
      setAmountError(null);
    } catch (e: any) {
      console.error('[MAX] Failed to compute max buy', e);
      toast.error('Could not compute MAX right now.');
    }
  };

    // Execute trade
    // V8 uses a position model where:
    // - Positive shares = long YES
    // - Negative shares = long NO
    // So: Buy YES = +delta, Buy NO = -delta, Sell YES = -delta, Sell NO = +delta
    const handleTrade = () => {
      console.log('[Trade] handleTrade called', {
        launchpadEngine: contracts.LaunchpadEngine,
        deltaShares: quote.deltaShares?.toString(),
        sharesNum,
      });
  
      if (!contracts.LaunchpadEngine) {
        toast.error('LaunchpadEngine contract address not found');
        return;
      }

      if (!canTrade) {
        if (!isMarketCreated) {
          toast.error('This market is not initialized in LaunchpadEngine on this network yet.');
        } else if (!isAmmInitialized) {
          toast.error('This market is not initialized in AMMEngine on this network yet.');
        } else {
          toast.error('Market is not ready for trading yet.');
        }
        return;
      }
  
      if (quote.deltaShares === undefined || quote.deltaShares === 0n) {
        toast.error('Invalid quote - please enter shares amount');
        return;
      }

    // V8.2: deltaShares is always based on quote, outcome is separate parameter
    const deltaShares = quote.deltaShares;

    // Slippage guard:
    // - BUY: maxCost = +1% buffer
    // - SELL: minProceeds = -1% buffer (LaunchpadEngine interprets param as min proceeds on closes)
    const limitCost = tradeMode === 'buy'
      ? (quote.cost * 101n) / 100n
      : (quote.cost * 99n) / 100n;

    console.log('[Trade] Executing:', {
      market: address,
      outcome: selectedOutcome,
      deltaShares: deltaShares.toString(),
      maxCost: limitCost.toString(),
      maxCostUSD: (Number(limitCost) / 1e18).toFixed(2),
      launchpadEngine: contracts.LaunchpadEngine,
    });

    try {
      // V8.2 API: tradePositions(market, outcome, deltaShares, maxCostOrMinProceeds)
      trade({
        address: contracts.LaunchpadEngine as `0x${string}`,
        abi: V8_ABIS.LaunchpadEngine,
        functionName: 'tradePositions',
        args: [address, selectedOutcome, deltaShares, limitCost],
        // Explicit gas limit to bypass MegaETH gas estimation issues
        gas: 500000n,
      }, {
        onSuccess: (hash) => {
          console.log('[Trade] Transaction submitted! Hash:', hash);
      toast.success(`${tradeMode === 'buy' ? 'Bought' : 'Sold'} ${sharesNum} ${selectedOutcome === 0 ? 'YES' : 'NO'} shares`);
          setAmount('10'); // Reset amount
        },
        onError: (error: any) => {
          console.error('[Trade] Error:', error);
          console.error('[Trade] Error cause:', error?.cause);
          console.error('[Trade] Error data:', error?.data);

          // Try to extract the actual revert reason from various error formats
          let errorMsg = 'Unknown error';
          if (error?.cause?.reason) {
            errorMsg = error.cause.reason;
          } else if (error?.cause?.shortMessage) {
            errorMsg = error.cause.shortMessage;
          } else if (error?.data?.message) {
            errorMsg = error.data.message;
          } else if (error?.shortMessage) {
            errorMsg = error.shortMessage;
          } else if (error?.message) {
            // Try to extract revert reason from message
            const match = error.message.match(/reason[:\s]+["']?([^"'\n]+)["']?/i);
            if (match) {
              errorMsg = match[1];
            } else {
              errorMsg = error.message;
            }
          }

          toast.error(`Trade failed: ${errorMsg}`);
        },
      });
      console.log('[Trade] writeContract called - waiting for wallet confirmation...');
    } catch (err) {
      console.error('[Trade] Unexpected error:', err);
      toast.error('Unexpected error during trade');
    }
  };

  if (isSettled) {
    return (
      <div className="p-4 text-center">
        <div className="text-amber-400 mb-2">⚖️ Market Settled</div>
        <p className="text-sm text-slate-500">Trading is closed for this market.</p>
      </div>
    );
  }

  const isPending = isApproving || isApprovePending || isTrading || isTradePending;

  const getButtonContent = () => {
    if (isPending) return <Loader2 size={16} className="mr-2 animate-spin" />;
    if (!canTrade) return 'Market Uninitialized';
    if (sharesNum <= 0) return 'Enter Amount';
    if (tradeMode === 'buy') {
      if (!hasEnoughBuyingPower) return 'Insufficient Balance';
      return `Buy ${selectedOutcome === 0 ? 'YES' : 'NO'}`;
    } else {
      if (!hasEnoughShares) return 'Insufficient Position';
      return `Sell ${selectedOutcome === 0 ? 'YES' : 'NO'}`;
    }
  };

  const isButtonDisabled = 
    isPending || 
    !canTrade || 
    sharesNum <= 0 || 
    !!amountError ||
    (tradeMode === 'buy' && !hasEnoughBuyingPower) ||
    (tradeMode === 'sell' && !hasEnoughShares);

  return (
    <div data-testid="trading-panel" className="space-y-3">
      {/* Initialization Warning */}
      {!isLoading && isConnected && !canTrade && (
        <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-300 flex items-start gap-2">
          <AlertCircle size={12} className="shrink-0 mt-0.5" />
          <span>
            Trading unavailable: this market hasn’t been initialized on the connected network.
          </span>
        </div>
      )}

      {/* Probability Display */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setSelectedOutcome(0)}
          className={`p-3 rounded-lg border-2 text-center transition-all focus-ring ${selectedOutcome === 0
            ? 'border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/10'
            : 'border-slate-700/50 bg-emerald-500/5 hover:border-emerald-500/50 hover:-translate-y-0.5'
            }`}
        >
          <div className="flex items-center justify-center gap-1 mb-1">
            <TrendingUp className={`w-3 h-3 transition-transform ${selectedOutcome === 0 ? 'text-emerald-400 scale-110' : 'text-emerald-400/70'}`} />
            <span className="text-[10px] text-emerald-400 uppercase tracking-wider font-bold">YES</span>
          </div>
          <div className="text-xl font-bold text-emerald-400 tabular-nums">
            {isLoading ? <span className="skeleton w-12 h-6 inline-block rounded" /> : `${(yesPrice * 100).toFixed(1)}%`}
          </div>
          <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-tight">
            {fmtQty(amm?.qYes ?? 0n)} issued
          </div>
        </button>

        <button
          onClick={() => setSelectedOutcome(1)}
          className={`p-3 rounded-lg border-2 text-center transition-all focus-ring ${selectedOutcome === 1
            ? 'border-rose-500 bg-rose-500/10 shadow-lg shadow-rose-500/10'
            : 'border-slate-700/50 bg-rose-500/5 hover:border-rose-500/50 hover:-translate-y-0.5'
            }`}
        >
          <div className="flex items-center justify-center gap-1 mb-1">
            <TrendingDown className={`w-3 h-3 transition-transform ${selectedOutcome === 1 ? 'text-rose-400 scale-110' : 'text-rose-400/70'}`} />
            <span className="text-[10px] text-rose-400 uppercase tracking-wider font-bold">NO</span>
          </div>
          <div className="text-xl font-bold text-rose-400 tabular-nums">
            {isLoading ? <span className="skeleton w-12 h-6 inline-block rounded" /> : `${(noPrice * 100).toFixed(1)}%`}
          </div>
          <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-tight">
            {fmtQty(amm?.qNo ?? 0n)} issued
          </div>
        </button>
      </div>

      {/* Probability Bar */}
      <div className="h-2 rounded-full overflow-hidden flex bg-slate-800">
        <div
          className="bg-gradient-to-r from-emerald-600 to-emerald-400 transition-[width] duration-500"
          style={{ width: `${yesPrice * 100}%` }}
        />
        <div
          className="bg-gradient-to-r from-rose-400 to-rose-600 transition-[width] duration-500"
          style={{ width: `${noPrice * 100}%` }}
        />
      </div>

      {/* Buy/Sell Toggle */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setTradeMode('buy')}
          className={`py-2 rounded-lg font-bold text-xs transition-all ${tradeMode === 'buy'
            ? 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400'
            : 'bg-slate-800 border-2 border-slate-700 text-slate-400 hover:border-slate-600'
            }`}
        >
          BUY
        </button>
        <button
          onClick={() => setTradeMode('sell')}
          className={`py-2 rounded-lg font-bold text-xs transition-all ${tradeMode === 'sell'
            ? 'bg-rose-500/20 border-2 border-rose-500 text-rose-400'
            : 'bg-slate-800 border-2 border-slate-700 text-slate-400 hover:border-slate-600'
            }`}
        >
          SELL
        </button>
      </div>

      {/* Amount Input */}
      <div>
        <div className="flex justify-between items-end mb-1">
          <label className="text-xs text-slate-500">Shares</label>
          {isConnected && (
            <button 
              onClick={handleMax}
              className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold uppercase tracking-wider"
            >
              MAX
            </button>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setAmount(prev => String(Math.max(1, Number(prev) - 1)))}
            className="absolute left-0 top-0 h-full px-3 flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-800/50 rounded-l-lg transition-colors"
          >
            <span className="text-lg font-bold">−</span>
          </button>
          <input
            type="number"
            data-testid="shares-input"
            value={amount}
            onChange={(e) => handleAmountChange(e.target.value)}
            aria-invalid={amountError ? 'true' : 'false'}
            className="input-field text-center px-12 py-2 text-sm"
            placeholder="10"
            min="0"
          />
          <button
            onClick={() => setAmount(prev => String(Number(prev) + 1))}
            className="absolute right-0 top-0 h-full px-3 flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-800/50 rounded-r-lg transition-colors"
          >
            <span className="text-lg font-bold">+</span>
          </button>
        </div>
        {amountError && (
          <div className="mt-1 text-[10px] text-rose-300">
            {amountError}
          </div>
        )}
        {tradeMode === 'sell' && (
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>Position</span>
            <span className="font-mono text-slate-300 flex items-center gap-1">
              {isLoadingPosition ? (
                <>
                  <Loader2 className="w-2 h-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                selectedOutcome === 0
                  ? `${trimDecimals(formatUnits(yesPositionWad, 18), 2)} YES`
                  : `${trimDecimals(formatUnits(noPositionWad, 18), 2)} NO`
              )}
            </span>
          </div>
        )}
        {tradeMode === 'buy' && (
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>Buying power</span>
            <span className="font-mono text-slate-300">
              ${(Number(buyingPowerWad) / 1e18).toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {/* Quick Amount Buttons */}
      <div className="grid grid-cols-4 gap-1">
        {tradeMode === 'sell'
          ? ([25, 50, 75, 100] as const).map((pct) => {
              const wad = (maxSellWad * BigInt(pct)) / 100n;
              const label = pct === 100 ? 'MAX' : `${pct}%`;
              const target = wadToSharesInput(wad);
              return (
                <button
                  key={pct}
                  onClick={() => handleAmountChange(target)}
                  disabled={maxSellWad <= 0n}
                  className={cn(
                    'py-1.5 text-[10px] font-mono rounded transition-all border',
                    maxSellWad <= 0n
                      ? 'bg-slate-900/30 text-slate-600 border-slate-800 cursor-not-allowed'
                      : amount === target
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                        : 'bg-slate-800/40 text-slate-400 border-slate-800 hover:border-slate-700'
                  )}
                >
                  {label}
                </button>
              );
            })
          : ([10, 50, 100, 500] as const).map((val) => (
              <button
                key={val}
                onClick={() => handleAmountChange(String(val))}
                className={cn(
                  'py-1.5 text-[10px] font-mono rounded transition-all border',
                  amount === String(val)
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                    : 'bg-slate-800/40 text-slate-400 border-slate-800 hover:border-slate-700'
                )}
              >
                {val}
              </button>
            ))}
      </div>

      {/* Quote Summary */}
      <div className="p-3 bg-slate-800/30 rounded-lg space-y-2 border border-slate-700/30">
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">Shares</span>
          <span className="font-mono text-white tabular-nums">{quote.sharesFormatted}</span>
        </div>
        <div className="divider-gradient my-2" />
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">
            {tradeMode === 'buy' ? 'Cost' : 'Proceeds'}
          </span>
          <span className="font-mono text-white tabular-nums">
            {quote.isLoading ? <span className="skeleton w-16 h-4 inline-block rounded" /> : quote.costFormatted}
          </span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">
            Fee ({(quote.feeRate / 100).toFixed(1)}%)
          </span>
          <span className="font-mono text-slate-400 tabular-nums">{quote.feeFormatted}</span>
        </div>

        {/* Debug: Show b parameter */}
        <div className="flex justify-between text-xs pt-1 border-t border-slate-700/50">
          <span className="text-slate-600">Liquidity (b)</span>
          <span className="font-mono text-slate-500">
            {launchpad?.currentBBase ? `$${(Number(launchpad.currentBBase) / 1e18).toFixed(2)}` : 'Not initialized'}
          </span>
        </div>

        {/* Price Impact - always show when shares > 0 */}
        {sharesNum > 0 && (
          <div className="space-y-2 pt-2 border-t border-slate-700">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Price Impact</span>
              <span className={`font-mono ${Math.abs(quote.priceImpact) > 5
                ? 'text-rose-400 font-bold'
                : Math.abs(quote.priceImpact) > 2
                  ? 'text-amber-400 font-bold'
                  : 'text-slate-400'
                }`}>
                {quote.priceImpact > 0 ? '+' : ''}{quote.priceImpact.toFixed(2)}%
              </span>
            </div>
            
            {/* Impact Warnings */}
            {Math.abs(quote.priceImpact) > 5 ? (
              <div className="p-2 rounded bg-rose-500/10 border border-rose-500/20 text-[10px] text-rose-400 flex items-start gap-2 animate-pulse">
                <AlertCircle size={12} className="shrink-0 mt-0.5" />
                <span><strong>High Price Impact!</strong> You are moving the market significantly. Consider trading in smaller sizes.</span>
              </div>
            ) : Math.abs(quote.priceImpact) > 2 ? (
              <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-400 flex items-start gap-2">
                <AlertCircle size={12} className="shrink-0 mt-0.5" />
                <span>Significant price impact. Check your execution price carefully.</span>
              </div>
            ) : null}
          </div>
        )}

        {/* Spendable Proceeds Indicator - these ARE used for buys */}
        {tradeMode === 'buy' && spendableProceeds > 0n && quote.cost > 0n && (
          <div className="flex items-center gap-2 p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400">
            <Unlock size={12} className="shrink-0" />
            <span>
              Using up to <strong>${(Number(spendableProceeds) / 1e18).toFixed(2)}</strong> from spendable proceeds.
            </span>
          </div>
        )}

        {/* New Price After Trade */}
        {sharesNum > 0 && (
          <div className="flex justify-between text-xs pt-2 border-t border-slate-700">
            <span className="text-slate-500">New Price</span>
            <div className="flex items-center gap-1">
              <span className="font-mono text-slate-400">
                {(selectedOutcome === 0 ? yesPrice * 100 : noPrice * 100).toFixed(1)}%
              </span>
              <ArrowRight className="w-3 h-3 text-slate-600" />
              <span className={`font-mono ${selectedOutcome === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {((selectedOutcome === 0 ? quote.newYesPrice : quote.newNoPrice) * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Balance Summary */}
      {isConnected && (
        <div className="p-2 rounded-xl bg-slate-900/30 border border-slate-800/60 text-[10px] text-slate-400 space-y-1">
          <div className="flex justify-between">
            <span>Wallet USDC</span>
            <span className="font-mono text-slate-200">
              ${(Number(walletUsdcToken) / (10 ** decimals)).toFixed(2)}
            </span>
          </div>
          {spendableProceeds > 0n && (
            <div className="flex justify-between">
              <span>Spendable Proceeds</span>
              <span className="font-mono text-emerald-400">
                +${(Number(spendableProceeds) / 1e18).toFixed(2)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Balance Warning */}
      {
        isConnected && tradeMode === 'buy' && !hasEnoughBuyingPower && sharesNum > 0 && (
          <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[10px] text-rose-400 flex items-start gap-2">
            <AlertCircle size={12} className="shrink-0 mt-0.5" />
            <span>Not enough funds for this size. Try a smaller amount.</span>
          </div>
        )
      }

      {/* Spendable Proceeds Notice */}
      {
        tradeMode === 'sell' && (
          <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[10px] text-indigo-400 flex items-start gap-2">
            <Info size={12} className="shrink-0 mt-0.5" />
            <span>Proceeds are <strong>instantly spendable</strong> but locked for withdrawal for 24h.</span>
          </div>
        )
      }

      {/* Action Buttons */}
      {
        !isConnected ? (
          <Button
            onClick={handleConnect}
            className="w-full py-3 text-sm cta-pulse bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white font-bold shadow-lg shadow-cyan-500/25"
          >
            <Wallet size={16} className="mr-2" />
            Connect Wallet
          </Button>
        ) : needsApproval && tradeMode === 'buy' ? (
          <Button
            onClick={handleApprove}
            disabled={isPending || !canTrade}
            className="w-full py-3 text-sm bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-bold shadow-lg shadow-amber-500/25 disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 size={16} className="mr-2 animate-spin" />
            ) : null}
            Approve USDC
          </Button>
        ) : (
          <Button
            onClick={() => {
              handleTrade();
            }}
            disabled={isButtonDisabled}
            className={cn(
              "w-full py-3 text-sm font-bold transition-all active:scale-[0.98]",
              isButtonDisabled ? "opacity-50 cursor-not-allowed grayscale" : "hover:-translate-y-0.5",
              selectedOutcome === 0 ? "btn-buy" : "btn-sell"
            )}
          >
            {getButtonContent()}
          </Button>
        )}
    </div>
  );
};
