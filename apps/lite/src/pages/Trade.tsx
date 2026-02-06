import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, CheckCircle, AlertCircle, ExternalLink, Clock, Users, Coins } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { useMarkets, useAMMQuote, useAMMTrade, useUSDCBalance } from '../hooks';
import { getMarketImage } from '../lib/images';
import { parseTextWithLinks } from '../lib/utils';

type Outcome = 0 | 1;

const QUICK_AMOUNTS = ['10', '25', '50', '100'];

export function Trade() {
  const { marketId } = useParams<{ marketId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();
  const { open: openWallet } = useAppKit();
  const { data: markets } = useMarkets();
  const { balance: usdcBalanceRaw, balanceFormatted: usdcBalance } = useUSDCBalance(address);
  const { status, error, executeTrade, reset } = useAMMTrade();

  const initialOutcome = searchParams.get('outcome') === '0' ? 0 : 1;
  const [outcome, setOutcome] = useState<Outcome>(initialOutcome as Outcome);
  const [amount, setAmount] = useState('10');

  useEffect(() => {
    const outcomeParam = searchParams.get('outcome');
    if (outcomeParam === '0' || outcomeParam === '1') {
      setOutcome(Number(outcomeParam) as Outcome);
    }
  }, [searchParams]);

  const market = markets?.find((m) => m.address === marketId);
  const quote = useAMMQuote(
    marketId as `0x${string}` | undefined,
    amount,
    outcome,
    market?.yesProbability ?? 0.5
  );

  const handleBuy = async () => {
    if (!isConnected) {
      openWallet();
      return;
    }

    if (!marketId || quote.deltaShares <= 0n) return;

    reset();
    await executeTrade(
      marketId as `0x${string}`,
      outcome,
      quote.deltaShares,
      quote.limitCost
    );
  };

  const isTrading = status === 'checking' || status === 'approving' || status === 'trading';

  const getButtonText = () => {
    if (!isConnected) return 'Connect Wallet';
    if (status === 'checking') return 'Checking...';
    if (status === 'approving') return 'Approving USDC...';
    if (status === 'trading') return 'Confirming...';
    if (status === 'success') return 'Trade Successful!';
    if (status === 'error') return 'Try Again';
    return `Buy ${outcome === 1 ? 'Yes' : 'No'} Shares`;
  };

  if (!market) {
    return (
      <div className="h-full w-full flex flex-col bg-mesh">
        <header className="flex items-center gap-3 px-4 pt-14 pb-4 glass-header border-b border-white/5">
          <button onClick={() => navigate('/')} className="p-2 -ml-2 rounded-full hover:bg-white/10 bounce-button">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <span className="text-white font-bold">Trade</span>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center">
          <p className="text-white/40 font-medium">Market not found</p>
        </div>
      </div>
    );
  }

  const probability = market.yesProbability ?? 0.5;
  const yesPercent = (probability * 100).toFixed(1);
  const noPercent = (100 - probability * 100).toFixed(1);
  const imageUrl = getMarketImage(market.question, market.address);

  return (
    <div className="h-full w-full flex flex-col bg-mesh relative">
      <div className="absolute inset-x-0 top-0 h-72 overflow-hidden pointer-events-none">
        <img src={imageUrl} alt="" className="w-full h-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#060b19]/80 to-[#060b19]" />
      </div>

      <header className="relative z-20 flex items-center justify-between px-6 pt-4 h-14">
        <button onClick={() => navigate('/')} className="p-2 -ml-2 rounded-lg glass-panel bounce-button">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div className="flex gap-2">
          <a
            href={`https://testnet.monadexplorer.com/address/${market.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg glass-panel bounce-button"
          >
            <ExternalLink className="w-4 h-4 text-[#888] hover:text-[#00d4aa]" />
          </a>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto relative z-10">
        <div className="min-h-full">
          <div className="p-5 space-y-5">
            <h1 className="text-[28px] leading-tight font-normal text-white tracking-tight">
              {parseTextWithLinks(market.question)}
            </h1>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl glass-panel">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-3 h-3 text-[#888]" />
                  <span className="text-[10px] text-[#888] uppercase font-bold tracking-wider">Ends In</span>
                </div>
                <p className="text-sm font-bold text-white">14d 22h</p>
              </div>
              <div className="p-4 rounded-2xl glass-panel">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-3 h-3 text-[#888]" />
                  <span className="text-[10px] text-[#888] uppercase font-bold tracking-wider">Traders</span>
                </div>
                <p className="text-sm font-bold text-white">4.8k</p>
              </div>
            </div>

            {isConnected && (
              <div className="flex justify-between items-center py-3 px-4 glass-panel rounded-2xl">
                <span className="text-[#888] text-sm font-medium">Your Balance</span>
                <span className="text-[#00d4aa] font-mono font-bold">{usdcBalance} USDC</span>
              </div>
            )}

            {isConnected && usdcBalanceRaw === 0n && (
              <button
                onClick={() => navigate('/profile')}
                className="w-full p-4 bg-[#e01b24]/10 border border-[#e01b24]/30 rounded-2xl flex items-center gap-3 active:scale-95 transition-transform"
              >
                <Coins className="w-5 h-5 text-[#e01b24] shrink-0" />
                <span className="text-sm font-bold text-[#e01b24] text-left">
                  Need USDC? Tap for free test tokens!
                </span>
              </button>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setOutcome(1)}
                disabled={isTrading}
                className={`p-4 rounded-2xl border-2 transition-all bounce-button ${
                  outcome === 1
                    ? 'bg-[#00d4aa]/20 border-[#00d4aa]'
                    : 'bg-[#2d2d2e] border-[#444] hover:border-[#00d4aa]'
                } ${isTrading ? 'opacity-50' : ''}`}
              >
                <div className={`text-sm font-bold mb-1 ${outcome === 1 ? 'text-[#00d4aa]' : 'text-[#888]'}`}>
                  Yes
                </div>
                <div className={`text-3xl font-bold tabular-nums font-mono ${outcome === 1 ? 'text-white' : 'text-[#888]'}`}>
                  {yesPercent}¢
                </div>
              </button>

              <button
                onClick={() => setOutcome(0)}
                disabled={isTrading}
                className={`p-4 rounded-2xl border-2 transition-all bounce-button ${
                  outcome === 0
                    ? 'bg-[#e01b24]/20 border-[#e01b24]'
                    : 'bg-[#2d2d2e] border-[#444] hover:border-[#e01b24]'
                } ${isTrading ? 'opacity-50' : ''}`}
              >
                <div className={`text-sm font-bold mb-1 ${outcome === 0 ? 'text-[#e01b24]' : 'text-[#888]'}`}>
                  No
                </div>
                <div className={`text-3xl font-bold tabular-nums font-mono ${outcome === 0 ? 'text-white' : 'text-[#888]'}`}>
                  {noPercent}¢
                </div>
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[#888] text-sm font-medium">Amount (shares)</span>
                <span className="text-[#00d4aa] text-xs font-mono font-bold">~ ${quote.costFormatted}</span>
              </div>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isTrading}
                className="w-full p-4 rounded-2xl glass-panel border border-[#444] text-white text-2xl font-bold font-mono text-center focus:outline-none focus:border-[#00d4aa]/50 disabled:opacity-50 transition-all"
                placeholder="0"
              />
              <div className="flex gap-2">
                {QUICK_AMOUNTS.map((val) => (
                  <button
                    key={val}
                    onClick={() => setAmount(val)}
                    disabled={isTrading}
                    className={`flex-1 py-2 rounded-2xl text-sm font-bold transition-all bounce-button ${
                      amount === val
                        ? 'bg-[#00d4aa] text-[#1a1a1b]'
                        : 'glass-panel text-[#888] hover:text-white'
                    } disabled:opacity-50`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-[#888]">Avg Price</span>
                <span className="text-white font-mono font-semibold">
                  {(parseFloat(quote.costFormatted.replace(/,/g, '')) / parseFloat(amount || '1')).toFixed(2)}¢
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#888]">Fee ({quote.feeRateBps / 100}%)</span>
                <span className="text-[#7c7c7c] font-mono">{quote.feeFormatted}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#888]">Potential Return</span>
                <span className="text-[#00d4aa] font-mono font-bold">
                  {parseFloat(amount || '0') > 0
                    ? `+${(parseFloat(amount) - parseFloat(quote.costFormatted.replace(/,/g, ''))).toFixed(2)}`
                    : '--'}
                </span>
              </div>
              <div className="h-px bg-[#444]" />
              <div className="flex justify-between">
                <span className="text-white font-bold">Total Cost</span>
                <span className="text-white font-bold font-mono text-lg">${quote.costFormatted}</span>
              </div>
            </div>

            {error && (
              <div className="bg-[#e01b24]/10 border border-[#e01b24]/30 rounded-2xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-[#e01b24] flex-shrink-0 mt-0.5" />
                <p className="text-[#e01b24] text-sm font-medium">{error}</p>
              </div>
            )}

            {status === 'success' && (
              <div className="bg-[#00d4aa]/10 border border-[#00d4aa]/20 rounded-2xl p-4 flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-[#00d4aa]" />
                <p className="text-[#00d4aa] text-sm font-bold">Trade executed successfully!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 pb-8 glass-nav">
      <button
      onClick={handleBuy}
      disabled={isTrading || (isConnected && quote.deltaShares <= 0n)}
      className={`w-full py-4 rounded-2xl font-bold text-base transition-all flex items-center justify-center gap-2 bounce-button ${
            status === 'success'
              ? 'bg-[#00d4aa] text-[#1a1a1b]'
              : status === 'error'
              ? 'bg-[#e01b24] text-white'
              : outcome === 1
              ? 'bg-gradient-to-r from-[#00d4aa] to-[#00b894] text-[#1a1a1b]'
              : 'bg-gradient-to-r from-[#e01b24] to-[#ff6b35] text-white'
          } disabled:opacity-50`}
        >
          {isTrading && <Loader2 className="w-5 h-5 animate-spin" />}
          {status === 'success' && <CheckCircle className="w-5 h-5" />}
          {status === 'error' && <AlertCircle className="w-5 h-5" />}
          {getButtonText()}
        </button>
      </div>
    </div>
  );
}
