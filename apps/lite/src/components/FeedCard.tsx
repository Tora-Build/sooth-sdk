import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Share2, Clock, ExternalLink, Check, MoreHorizontal, ChevronDown } from 'lucide-react';
import type { Market } from '../hooks/useMarkets';
import { useLikes, useShare } from '../hooks/useSocial';
import { useHaptics } from '../hooks/useHaptics';
import { getMarketImage } from '../lib/images';
import { TradeModal } from './TradeModal';

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
      let isMoltbook = false;
      try {
        const url = new URL(part);
        displayText = url.hostname.replace('www.', '');
        isMoltbook = url.hostname.includes('moltbook.com');
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
          className="inline-flex items-center gap-1.5 text-[#00d4aa] hover:text-[#00b894] underline underline-offset-2"
        >
          {isMoltbook ? (
            <img 
              src="https://moltbook.com/moltbook-mascot.png" 
              alt="Moltbook" 
              className="w-5 h-5 inline-block"
            />
          ) : null}
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

const STAGE_CONFIG = {
  bonding: { label: 'Bonding', bg: 'bg-[#00d4aa]/10', text: 'text-[#00d4aa]', border: 'border-[#00d4aa]/30' },
  live: { label: 'Graduated', bg: 'bg-[#00d4aa]/20', text: 'text-[#00d4aa]', border: 'border-[#00d4aa]/40' },
  settled: { label: 'Settled', bg: 'bg-[#ffd700]/10', text: 'text-[#ffd700]', border: 'border-[#ffd700]/30' },
  finalized: { label: 'Finalized', bg: 'bg-[#00d4aa]/20', text: 'text-[#00d4aa]', border: 'border-[#00d4aa]/40' },
  dismissed: { label: 'Dismissed', bg: 'bg-[#e01b24]/10', text: 'text-[#e01b24]', border: 'border-[#e01b24]/30' },
} as const;

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<0 | 1>(1);

  const handleYes = () => {
    haptics.medium();
    setSelectedOutcome(1);
    setIsModalOpen(true);
  };

  const handleNo = () => {
    haptics.medium();
    setSelectedOutcome(0);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleNavigateToProfile = () => {
    navigate('/profile');
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
    <>
    <section className="snap-card relative px-6 pt-14">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <img src={imageUrl} alt="" className="w-full h-2/3 object-cover opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a1a1b]/40 via-[#1a1a1b]/80 to-[#1a1a1b]" />
      </div>

      {(() => {
        const stageInfo = STAGE_CONFIG[market.stage];
        return (
          <div className="absolute top-4 left-6 z-40">
            <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider border backdrop-blur-sm ${stageInfo.bg} ${stageInfo.text} ${stageInfo.border}`}>
              {stageInfo.label}
            </span>
          </div>
        );
      })()}

      <h1 className="relative font-heading text-[32px] leading-tight font-bold text-white tracking-tight">
        {parseTextWithLinks(market.question)}
      </h1>

      <div className="absolute left-1/2 top-[45%] -translate-x-1/2 flex flex-col items-center gap-1 opacity-40">
        <span className="text-[10px] uppercase tracking-widest text-[#888] font-medium">Swipe</span>
        <div className="flex flex-col items-center animate-bounce">
          <ChevronDown className="w-6 h-6 text-[#888]" />
          <ChevronDown className="w-6 h-6 text-[#888] -mt-4" />
        </div>
      </div>

      <div className="absolute bottom-52 left-0 right-0 px-6 space-y-4 z-10">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] text-[#888] font-bold uppercase tracking-wider mb-1">Odds</p>
            <p className="text-2xl font-bold text-[#00d4aa]">{yesPercent}% YES</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-[#888] font-bold uppercase tracking-wider mb-1">Pool</p>
            <p className="text-lg font-semibold text-white">{formatVolume(market.totalLPSupply)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-[#888] font-bold uppercase tracking-wider mb-1">Ends</p>
            <div className="flex items-center gap-1 text-white">
              <Clock className="w-3.5 h-3.5 text-[#888]" />
              <span className="text-lg font-semibold">{formatTimeRemaining(market.deadline)}</span>
            </div>
          </div>
        </div>

        <div className="h-2.5 w-full bg-[#2d2d2e] rounded-full overflow-hidden border border-[#444]">
          <div
            className="h-full bg-gradient-to-r from-[#00d4aa] to-[#00b894] rounded-full transition-all duration-500"
            style={{ width: `${probability * 100}%` }}
          />
        </div>
      </div>

      <div className="absolute bottom-28 left-0 right-0 px-4 z-20">
        <div className="max-w-md mx-auto bg-[#1a1a1b] border border-[#333] rounded-2xl p-2 shadow-lg shadow-black/50 flex gap-2 items-center">
          <button
            onClick={handleYes}
            className="flex-1 h-12 rounded-xl bg-gradient-to-r from-[#00d4aa] to-[#00b894] text-[#1a1a1b] font-bold text-sm active:scale-95 transition-all"
          >
            YES {yesPercent}¢
          </button>
          <button
            onClick={handleNo}
            className="flex-1 h-12 rounded-xl bg-gradient-to-r from-[#e01b24] to-[#ff6b35] text-white font-bold text-sm active:scale-95 transition-all"
          >
            NO {noPercent}¢
          </button>
          
          <div className="relative flex flex-col items-center">
            {showActions && (
              <div className="absolute bottom-14 flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
                <button onClick={handleShare} className="group">
                  <div className={`w-10 h-10 rounded-lg glass-panel flex items-center justify-center transition-all group-active:scale-90 ${shareSuccess ? 'text-[#00d4aa] bg-[#00d4aa]/20' : 'text-[#888]'}`}>
                    {shareSuccess ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                  </div>
                </button>
                <button onClick={handleLike} className="group relative">
                  <div className={`w-10 h-10 rounded-lg glass-panel flex items-center justify-center transition-all group-active:scale-90 ${isLiked ? 'text-[#e01b24] bg-[#e01b24]/20' : 'text-[#888]'}`}>
                    <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                  </div>
                  {likeCount > 0 && (
                    <span className={`absolute -right-1 -top-1 text-[9px] font-bold px-1 rounded ${isLiked ? 'text-[#e01b24]' : 'text-[#888]'}`}>
                      {formatCount(likeCount)}
                    </span>
                  )}
                </button>
              </div>
            )}
            <button onClick={toggleActions} className="group">
              <div className={`w-12 h-12 rounded-xl glass-panel flex items-center justify-center transition-all group-active:scale-90 ${showActions ? 'text-[#00d4aa] bg-[#00d4aa]/20' : 'text-[#888]'}`}>
                <MoreHorizontal className={`w-5 h-5 transition-transform ${showActions ? 'rotate-90' : ''}`} />
              </div>
            </button>
          </div>
        </div>
      </div>
    </section>
    <TradeModal
      market={market}
      initialOutcome={selectedOutcome}
      isOpen={isModalOpen}
      onClose={handleCloseModal}
      onNavigateToProfile={handleNavigateToProfile}
    />
    </>
  );
}
