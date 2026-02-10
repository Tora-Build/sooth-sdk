import { useNavigate } from 'react-router-dom';
import { Heart, MessageCircle, Share2, Flame, Zap, Trophy } from 'lucide-react';
import type { Market } from '../hooks/useMarkets';
import { getMarketImage } from '../lib/images';
interface MarketCardProps {
  market: Market;
}

const REACTIONS = ['🚀', '💎', '🐻', '🔥', '💀'] as const;

function getCreatorName(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getAvatarUrl(seed: string): string {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
}

export function MarketCard({ market }: MarketCardProps) {
  const navigate = useNavigate();
  const probability = market.yesProbability ?? 0.5;
  const yesPercent = Math.round(probability * 100);
  const noPercent = 100 - yesPercent;
  const imageUrl = getMarketImage(market.question, market.address);
  const isHot = market.stage === 'bonding';
  const isGraduated = market.stage === 'live' || market.stage === 'finalized';
  const isSettled = market.stage === 'settled';

  const handleClick = () => {
    navigate(`/?marketId=${market.address}`);
  };

  return (
    <div
      onClick={handleClick}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      role="button"
      tabIndex={0}
      className="w-full bg-zinc-900/80 rounded-2xl overflow-hidden card-glow transition-all cursor-pointer active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-[#00d4aa]"
      aria-label={`View trade details for: ${market.question}`}
    >
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <img
            src={getAvatarUrl(market.creator ?? market.address)}
            alt=""
            className="w-10 h-10 rounded-full bg-zinc-800"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white truncate">
                {market.creator ? `@${market.creator}` : getCreatorName(market.address)}
              </span>
              {isHot && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-orange-500/20 rounded-full">
                  <Flame className="w-3 h-3 text-orange-400" />
                  <span className="text-[10px] font-bold text-orange-400">HOT</span>
                </span>
              )}
              {isGraduated && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 rounded-full">
                  <Zap className="w-3 h-3 text-yellow-400" />
                  <span className="text-[10px] font-bold text-yellow-400">GRADUATED</span>
                </span>
              )}
              {isSettled && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/20 rounded-full">
                  <Trophy className="w-3 h-3 text-amber-400" />
                  <span className="text-[10px] font-bold text-amber-400">SETTLED</span>
                </span>
              )}
            </div>
            <span className="text-xs text-zinc-500">just now</span>
          </div>
        </div>

        <div className="relative rounded-xl overflow-hidden">
          <img
            src={imageUrl}
            alt=""
            className="w-full h-32 object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        </div>

        <h3 className="font-bold text-white leading-snug line-clamp-2 text-base">
          {market.question}
        </h3>

        <div className="flex items-center gap-2">
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={(e) => e.stopPropagation()}
              className="px-2 py-1 bg-zinc-800/80 rounded-full text-sm hover:bg-zinc-700 transition-colors bounce-button"
              aria-label={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 text-zinc-500">
          <button
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 hover:text-pink-400 transition-colors bounce-button"
            aria-label="Like market"
          >
            <Heart className="w-4 h-4" />
            <span className="text-xs font-medium">42</span>
          </button>
          <button
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 hover:text-blue-400 transition-colors bounce-button"
            aria-label="View comments"
          >
            <MessageCircle className="w-4 h-4" />
            <span className="text-xs font-medium">8</span>
          </button>
          <button
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 hover:text-green-400 transition-colors bounce-button"
            aria-label="Share market"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/?marketId=${market.address}`);
            }}
            className="flex-1 py-3 rounded-2xl bg-emerald-500 text-white font-bold text-base transition-all hover:bg-emerald-400 bounce-button shadow-lg shadow-emerald-500/20"
          >
            Yes {yesPercent}¢
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/?marketId=${market.address}`);
            }}
            className="flex-1 py-3 rounded-2xl bg-rose-500 text-white font-bold text-base transition-all hover:bg-rose-400 bounce-button shadow-lg shadow-rose-500/20"
          >
            No {noPercent}¢
          </button>
        </div>
      </div>
    </div>
  );
}
