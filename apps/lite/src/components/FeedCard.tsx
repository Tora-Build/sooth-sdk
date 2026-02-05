import { useNavigate } from 'react-router-dom';
import { MessageSquare, Heart, Share2, Clock, Users, ExternalLink } from 'lucide-react';
import type { Market } from '../hooks/useMarkets';

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

function getCategoryLabel(stage: Market['stage']): { label: string; color: string } {
  switch (stage) {
    case 'bonding':
      return { label: 'Crypto', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
    case 'live':
      return { label: 'Live', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
    case 'settled':
    case 'finalized':
      return { label: 'Settled', color: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30' };
    default:
      return { label: 'Market', color: 'bg-slate-500/10 text-slate-400 border-slate-500/30' };
  }
}

function formatTimeRemaining(): string {
  return '14d 22h 05m';
}

export function FeedCard({ market }: FeedCardProps) {
  const navigate = useNavigate();
  const probability = market.yesProbability ?? 0.5;
  const yesPercent = Math.round(probability * 100);
  const noPercent = 100 - yesPercent;
  const category = getCategoryLabel(market.stage);

  const handleYes = () => {
    navigate(`/trade/${market.address}?outcome=1`);
  };

  const handleNo = () => {
    navigate(`/trade/${market.address}?outcome=0`);
  };

  return (
    <section className="snap-card relative flex flex-col px-6 pt-32 pb-56">
      <div className="flex flex-col h-full">
        <div className="mb-6">
          <span
            className={`px-3 py-1 text-[11px] font-bold uppercase tracking-widest rounded-full border backdrop-blur-md ${category.color}`}
          >
            {category.label}
          </span>
        </div>

        <h1 className="font-heading text-[34px] leading-tight font-semibold text-white mb-10 tracking-tight">
          {parseTextWithLinks(market.question)}
        </h1>

        <div className="mt-auto">
          <div className="flex justify-between items-end mb-4">
            <div>
              <p className="text-[11px] text-white/40 font-bold uppercase tracking-wider mb-1">
                Current Odds
              </p>
              <p className="text-3xl font-bold text-cyan-400 text-glow-cyan">
                {yesPercent}% YES
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-white/40 font-bold uppercase tracking-wider mb-1">
                Volume
              </p>
              <p className="text-xl font-semibold text-white/90">$1.2M traded</p>
            </div>
          </div>

          <div className="h-4 w-full bg-white/5 rounded-full overflow-hidden flex border border-white/10 p-[2px]">
            <div
              className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-full transition-all duration-1000 neon-cyan"
              style={{ width: `${yesPercent}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mt-8">
            <div className="p-5 rounded-3xl glass-panel">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-white/40" />
                <span className="text-[11px] text-white/40 uppercase font-bold tracking-widest">
                  Ends In
                </span>
              </div>
              <p className="text-base font-bold text-white">{formatTimeRemaining()}</p>
            </div>
            <div className="p-5 rounded-3xl glass-panel">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-white/40" />
                <span className="text-[11px] text-white/40 uppercase font-bold tracking-widest">
                  Traders
                </span>
              </div>
              <p className="text-base font-bold text-white">4.8k participants</p>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute right-4 bottom-64 flex flex-col gap-6">
        <button className="flex flex-col items-center gap-1 group">
          <div className="w-14 h-14 rounded-full glass-panel flex items-center justify-center text-white/70 group-hover:text-cyan-400 transition-colors border-white/10">
            <MessageSquare className="w-6 h-6" />
          </div>
          <span className="text-[11px] font-bold text-white/40">412</span>
        </button>
        <button className="flex flex-col items-center gap-1 group">
          <div className="w-14 h-14 rounded-full glass-panel flex items-center justify-center text-white/70 group-hover:text-fuchsia-500 transition-colors border-white/10">
            <Heart className="w-6 h-6" />
          </div>
          <span className="text-[11px] font-bold text-white/40">2.1k</span>
        </button>
        <button className="flex flex-col items-center gap-1 group">
          <div className="w-14 h-14 rounded-full glass-panel flex items-center justify-center text-white/70 group-hover:text-white transition-colors border-white/10">
            <Share2 className="w-6 h-6" />
          </div>
          <span className="text-[11px] font-bold text-white/40">Share</span>
        </button>
      </div>

      <div className="absolute bottom-44 left-0 w-full px-6 flex gap-4">
        <button
          onClick={handleYes}
          className="flex-1 h-16 rounded-2xl bg-cyan-500 text-white font-bold text-lg neon-cyan active:scale-95 transition-all flex items-center justify-center gap-2 border border-cyan-400/50"
        >
          YES - {yesPercent}c
        </button>
        <button
          onClick={handleNo}
          className="flex-1 h-16 rounded-2xl bg-fuchsia-600 text-white font-bold text-lg neon-magenta active:scale-95 transition-all flex items-center justify-center gap-2 border border-fuchsia-500/50"
        >
          NO - {noPercent}c
        </button>
      </div>
    </section>
  );
}
