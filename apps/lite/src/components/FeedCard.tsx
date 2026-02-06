import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Share2, Clock, ExternalLink, Check, MoreHorizontal, ChevronDown } from 'lucide-react';
import type { Market } from '../hooks/useMarkets';
import { useLikes, useShare } from '../hooks/useSocial';
import { useHaptics } from '../hooks/useHaptics';
import { getMarketImage } from '../lib/images';

interface FeedCardProps {
  market: Market;
}

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
          <ExternalLink className="w-4 h-4" />
        </a>
      );
    }
    return part;
  });
}

function formatTimeRemaining(deadline?: bigint): string {
  if (!deadline) return '--';

  const now = BigInt(Math.floor(Date.now() / 1000));
  if (deadline <= now) return 'Ended';

  const diff = Number(deadline - now);
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h`;
  return `${Math.floor((diff % 3600) / 60)}m`;
}

function formatVolume(totalLPSupply?: bigint): string {
  if (!totalLPSupply) return '$0';

  const value = Number(totalLPSupply) / 1e18;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function formatCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return count.toString();
}

export function FeedCard({ market }: FeedCardProps) {
  const navigate = useNavigate();
  const probability = market.yesProbability ?? 0.5;
  const yesPercent = (probability * 100).toFixed(1);
  const noPercent = (100 - probability * 100).toFixed(1);

  const { isLiked, likeCount, toggleLike } = useLikes(market.address);
  const { share } = useShare();
  const haptics = useHaptics();
  const [showActions, setShowActions] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);

  const handleYes = () => {
    haptics.medium();
    navigate(`/trade/${market.address}?outcome=1`);
  };

  const handleNo = () => {
    haptics.medium();
    navigate(`/trade/${market.address}?outcome=0`);
  };

  const handleLike = () => {
    haptics.light();
    toggleLike();
  };

  const handleShare = async () => {
    haptics.selection();
    const success = await share(
      'Sooth Lite',
      `${market.question} - ${yesPercent}% YES`,
      `${window.location.origin}/trade/${market.address}`
    );
    if (success) {
      haptics.success();
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 2000);
    }
  };

  const toggleActions = () => {
    haptics.selection();
    setShowActions(!showActions);
  };

  const imageUrl = getMarketImage(market.question, market.address);

  return (
    <section className="snap-card relative px-6 pt-14">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <img src={imageUrl} alt="" className="w-full h-2/3 object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#060b19]/40 via-[#060b19]/80 to-[#060b19]" />
      </div>

      <h1 className="relative font-heading text-[32px] leading-tight font-normal text-white tracking-tight">
        {parseTextWithLinks(market.question)}
      </h1>

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 flex flex-col items-center gap-1 opacity-40">
        <span className="text-[10px] uppercase tracking-widest text-white/60 font-medium">Swipe</span>
        <div className="flex flex-col items-center animate-bounce">
          <ChevronDown className="w-6 h-6 text-white" />
          <ChevronDown className="w-6 h-6 text-white -mt-4" />
        </div>
      </div>

      <div className="absolute bottom-24 left-0 right-0 px-6 space-y-4 z-10">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider mb-1">Odds</p>
            <p className="text-2xl font-bold text-cyan-400">{yesPercent}% YES</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider mb-1">Pool</p>
            <p className="text-lg font-semibold text-white/80">{formatVolume(market.totalLPSupply)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider mb-1">Ends</p>
            <div className="flex items-center gap-1 text-white/80">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-lg font-semibold">{formatTimeRemaining(market.deadline)}</span>
            </div>
          </div>
        </div>

        <div className="h-2.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/10">
          <div
            className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-full transition-all duration-500"
            style={{ width: `${probability * 100}%` }}
          />
        </div>

        <div className="flex gap-3 items-end pt-1">
          <button
            onClick={handleYes}
            className="flex-1 h-14 rounded-2xl bg-cyan-500 text-white font-bold text-base active:scale-95 transition-all border border-cyan-400/50"
          >
            YES {yesPercent}¢
          </button>
          <button
            onClick={handleNo}
            className="flex-1 h-14 rounded-2xl bg-fuchsia-600 text-white font-bold text-base active:scale-95 transition-all border border-fuchsia-500/50"
          >
            NO {noPercent}¢
          </button>
          
          <div className="relative flex flex-col items-center">
            {showActions && (
              <div className="absolute bottom-16 flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
                <button onClick={handleShare} className="group">
                  <div className={`w-11 h-11 rounded-full glass-panel flex items-center justify-center transition-all group-active:scale-90 ${shareSuccess ? 'text-emerald-400 bg-emerald-500/20' : 'text-white/70'}`}>
                    {shareSuccess ? <Check className="w-5 h-5" /> : <Share2 className="w-5 h-5" />}
                  </div>
                </button>
                <button onClick={handleLike} className="group relative">
                  <div className={`w-11 h-11 rounded-full glass-panel flex items-center justify-center transition-all group-active:scale-90 ${isLiked ? 'text-fuchsia-500 bg-fuchsia-500/20' : 'text-white/70'}`}>
                    <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
                  </div>
                  {likeCount > 0 && (
                    <span className={`absolute -right-1 -top-1 text-[9px] font-bold px-1 rounded ${isLiked ? 'text-fuchsia-400' : 'text-white/50'}`}>
                      {formatCount(likeCount)}
                    </span>
                  )}
                </button>
              </div>
            )}
            <button onClick={toggleActions} className="group">
              <div className={`w-14 h-14 rounded-full glass-panel flex items-center justify-center transition-all group-active:scale-90 ${showActions ? 'text-cyan-400 bg-cyan-500/20' : 'text-white/60'}`}>
                <MoreHorizontal className={`w-6 h-6 transition-transform ${showActions ? 'rotate-90' : ''}`} />
              </div>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
