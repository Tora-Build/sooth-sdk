/**
 * SimpleTradingPanel - V8 Trading Panel with Real-time Quotes
 * 
 * Uses useAMMQuoteDirect for accurate LMSR cost/fee calculations
 */
import { useState, useMemo, useEffect } from 'react';
import { TrendingUp, TrendingDown, AlertCircle, Wallet, Loader2, ArrowRight, Unlock, Info } from 'lucide-react';
import { Button } from '../ui/Button';
import { useAccount, useChainId, usePublicClient, useSwitchChain, useWriteContract, useWaitForTransactionReceipt, useReadContract, useDisconnect } from 'wagmi';
import { useAmmMarketDirect, useAMMQuoteDirect, useLaunchpadMarketDirect, useAMMPositionDirect, useAvailableBalance, useInvalidateQueries } from '../../hooks';
import { useDeployments } from '../../hooks/useDeployments';
import { ABIS, ERC20_ABI } from '../../config/abis';
import { parseUnits, formatUnits } from 'viem';
import toast from 'react-hot-toast';
import { cn } from '../../lib/utils';
import { useChainStore } from '../../store/useChainStore';
import { marketConfigs } from '../../config';
import { getChainById } from '../../lib/chains';

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
  const { isConnected, address: userAddress, connector } = useAccount();
  const { disconnect } = useDisconnect();
  const walletChainId = useChainId();
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();
  const { selectedChainId } = useChainStore();
  const { setSelectedChain } = useChainStore();
  const chainId = typeof selectedChainId === 'number' ? selectedChainId : Number(selectedChainId);
  const publicClient = usePublicClient({ chainId });
  const { amm, isLoading: isLoadingAmm } = useAmmMarketDirect(address);
  const { launchpad, isLoading: isLoadingLaunchpad } = useLaunchpadMarketDirect(address);
  const { contracts } = useDeployments();
  const ammEngineAddress = contracts.AMMEngine as `0x${string}` | undefined;
  const { available: spendableProceeds } = useAvailableBalance(ammEngineAddress);
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

  // Contract State: 1 = YES, 0 = NO
  const [selectedOutcome, setSelectedOutcome] = useState<0 | 1>(1);
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('10');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [pendingToastId, setPendingToastId] = useState<string | null>(null);
  const [pendingTradeInfo, setPendingTradeInfo] = useState<{ mode: string; shares: string; outcome: string } | null>(null);
  const [pendingTxHash, setPendingTxHash] = useState<`0x${string}` | null>(null);

  // Contract write hooks
  const { writeContract: approve, data: approveTxHash, isPending: isApproving } = useWriteContract();
  const { writeContract: trade, data: tradeTxHash, isPending: isTrading } = useWriteContract();

  const { isLoading: isApprovePending } = useWaitForTransactionReceipt({ hash: approveTxHash, pollingInterval: 2000 });

  // Only watch for the specific pending transaction to avoid stale success states
  const { isLoading: isTradePending, isSuccess: isTradeSuccess, isError: isTradeError, error: tradeReceiptError } = useWaitForTransactionReceipt({
    hash: pendingTxHash ?? undefined,
    pollingInterval: 2000
  });

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
  const quote = useAMMQuoteDirect(address, amount, selectedOutcome, tradeMode === 'buy');

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

  // Refetch allowance after trade completes - handled by isTradeSuccess effect now

  // USDC decimals (default to 18 for MockUSDC on testnets)
  const decimals = Number(usdcDecimals ?? 18);

  // --- Position + Balances (for MAX + validation) ---

  const { data: ammPosition, isLoading: isLoadingPosition } = useAMMPositionDirect(address);
  const invalidateV8Queries = useInvalidateQueries();

  // Refetch after trade confirmation and update toast
  useEffect(() => {
    if (isTradeSuccess && pendingToastId && pendingTxHash) {
      const info = pendingTradeInfo;
      toast.success(
        `${info?.mode === 'buy' ? 'Bought' : 'Sold'} ${info?.shares} ${info?.outcome} shares!`,
        { id: pendingToastId }
      );
      setPendingToastId(null);
      setPendingTradeInfo(null);
      setPendingTxHash(null);
      setAmount('10');
      // Invalidate ALL V8 queries to refresh everything immediately
      invalidateV8Queries();
      refetchAllowance();
    }
  }, [isTradeSuccess, pendingToastId, pendingTxHash, pendingTradeInfo, invalidateV8Queries, refetchAllowance]);

  // Handle trade error
  useEffect(() => {
    if (isTradeError && pendingToastId && pendingTxHash) {
      const reason = tradeReceiptError?.message || 'Transaction failed';
      toast.error(reason, { id: pendingToastId });
      setPendingToastId(null);
      setPendingTradeInfo(null);
      setPendingTxHash(null);
    }
  }, [isTradeError, pendingToastId, pendingTxHash, tradeReceiptError]);

  const yesPositionWad = ammPosition?.yesShares ?? 0n;
  const noPositionWad = ammPosition?.noShares ?? 0n;
  // 1=YES, 0=NO
  const maxSellWad = selectedOutcome === 1 ? yesPositionWad : noPositionWad;

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
  const isInitStateLoading = isConnected && (isLoadingAmm || isLoadingLaunchpad);

  const marketConfig = useMemo(() => {
    const addr = address?.toLowerCase();
    return marketConfigs.find((m: any) => String(m.contractAddress).toLowerCase() === addr);
  }, [address]);
  const expectedChainId = Number((marketConfig as any)?.chainId || 0) || undefined;
  const expectedChain = expectedChainId ? getChainById(expectedChainId) : undefined;
  const selectedChain = getChainById(chainId);
  const isWrongSelectedChain = !!expectedChainId && chainId !== expectedChainId;
  const isWrongWalletChain = !!expectedChainId && walletChainId !== expectedChainId;

  const isQuoteValid = useMemo(() => {
    if (!canTrade) return false;
    if (sharesNum <= 0) return false;
    if (quote.isLoading) return false;
    if (quote.error) return false;
    if (!quote.deltaShares || quote.deltaShares === 0n) return false;
    // AMM quotes return positive numbers for both cost (buys) and proceeds (sells).
    return quote.cost > 0n;
  }, [canTrade, sharesNum, quote.isLoading, quote.error, quote.deltaShares, quote.cost, tradeMode]);

  const isPhantomConnector = useMemo(() => {
    const name = (connector as any)?.name ? String((connector as any).name).toLowerCase() : '';
    const id = (connector as any)?.id ? String((connector as any).id).toLowerCase() : '';
    return name.includes('phantom') || id.includes('phantom');
  }, [connector]);

  // Formatters
  const fmtQty = (val: bigint) => Number(formatUnits(val, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 });

  const wadToTokenCeil = (wadAmount: bigint) => {
    if (wadAmount <= 0n) return 0n;
    if (decimals === 18) return wadAmount;
    if (decimals < 18) {
      const factor = 10n ** BigInt(18 - decimals);
      return (wadAmount + factor - 1n) / factor;
    }
    const factor = 10n ** BigInt(decimals - 18);
    return wadAmount * factor;
  };

  // For buys, LaunchpadEngine only pulls from wallet:
  //   fromWallet = max(0, baseCost - spendableAvailable) + fee
  // Fee is always from wallet (even if baseCost is fully covered by spendable proceeds).
  const requiredFromWalletWad = useMemo(() => {
    if (tradeMode !== 'buy') return 0n;
    const baseCost = quote.netCost ?? 0n; // baseCost (WAD)
    const fee = quote.fee ?? 0n; // fee (WAD)
    if (baseCost <= 0n) return 0n;
    const available = spendableProceeds ?? 0n;
    const fromBalance = available > baseCost ? baseCost : available;
    return (baseCost - fromBalance) + fee;
  }, [tradeMode, quote.netCost, quote.fee, spendableProceeds]);

  // Check if approval is needed (only for the wallet portion)
  const needsApproval = useMemo(() => {
    if (tradeMode !== 'buy') return false;
    if (requiredFromWalletWad <= 0n) return false;
    if (usdcAllowance === undefined) return false;

    const requiredToken = wadToTokenCeil(requiredFromWalletWad);
    // Add 1% buffer for slippage
    const requiredAllowance = (requiredToken * 101n) / 100n;
    return (usdcAllowance as bigint) < requiredAllowance;
  }, [tradeMode, requiredFromWalletWad, usdcAllowance, decimals]);

  // Check if user has enough wallet balance for the wallet-pulled portion
  const hasEnoughBalance = useMemo(() => {
    if (tradeMode !== 'buy') return true;
    if (requiredFromWalletWad <= 0n) return true;
    const requiredToken = wadToTokenCeil(requiredFromWalletWad);
    return walletUsdcToken >= requiredToken;
  }, [tradeMode, walletUsdcToken, requiredFromWalletWad, decimals]);

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

  // Connect/Switch wallet handler
  const handleConnect = async () => {
    // If already connected with Phantom, disconnect first to allow switching
    if (isConnected && isPhantomConnector) {
      disconnect();
      // Wait a moment for disconnect to complete
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    // Click the AppKit button to open wallet modal
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
      const sellable = selectedOutcome === 1 ? yesPositionWad : noPositionWad;
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
    const price = selectedOutcome === 1 ? yesPrice : noPrice;
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
          abi: ABIS.AMMEngine,
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
  const handleTrade = async () => {
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
      toast.error('Market is not ready for trading yet.');
      return;
    }

    if (quote.deltaShares === undefined || quote.deltaShares === 0n) {
      toast.error('Invalid quote - please enter shares amount');
      return;
    }

    const deltaShares = quote.deltaShares;

    // Slippage guard:
    // - BUY: maxCost = +5% buffer
    // - SELL: minProceeds = -5% buffer
    const limitCost = tradeMode === 'buy'
      ? (quote.cost * 105n) / 100n
      : (quote.cost * 95n) / 100n;

    console.log('[Trade] Executing (V9):', {
      market: address,
      outcome: selectedOutcome,
      deltaShares: deltaShares.toString(),
      limitCost: limitCost.toString(),
    });

    const tradeInfo = {
      mode: tradeMode,
      shares: sharesNum.toString(),
      outcome: selectedOutcome === 1 ? 'YES' : 'NO'
    };

    try {
      // V9 LaunchpadEngine logic:
      // 1. Unified function 'tradePositions'
      // 2. Contract automatically checks availableProceeds in AMMEngine
      // 3. Contract pulls ONLY needed remainder from wallet
      // 4. No need for manual 'depositAndTradeAMM'
      // Dynamic gas estimation based on this trade's graduation impact:
      // - Normal trades: 2M gas (safe for Monad)
      // - Trades predicted to trigger graduation: 5M gas to cover token deploy + TickBook registration
      const gasLimit = quote.willGraduate ? 5000000n : 2000000n;

      // Simulate first to catch specific revert reasons
      if (publicClient) {
        try {
          console.log('[Trade] Simulating tradePositions...', {
            address: contracts.LaunchpadEngine,
            args: [address, selectedOutcome, deltaShares, limitCost]
          });

          await publicClient.simulateContract({
            account: userAddress,
            address: contracts.LaunchpadEngine as `0x${string}`,
            abi: ABIS.LaunchpadEngine,
            functionName: 'tradePositions',
            args: [address, selectedOutcome, deltaShares, limitCost],
            // Use same gas limit for simulation to catch OOG
            gas: gasLimit,
          });
          console.log('[Trade] Simulation successful');
        } catch (simError: any) {
          console.error('[Trade] Simulation failed:', simError);
          const reason = simError.cause?.reason || simError.shortMessage || simError.message || 'Unknown revert reason';
          toast.error(`Simulation failed: ${reason}`);
          return; // Abort trade
        }
      }

      trade({
        address: contracts.LaunchpadEngine as `0x${string}`,
        abi: ABIS.LaunchpadEngine,
        functionName: 'tradePositions',
        args: [address, selectedOutcome, deltaShares, limitCost],
        gas: gasLimit,
      }, {
        onSuccess: (hash) => {
          console.log('[Trade] Transaction submitted! Hash:', hash);
          const toastId = toast.loading(`Confirming ${tradeInfo.mode} ${tradeInfo.shares} ${tradeInfo.outcome}...`);
          setPendingTxHash(hash);
          setPendingToastId(toastId);
          setPendingTradeInfo(tradeInfo);
        },
        onError: (error: any) => {
          console.error('[Trade] Error:', error);
          const errorMsg = error?.cause?.shortMessage || error?.message || 'Transaction failed';
          toast.error(`Trade failed: ${errorMsg}`);
        },
      });
    } catch (err) {
      console.error('[Trade] Unexpected error:', err);
      toast.error('Unexpected error during trade');
    }
  };

  if (isSettled) {
    return (
      <div className="p-4 text-center">
        <div className="text-slate-400 mb-2">⚖️ Market Settled</div>
        <p className="text-sm text-slate-500">Trading is closed for this market.</p>
      </div>
    );
  }

  const isPending = isApproving || isApprovePending || isTrading || isTradePending;

  const getButtonContent = () => {
    if (isPending) return <Loader2 size={16} className="mr-2 animate-spin" />;
    if (!canTrade) return 'Market Uninitialized';
    if (sharesNum <= 0) return 'Enter Amount';
    if (!isQuoteValid) return quote.isLoading ? 'Loading Quote…' : 'Quote Unavailable';
    if (tradeMode === 'buy') {
      if (!hasEnoughBuyingPower) return 'Insufficient Balance';
      return `Buy ${selectedOutcome === 1 ? 'YES' : 'NO'} with ${quote.costFormatted}`;
    } else {
      if (!hasEnoughShares) return 'Insufficient Position';
      return `Sell ${selectedOutcome === 1 ? 'YES' : 'NO'} for ${quote.costFormatted}`;
    }
  };

  const isButtonDisabled =
    isPending ||
    !canTrade ||
    sharesNum <= 0 ||
    !!amountError ||
    !isQuoteValid ||
    isPhantomConnector ||
    (tradeMode === 'buy' && !hasEnoughBuyingPower) ||
    (tradeMode === 'sell' && !hasEnoughShares);

  return (
    <div data-testid="trading-panel">
      {/* Primary Toggle: YES / NO - tab style with underline */}
      <div className="flex border-b border-slate-800/50">
        <button
          onClick={() => setSelectedOutcome(1)}
          className={cn(
            "flex-1 py-3 font-bold text-sm uppercase tracking-wider transition-all",
            selectedOutcome === 1
              ? "text-emerald-400 border-b-2 border-emerald-500 bg-emerald-500/5"
              : "text-slate-500 hover:text-slate-300 border-b-2 border-transparent"
          )}
        >
          YES
        </button>
        <button
          onClick={() => setSelectedOutcome(0)}
          className={cn(
            "flex-1 py-3 font-bold text-sm uppercase tracking-wider transition-all",
            selectedOutcome === 0
              ? "text-rose-400 border-b-2 border-rose-500 bg-rose-500/5"
              : "text-slate-500 hover:text-slate-300 border-b-2 border-transparent"
          )}
        >
          NO
        </button>
      </div>

      <div className="p-5 space-y-4">
        {/* Initialization Warning */}
        {isInitStateLoading && (
          <div className="p-2 rounded-lg bg-slate-800/40 border border-slate-700/40 text-[10px] text-slate-400 flex items-start gap-2">
            <Loader2 size={12} className="shrink-0 mt-0.5 animate-spin" />
            <span>Checking market initialization…</span>
          </div>
        )}

        {/* Phantom Guard */}
        {isConnected && isPhantomConnector && (
          <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[10px] text-rose-300 flex items-start gap-2">
            <AlertCircle size={12} className="shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div>
                Wallet blocked: <strong>Phantom</strong> is intercepting this transaction.
              </div>
              <div className="text-rose-200/70">
                Switch to <strong>MetaMask</strong> or <strong>Coinbase Wallet</strong> to trade.
              </div>
              <div className="pt-1">
                <Button
                  onClick={handleConnect}
                  className="h-7 px-2 text-[10px] bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30"
                >
                  Switch Wallet
                </Button>
              </div>
            </div>
          </div>
        )}

        {!isInitStateLoading && isConnected && !canTrade && (isWrongSelectedChain || isWrongWalletChain) && (
          <div className="p-2 rounded-lg bg-slate-500/10 border border-slate-500/20 text-[10px] text-slate-300 flex items-start gap-2">
            <AlertCircle size={12} className="shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div>
                Trading unavailable: this market isn't initialized on the <strong>selected network</strong>.
              </div>
              <div className="text-slate-200/70">
                Selected: <strong>{selectedChain?.name ?? `Chain ${chainId}`}</strong>
                {expectedChain ? (
                  <>
                    {' '}• Market lives on: <strong>{expectedChain.name}</strong>
                  </>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {isWrongSelectedChain && expectedChainId ? (
                  <Button
                    onClick={() => setSelectedChain(expectedChainId)}
                    className="h-7 px-2 text-[10px] bg-slate-500/20 hover:bg-slate-500/30 border border-slate-500/30"
                  >
                    View {expectedChain?.shortName ?? `Chain ${expectedChainId}`}
                  </Button>
                ) : null}
                {isWrongWalletChain && expectedChainId ? (
                  <Button
                    onClick={() => switchChain?.({ chainId: expectedChainId })}
                    disabled={isSwitchingChain}
                    className="h-7 px-2 text-[10px] bg-slate-900/40 hover:bg-slate-900/60 border border-slate-700/50"
                  >
                    {isSwitchingChain ? 'Switching…' : `Switch wallet to ${expectedChain?.shortName ?? expectedChainId}`}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {!isInitStateLoading && isConnected && !canTrade && !isWrongSelectedChain && !isWrongWalletChain && (
          <div className="p-2 rounded-lg bg-slate-500/10 border border-slate-500/20 text-[10px] text-slate-300 flex items-start gap-2">
            <AlertCircle size={12} className="shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div>
                Trading unavailable: {!isMarketCreated ? 'market not found' : 'AMM not yet initialized'}.
              </div>
              <div className="text-slate-200/70">
                The market may still be pending initialization or does not exist at this address.
              </div>
            </div>
          </div>
        )}

        {/* Current Price Display - clean separate row */}
        <div className="rounded-xl bg-slate-950 border border-slate-800 overflow-hidden">
          <div className="flex items-center justify-between py-2 px-3">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Current Price</div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-lg font-mono font-bold text-emerald-400">
                  {isLoadingAmm ? '—' : `${(yesPrice * 100).toFixed(1)}%`}
                </span>
              </div>
              {/* Compact bar */}
              <div className="w-20 h-1.5 rounded-full overflow-hidden flex bg-slate-800">
                <div
                  className="h-full bg-emerald-500 transition-all duration-500"
                  style={{ flex: yesPrice > 0n ? Number(yesPrice) : 1 }}
                />
                <div
                  className="h-full bg-rose-500 transition-all duration-500"
                  style={{ flex: noPrice > 0n ? Number(noPrice) : 1 }}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-mono font-bold text-rose-400">
                  {isLoadingAmm ? '—' : `${(noPrice * 100).toFixed(1)}%`}
                </span>
                <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
              </div>
            </div>
          </div>
          {/* Issued Shares - compact row */}
          <div className="flex items-center justify-between px-3 py-1.5 border-t border-slate-800/50 bg-slate-900/30">
            <div className="text-[9px] text-slate-600 uppercase tracking-wider">Pool Shares</div>
            <div className="flex items-center gap-4 text-[10px] font-mono">
              <span className="text-emerald-500">
                {isLoadingAmm ? '—' : `${(Number(amm?.qYes ?? 0n) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 })} YES`}
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-rose-500">
                {isLoadingAmm ? '—' : `${(Number(amm?.qNo ?? 0n) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 })} NO`}
              </span>
            </div>
          </div>
        </div>

        {/* Buy/Sell Toggle - matches Pro style, contextual colors */}
        <div className="flex gap-1 p-1 bg-slate-950 rounded-lg">
          <button
            onClick={() => setTradeMode('buy')}
            className={cn(
              "flex-1 py-2 rounded-md font-bold text-xs uppercase transition-all",
              tradeMode === 'buy'
                ? selectedOutcome === 1
                  ? "bg-emerald-600/30 text-emerald-400 ring-1 ring-emerald-500/50"
                  : "bg-rose-600/30 text-rose-400 ring-1 ring-rose-500/50"
                : "text-slate-500 hover:text-slate-300"
            )}
          >
            Buy
          </button>
          <button
            onClick={() => setTradeMode('sell')}
            className={cn(
              "flex-1 py-2 rounded-md font-bold text-xs uppercase transition-all",
              tradeMode === 'sell'
                ? "bg-slate-600/30 text-slate-400 ring-1 ring-slate-500/50"
                : "text-slate-500 hover:text-slate-300"
            )}
          >
            Sell
          </button>
        </div>

        {/* Amount Input - Pro style */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-[10px] text-slate-500 uppercase tracking-wider">Shares</label>
            {isConnected && (
              <button
                onClick={handleMax}
                className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold uppercase tracking-wider"
              >
                MAX
              </button>
            )}
          </div>
          <div className="relative">
            <button
              onClick={() => setAmount(prev => String(Math.max(1, Number(prev) - 1)))}
              className="absolute left-0 top-0 h-full px-4 flex items-center justify-center text-slate-500 hover:text-white transition-colors z-10"
            >
              <span className="text-lg font-bold">−</span>
            </button>
            <input
              type="number"
              data-testid="shares-input"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              aria-invalid={amountError ? 'true' : 'false'}
              className="w-full px-14 py-3 bg-slate-950 border border-slate-700 rounded-xl text-xl font-mono font-bold text-center focus:border-cyan-500 focus:outline-none transition-colors"
              placeholder="10"
              min="0"
            />
            <button
              onClick={() => setAmount(prev => String(Number(prev) + 1))}
              className="absolute right-0 top-0 h-full px-4 flex items-center justify-center text-slate-500 hover:text-white transition-colors z-10"
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
            <div className="mt-2 flex justify-between text-[10px] text-slate-500">
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
            <div className="mt-2 flex justify-between text-[10px] text-slate-500">
              <span>Buying power</span>
              <span className="font-mono text-slate-300">
                ${(Number(buyingPowerWad) / 1e18).toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* Quick Amount Buttons - Pro style */}
        <div className="flex gap-2">
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
                    'flex-1 py-1.5 text-xs font-mono rounded transition-colors',
                    maxSellWad <= 0n
                      ? 'bg-slate-900/30 text-slate-600 cursor-not-allowed'
                      : amount === target
                        ? 'bg-slate-500/20 text-slate-400'
                        : 'bg-slate-900 text-slate-500 hover:text-white hover:bg-slate-800'
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
                  'flex-1 py-1.5 text-xs font-mono rounded transition-colors',
                  amount === String(val)
                    ? selectedOutcome === 1 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                    : 'bg-slate-900 text-slate-500 hover:text-white hover:bg-slate-800'
                )}
              >
                {val}
              </button>
            ))}
        </div>

        {/* Quote Summary - Pro style */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
          {/* USDC Amount - Primary Display */}
          <div className="flex justify-between items-center">
            <span className="text-slate-400 text-sm">
              {tradeMode === 'buy' ? 'You Pay' : 'You Receive'}
            </span>
            <span data-testid="quote-cost" className={cn("font-mono text-lg font-bold", tradeMode === 'buy' ? "text-white" : "text-emerald-400")}>
              {quote.isLoading ? <span className="skeleton w-20 h-6 inline-block rounded" /> : (isQuoteValid ? quote.costFormatted : '—')}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">
              Fee ({(quote.feeRate / 100).toFixed(1)}%)
            </span>
            <span data-testid="quote-fee" className="font-mono text-slate-400">
              {isQuoteValid ? quote.feeFormatted : '—'}
            </span>
          </div>

          {/* Liquidity (b) */}
          <div className="flex justify-between text-sm pt-2 border-t border-slate-800/50">
            <span className="text-slate-600">Liquidity Depth (b)</span>
            <span className="font-mono text-slate-500">
              {launchpad?.currentBBase ? `${(Number(launchpad.currentBBase) / 1e18).toFixed(2)}` : 'Not initialized'}
            </span>
          </div>

          {/* Price Impact - only show when we have a valid quote */}
          {isQuoteValid && (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Price Impact</span>
                <span className={cn(
                  "font-mono",
                  Math.abs(quote.priceImpact) > 5 ? 'text-rose-400 font-bold' :
                    Math.abs(quote.priceImpact) > 2 ? 'text-slate-400 font-bold' : 'text-slate-400'
                )}>
                  {quote.priceImpact > 0 ? '+' : ''}{quote.priceImpact.toFixed(2)}%
                </span>
              </div>

              {/* Impact Warnings */}
              {Math.abs(quote.priceImpact) > 5 ? (
                <div className="p-2 rounded-lg bg-rose-950/30 border border-rose-900/30 text-[10px] text-rose-400 flex items-start gap-2">
                  <AlertCircle size={12} className="shrink-0 mt-0.5" />
                  <span><strong>High Impact!</strong> Consider trading in smaller sizes.</span>
                </div>
              ) : Math.abs(quote.priceImpact) > 2 ? (
                <div className="p-2 rounded-lg bg-slate-950/30 border border-slate-900/30 text-[10px] text-slate-400 flex items-start gap-2">
                  <AlertCircle size={12} className="shrink-0 mt-0.5" />
                  <span>Significant price impact. Check execution price.</span>
                </div>
              ) : null}
            </>
          )}

          {/* Spendable Proceeds Indicator */}
          {tradeMode === 'buy' && isQuoteValid && spendableProceeds > 0n && quote.cost > 0n && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-950/30 border border-emerald-900/30 text-[10px] text-emerald-400">
              <Unlock size={12} className="shrink-0" />
              <span>
                Using up to <strong>${(Number(spendableProceeds) / 1e18).toFixed(2)}</strong> from spendable proceeds.
              </span>
            </div>
          )}

          {/* New Price After Trade */}
          {isQuoteValid && (
            <div className="flex justify-between text-sm pt-2 border-t border-slate-800/50">
              <span className="text-slate-500">
                {selectedOutcome === 1 ? 'YES' : 'NO'} Prob
              </span>
              <div className="flex items-center gap-1">
                <span className="font-mono text-slate-400">
                  {(selectedOutcome === 1 ? yesPrice * 100 : noPrice * 100).toFixed(1)}%
                </span>
                <ArrowRight className="w-3 h-3 text-slate-600" />
                <span className={cn("font-mono", selectedOutcome === 1 ? 'text-emerald-400' : 'text-rose-400')}>
                  {((selectedOutcome === 1 ? quote.newYesPrice : quote.newNoPrice) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Quote Error */}
        {isConnected && sharesNum > 0 && !quote.isLoading && quote.error && (
          <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-900/30 text-xs text-rose-400 flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0" />
            <span>Quote failed for this size. Try a smaller amount.</span>
          </div>
        )}

        {/* Balance Summary */}
        {isConnected && (
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">Wallet USDC</span>
              <span className="font-mono text-slate-200">
                ${(Number(walletUsdcToken) / (10 ** decimals)).toFixed(2)}
              </span>
            </div>
            {spendableProceeds > 0n && (
              <div className="flex justify-between">
                <span className="text-slate-500">Spendable Proceeds</span>
                <span className="font-mono text-emerald-400">
                  ${(Number(spendableProceeds) / 1e18).toFixed(2)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Balance Warning */}
        {isConnected && tradeMode === 'buy' && !hasEnoughBuyingPower && sharesNum > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-950/30 border border-rose-900/30 text-rose-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Insufficient balance. <span className="text-rose-300">Try a smaller amount.</span></span>
          </div>
        )}

        {/* Spendable Proceeds Notice */}
        {tradeMode === 'sell' && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-cyan-950/30 border border-cyan-900/30 text-cyan-400 text-xs">
            <Info size={14} className="shrink-0" />
            <span>Proceeds are <strong>instantly spendable</strong> but locked for withdrawal for 24h.</span>
          </div>
        )}

        {/* Action Button - Pro style with contextual gradient */}
        {!isConnected ? (
          <Button
            onClick={handleConnect}
            className="w-full py-4 text-lg font-bold uppercase tracking-wider rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white shadow-lg shadow-cyan-600/25"
          >
            <Wallet size={18} className="mr-2" />
            Connect Wallet
          </Button>
        ) : needsApproval && tradeMode === 'buy' ? (
          <Button
            onClick={handleApprove}
            disabled={isPending || !canTrade || isPhantomConnector}
            className="w-full py-4 text-lg font-bold uppercase tracking-wider rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white shadow-lg shadow-cyan-600/25 disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 size={18} className="mr-2 animate-spin" />
            ) : null}
            {isPhantomConnector ? 'Switch Wallet' : 'Approve USDC'}
          </Button>
        ) : (
          <Button
            onClick={handleTrade}
            disabled={isButtonDisabled}
            data-testid={tradeMode === 'buy' ? 'buy-button' : 'sell-button'}
            className={cn(
              "w-full py-4 text-lg font-bold uppercase tracking-wider rounded-xl transition-all",
              tradeMode === 'buy' && selectedOutcome === 1 && "bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 shadow-lg shadow-emerald-600/25",
              tradeMode === 'buy' && selectedOutcome === 0 && "bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 shadow-lg shadow-rose-600/25",
              tradeMode === 'sell' && "bg-gradient-to-r from-slate-600 to-slate-500 hover:from-slate-500 hover:to-slate-400 shadow-lg shadow-slate-600/25",
              isButtonDisabled && "opacity-50 cursor-not-allowed"
            )}
          >
            {getButtonContent()}
          </Button>
        )}
      </div>
    </div>
  );
};
