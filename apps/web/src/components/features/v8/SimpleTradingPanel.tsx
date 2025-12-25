/**
 * SimpleTradingPanel - V8 Trading Panel with Real-time Quotes
 * 
 * Uses useAMMQuoteDirect for accurate LMSR cost/fee calculations
 */
import { useState, useMemo, useEffect } from 'react';
import { TrendingUp, TrendingDown, AlertCircle, Wallet, Loader2, ArrowRight, Unlock, Info } from 'lucide-react';
import { Button } from '../../ui/Button';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { useAmmMarketDirect, useAMMQuoteDirect, useLaunchpadMarketDirect, useAvailableBalance } from '../../../hooks/v8';
import { useDeployments } from '../../../hooks/useDeployments';
import { V8_ABIS, ERC20_ABI } from '../../../config/abis';
import { parseUnits, formatUnits } from 'viem';
import toast from 'react-hot-toast';

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
  const { amm, isLoading } = useAmmMarketDirect(address);
  const { launchpad } = useLaunchpadMarketDirect(address);
  const { contracts } = useDeployments();
  const ammEngineAddress = contracts.AMMEngine as `0x${string}` | undefined;
  const { available: spendableProceeds } = useAvailableBalance(ammEngineAddress);

  const [selectedOutcome, setSelectedOutcome] = useState<0 | 1>(0);
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('10');

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
    query: { enabled: !!contracts.MockUSDC },
  });

  const { data: usdcBalance } = useReadContract({
    address: contracts.MockUSDC as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [userAddress!],
    query: { enabled: !!userAddress && !!contracts.MockUSDC },
  });

  const { data: usdcAllowance } = useReadContract({
    address: contracts.MockUSDC as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [userAddress!, contracts.LaunchpadEngine as `0x${string}`],
    query: { enabled: !!userAddress && !!contracts.MockUSDC && !!contracts.LaunchpadEngine },
  });

  // USDC decimals (default to 18 for MockUSDC on testnets)
  const decimals = Number(usdcDecimals ?? 18);

  // Debug: Log what decimals we're reading
  useEffect(() => {
    console.log('[USDC Debug]', {
      usdcDecimalsRaw: usdcDecimals,
      decimalsUsed: decimals,
      usdcBalance: usdcBalance?.toString(),
      usdcAllowance: usdcAllowance?.toString(),
      quoteCost: quote.cost?.toString(),
    });
  }, [usdcDecimals, decimals, usdcBalance, usdcAllowance, quote.cost]);

  // Contract write hooks
  const { writeContract: approve, data: approveTxHash, isPending: isApproving } = useWriteContract();
  const { writeContract: trade, data: tradeTxHash, isPending: isTrading } = useWriteContract();

  const { isLoading: isApprovePending } = useWaitForTransactionReceipt({ hash: approveTxHash, pollingInterval: 1000 });
  const { isLoading: isTradePending, isSuccess: isTradeSuccess, isError: isTradeError, error: tradeReceiptError } = useWaitForTransactionReceipt({ hash: tradeTxHash, pollingInterval: 1000 });

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

    console.log('[Approval Check]', {
      tokenDecimals: decimals,
      quoteCostWAD: quote.cost.toString(),
      costInTokenDecimals: costInTokenDecimals.toString(),
      currentAllowance: currentAllowance.toString(),
      requiredAllowance: requiredAllowance.toString(),
      needsApproval: currentAllowance < requiredAllowance,
    });

    return currentAllowance < requiredAllowance;
  }, [usdcAllowance, quote.cost, decimals]);

  // Check if user has enough balance (compare in token decimals)
  const hasEnoughBalance = useMemo(() => {
    if (!usdcBalance || !quote.cost) return true;
    // Convert cost from WAD to token decimals (ceiling division)
    const factor = BigInt(10 ** (18 - decimals));
    const costInTokenDecimals = (quote.cost + factor - 1n) / factor;
    return (usdcBalance as bigint) >= costInTokenDecimals;
  }, [usdcBalance, quote.cost, decimals]);

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

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d6bfcae9-9603-4479-b460-97a3c584da0e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SimpleTradingPanel.tsx:handleTrade',message:'handleTrade called',data:{launchpadEngine:contracts.LaunchpadEngine,ammEngine:contracts.AMMEngine,deltaShares:quote.deltaShares?.toString(),quoteCost:quote.cost?.toString(),quoteIsLoading:quote.isLoading,sharesNum,selectedOutcome,tradeMode,marketAddress:address},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2,H3'})}).catch(()=>{});
    // #endregion

    if (!contracts.LaunchpadEngine) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/d6bfcae9-9603-4479-b460-97a3c584da0e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SimpleTradingPanel.tsx:handleTrade',message:'LaunchpadEngine missing',data:{contracts},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3'})}).catch(()=>{});
      // #endregion
      toast.error('LaunchpadEngine contract address not found');
      return;
    }

    if (quote.deltaShares === undefined || quote.deltaShares === 0n) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/d6bfcae9-9603-4479-b460-97a3c584da0e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SimpleTradingPanel.tsx:handleTrade',message:'Invalid quote - deltaShares is 0',data:{deltaShares:quote.deltaShares?.toString(),quoteCost:quote.cost?.toString()},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      toast.error('Invalid quote - please enter shares amount');
      return;
    }

    // The quote hook already calculates the correct delta based on outcome and mode
    // V8 Position Model:
    // - Positive deltaShares = Long YES
    // - Negative deltaShares = Short YES (Long NO)
    const deltaShares = quote.deltaShares;

    // Add 1% slippage buffer to maxCost
    // Note: maxCost is in WAD (1e18) matching the contract's internal accounting
    const maxCost = (quote.cost * 101n) / 100n;

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d6bfcae9-9603-4479-b460-97a3c584da0e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SimpleTradingPanel.tsx:handleTrade',message:'Executing trade',data:{market:address,deltaShares:deltaShares.toString(),maxCost:maxCost.toString(),maxCostUSD:(Number(maxCost)/1e18).toFixed(4),launchpadEngine:contracts.LaunchpadEngine},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion

    console.log('[Trade] Executing:', {
      market: address,
      deltaShares: deltaShares.toString(),
      maxCost: maxCost.toString(),
      maxCostUSD: (Number(maxCost) / 1e18).toFixed(2),
      launchpadEngine: contracts.LaunchpadEngine,
    });

    try {
      trade({
        address: contracts.LaunchpadEngine as `0x${string}`,
        abi: V8_ABIS.LaunchpadEngine,
        functionName: 'tradePositions',
        args: [address, deltaShares, maxCost],
      }, {
        onSuccess: (hash) => {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/d6bfcae9-9603-4479-b460-97a3c584da0e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SimpleTradingPanel.tsx:handleTrade:onSuccess',message:'Trade tx submitted',data:{hash},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
          // #endregion
          console.log('[Trade] Transaction submitted! Hash:', hash);
          toast.success(`${tradeMode === 'buy' ? 'Bought' : 'Sold'} ${sharesNum} ${selectedOutcome === 0 ? 'YES' : 'NO'} shares!`);
          setAmount('10'); // Reset amount
        },
        onError: (error: any) => {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/d6bfcae9-9603-4479-b460-97a3c584da0e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SimpleTradingPanel.tsx:handleTrade:onError',message:'Trade failed',data:{errorMessage:error?.shortMessage||error?.message,errorDetails:String(error)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
          // #endregion
          console.error('[Trade] Error:', error);
          const shortMessage = error?.shortMessage || error?.message || 'Unknown error';
          toast.error(`Trade failed: ${shortMessage}`);
        },
      });
      console.log('[Trade] writeContract called - waiting for wallet confirmation...');
    } catch (err) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/d6bfcae9-9603-4479-b460-97a3c584da0e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SimpleTradingPanel.tsx:handleTrade:catch',message:'Unexpected error',data:{error:String(err)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
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

  return (
    <div data-testid="trading-panel" className="space-y-3">
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
          <div className="text-[10px] text-slate-500 mt-1">
            ${(yesPrice).toFixed(2)} / share
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
          <div className="text-[10px] text-slate-500 mt-1">
            ${(noPrice).toFixed(2)} / share
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
        <label className="text-xs text-slate-500 block mb-1">Shares</label>
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
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-12 py-2 text-sm text-white text-center focus:outline-none focus:border-cyan-500 transition-colors"
            placeholder="10"
            min="1"
          />
          <button
            onClick={() => setAmount(prev => String(Number(prev) + 1))}
            className="absolute right-0 top-0 h-full px-3 flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-800/50 rounded-r-lg transition-colors"
          >
            <span className="text-lg font-bold">+</span>
          </button>
        </div>
      </div>

      {/* Quick Amount Buttons */}
      <div className="grid grid-cols-4 gap-1">
        {[10, 50, 100, 500].map(val => (
          <button
            key={val}
            onClick={() => setAmount(String(val))}
            className={`py-1.5 text-[10px] font-mono rounded transition-all ${amount === String(val)
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
              : 'bg-slate-800/50 text-slate-500 border border-slate-800 hover:border-slate-700'
              }`}
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
          <div className="flex justify-between text-xs pt-2 border-t border-slate-700">
            <span className="text-slate-500">Price Impact</span>
            <span className={`font-mono ${Math.abs(quote.priceImpact) > 5
              ? 'text-rose-400'
              : Math.abs(quote.priceImpact) > 2
                ? 'text-amber-400'
                : 'text-slate-400'
              }`}>
              {quote.priceImpact > 0 ? '+' : ''}{quote.priceImpact.toFixed(2)}%
            </span>
          </div>
        )}

        {/* Spendable Proceeds Indicator */}
        {tradeMode === 'buy' && spendableProceeds > 0n && quote.cost > 0n && (
          <div className="flex items-center gap-2 p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400">
            <Unlock size={12} className="shrink-0" />
            <span>
              Using <strong>${(Number(spendableProceeds) / 1e6).toFixed(2)}</strong> from spendable proceeds first.
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

      {/* USDC Balance Display */}
      {isConnected && (
        <div className="p-2 rounded-lg bg-slate-800/50 text-[10px] text-slate-400 space-y-1">
          <div className="flex justify-between">
            <span>Your USDC Balance:</span>
            <span className="font-mono text-white">
              ${usdcBalance ? (Number(usdcBalance) / (10 ** decimals)).toFixed(2) : '0.00'}
            </span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Token Decimals:</span>
            <span className="font-mono">{decimals}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Quote Cost:</span>
            <span className="font-mono">
              ${quote.cost ? (Number(quote.cost) / 1e18).toFixed(2) : '0'}
            </span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Needs Approval:</span>
            <span className={`font-mono ${needsApproval ? 'text-amber-400' : 'text-green-400'}`}>
              {needsApproval ? 'Yes' : 'No'}
            </span>
          </div>
        </div>
      )
      }

      {/* Balance Warning */}
      {
        isConnected && tradeMode === 'buy' && !hasEnoughBalance && sharesNum > 0 && (
          <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[10px] text-rose-400 flex items-start gap-2">
            <AlertCircle size={12} className="shrink-0 mt-0.5" />
            <span>Insufficient USDC balance. Visit the Faucet to get test tokens.</span>
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
            disabled={isPending}
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
              console.log('[Trade] Button clicked!', { isPending, hasEnoughBalance, sharesNum });
              handleTrade();
            }}
            disabled={isPending || !hasEnoughBalance || sharesNum <= 0}
            className={`w-full py-3 text-sm font-bold transition-all active:scale-[0.98] ${
              isPending || !hasEnoughBalance || sharesNum <= 0 
                ? 'opacity-50 cursor-not-allowed' 
                : 'hover:-translate-y-0.5'
            } ${selectedOutcome === 0
              ? 'btn-buy'
              : 'btn-sell'
            }`}
          >
            {isPending ? (
              <Loader2 size={16} className="mr-2 animate-spin" />
            ) : null}
            {tradeMode === 'buy' ? 'Buy' : 'Sell'} {selectedOutcome === 0 ? 'YES' : 'NO'}
          </Button>
        )}
    </div>
  );
};
