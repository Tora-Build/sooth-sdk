import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, CheckCircle, AlertCircle, ExternalLink, Clock, Users } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { useMarkets, useAMMQuote, useAMMTrade, useUSDCBalance } from '../hooks';
import { getMarketImage } from '../lib/images';

type Outcome = 0 | 1;

const QUICK_AMOUNTS = ['10', '25', '50', '100'];
const URL_REGEX = /(https?:\/\/[^\s]+)/g;

function parseTextWithLinks(text: string): React.ReactNode[] {
  const parts = text.split(URL_REGEX);
  return parts.map((part, index) => {
    if (URL_REGEX.test(part)) {
      URL_REGEX.lastIndex = 0;
      let displayText: string;
      try {
        const url = new URL(part);
        displayText = url.hostname.replace('www.', '');
      } catch {
        displayText = 'link';
      }
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
        >
          {displayText}
          <ExternalLink className="w-3 h-3" />
        </a>
      );
    }
    return part;
  });
}

export function Trade() {
  const { marketId } = useParams<{ marketId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();
  const { open: openWallet } = useAppKit();
  const { data: markets } = useMarkets();
  const { balanceFormatted: usdcBalance } = useUSDCBalance(address);
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
  const yesPercent = Math.round(probability * 100);
  const noPercent = 100 - yesPercent;
  const imageUrl = getMarketImage(market.question, market.address);

  return (
    <div className="h-full w-full flex flex-col bg-mesh">
      <div className="relative h-48 overflow-hidden">
        <img src={imageUrl} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#060b19]/60 via-transparent to-[#060b19]" />

        <header className="absolute top-0 left-0 right-0 flex items-center gap-3 px-4 pt-14 pb-4">
          <button onClick={() => navigate('/')} className="p-2 -ml-2 rounded-full glass-panel bounce-button">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1" />
          <a
            href={`https://testnet.monadexplorer.com/address/${market.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-full glass-panel bounce-button"
          >
            <ExternalLink className="w-4 h-4 text-white" />
          </a>
        </header>
      </div>

      <div className="flex-1 overflow-y-auto -mt-8 relative z-10">
        <div className="bg-[#060b19] rounded-t-3xl min-h-full">
          <div className="p-5 space-y-5">
            <h1 className="text-xl font-bold text-white leading-tight font-heading">
              {parseTextWithLinks(market.question)}
            </h1>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl glass-panel">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-3 h-3 text-white/40" />
                  <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Ends In</span>
                </div>
                <p className="text-sm font-bold text-white">14d 22h</p>
              </div>
              <div className="p-4 rounded-2xl glass-panel">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-3 h-3 text-white/40" />
                  <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Traders</span>
                </div>
                <p className="text-sm font-bold text-white">4.8k</p>
              </div>
            </div>

            {isConnected && (
              <div className="flex justify-between items-center py-3 px-4 glass-panel rounded-2xl">
                <span className="text-white/40 text-sm font-medium">Your Balance</span>
                <span className="text-white font-mono font-bold">{usdcBalance} USDC</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setOutcome(1)}
                disabled={isTrading}
                className={`p-4 rounded-2xl border-2 transition-all bounce-button ${
                  outcome === 1
                    ? 'bg-cyan-500/20 border-cyan-500 neon-cyan'
                    : 'glass-panel border-white/10 hover:border-white/20'
                } ${isTrading ? 'opacity-50' : ''}`}
              >
                <div className={`text-sm font-bold mb-1 ${outcome === 1 ? 'text-cyan-400' : 'text-white/40'}`}>
                  Yes
                </div>
                <div className={`text-3xl font-bold tabular-nums font-mono ${outcome === 1 ? 'text-white' : 'text-white/60'}`}>
                  {yesPercent}c
                </div>
              </button>

              <button
                onClick={() => setOutcome(0)}
                disabled={isTrading}
                className={`p-4 rounded-2xl border-2 transition-all bounce-button ${
                  outcome === 0
                    ? 'bg-fuchsia-600/20 border-fuchsia-500 neon-magenta'
                    : 'glass-panel border-white/10 hover:border-white/20'
                } ${isTrading ? 'opacity-50' : ''}`}
              >
                <div className={`text-sm font-bold mb-1 ${outcome === 0 ? 'text-fuchsia-400' : 'text-white/40'}`}>
                  No
                </div>
                <div className={`text-3xl font-bold tabular-nums font-mono ${outcome === 0 ? 'text-white' : 'text-white/60'}`}>
                  {noPercent}c
                </div>
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-white/40 text-sm font-medium">Amount (shares)</span>
                <span className="text-white/40 text-xs font-mono">~ ${quote.costFormatted}</span>
              </div>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isTrading}
                className="w-full p-4 rounded-2xl glass-panel border border-white/10 text-white text-2xl font-bold font-mono text-center focus:outline-none focus:border-cyan-500/50 disabled:opacity-50 transition-all"
                placeholder="0"
              />
              <div className="flex gap-2">
                {QUICK_AMOUNTS.map((val) => (
                  <button
                    key={val}
                    onClick={() => setAmount(val)}
                    disabled={isTrading}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all bounce-button ${
                      amount === val
                        ? 'bg-cyan-500 text-white neon-cyan'
                        : 'glass-panel text-white/40 hover:text-white'
                    } disabled:opacity-50`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-white/40">Avg Price</span>
                <span className="text-white font-mono font-semibold">
                  {(parseFloat(quote.costFormatted) / parseFloat(amount || '1')).toFixed(2)}c
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/40">Fee ({quote.feeRateBps / 100}%)</span>
                <span className="text-white/60 font-mono">{quote.feeFormatted}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/40">Potential Return</span>
                <span className="text-cyan-400 font-mono font-semibold">
                  {parseFloat(amount || '0') > 0
                    ? `$${(parseFloat(amount) - parseFloat(quote.costFormatted)).toFixed(2)}`
                    : '--'}
                </span>
              </div>
              <div className="h-px bg-white/10" />
              <div className="flex justify-between">
                <span className="text-white font-bold">Total Cost</span>
                <span className="text-white font-bold font-mono text-lg">${quote.costFormatted}</span>
              </div>
            </div>

            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                <p className="text-rose-400 text-sm font-medium">{error}</p>
              </div>
            )}

            {status === 'success' && (
              <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-2xl p-4 flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-cyan-400" />
                <p className="text-cyan-400 text-sm font-bold">Trade executed successfully!</p>
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
              ? 'bg-cyan-500 text-white neon-cyan'
              : status === 'error'
              ? 'bg-rose-500 text-white'
              : outcome === 1
              ? 'bg-cyan-500 hover:bg-cyan-400 text-white neon-cyan'
              : 'bg-fuchsia-600 hover:bg-fuchsia-500 text-white neon-magenta'
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
