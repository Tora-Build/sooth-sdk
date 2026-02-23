import { useState, useContext } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Loader2, Clock } from 'lucide-react';
import type { Address } from 'viem';
import { useSoothMarket } from '../hooks';
import { useShowcase } from '../hooks/useShowcase';
import { usePhoneNavigate } from '../hooks/usePhoneNavigate';
import { PhoneRouteContext } from '../App';
import { SoothTradeDrawer } from '../components/SoothTradeDrawer';
import { OnboardingGuard } from '../components/OnboardingGuard';

function Avatar({ src, username }: { src: string | null; username: string | null }) {
  if (src) {
    return (
      <img
        src={src}
        alt={username ?? 'avatar'}
        className="w-10 h-10 rounded-full object-cover bg-[#2d2d2e]"
      />
    );
  }

  const letter = username?.[0]?.toUpperCase() ?? '?';
  const colors = [
    'from-emerald-500 to-teal-600',
    'from-violet-500 to-purple-600',
    'from-amber-500 to-orange-600',
    'from-rose-500 to-pink-600',
    'from-cyan-500 to-blue-600',
  ];
  const idx = (username ?? '').charCodeAt(0) % colors.length;

  return (
    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${colors[idx]} flex items-center justify-center`}>
      <span className="text-white text-sm font-bold">{letter}</span>
    </div>
  );
}

function timeAgo(timestamp: string): string {
  if (!timestamp) return '';
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return new Date(timestamp).toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

function formatTimeRemaining(deadline: bigint): string {
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (deadline <= now) return 'Ended';

  const diff = Number(deadline - now);
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h`;
  return `${Math.floor((diff % 3600) / 60)}m`;
}

function formatPool(totalCollateral: bigint): string {
  const value = Number(totalCollateral) / 1e18;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(2);
}

interface LocationState {
  question?: string;
  author?: {
    displayName: string;
    handle: string;
    avatar: string | null;
    timestamp: string;
  };
}

export function MarketDetail() {
  const routerParams = useParams<{ feedAddress: string; postId: string }>();
  const phoneNavigate = usePhoneNavigate();
  const location = useLocation();
  const inShowcase = useShowcase();
  const phoneRoute = useContext(PhoneRouteContext);

  const phoneMatch = phoneRoute.route.match(/^\/market\/([^/]+)\/(.+)$/);
  const feedAddress = inShowcase && phoneMatch ? phoneMatch[1] : routerParams.feedAddress;
  const postId = inShowcase && phoneMatch ? phoneMatch[2] : routerParams.postId;
  const state = (location.state ?? {}) as LocationState;

  const postIdBig = (() => {
    try {
      return BigInt(postId ?? '0');
    } catch {
      return undefined;
    }
  })();

  const market = useSoothMarket(feedAddress as Address, postIdBig);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerOutcome, setDrawerOutcome] = useState<0 | 1>(1);


  if (market.isLoading) {
    return (
      <div className={`${inShowcase ? 'h-full' : 'h-dvh'} bg-[#1a1a1b] flex items-center justify-center`}>
        <Loader2 className="w-10 h-10 text-[#00d4aa] animate-spin" />
      </div>
    );
  }


  if (!market.data || market.data.b === 0n) {
    return (
      <div className={`${inShowcase ? 'h-full' : 'h-dvh'} bg-[#1a1a1b] flex flex-col`}>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#2d2d2e]">
          <button onClick={() => phoneNavigate(-1)} className="p-1 text-white hover:text-[#00d4aa] transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-white font-semibold">Market</span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <p className="text-2xl font-bold text-white mb-4 leading-snug">
            {question || 'Untitled Market'}
          </p>
          <div className="flex items-center gap-2 text-[#888]">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Market initializing…</span>
          </div>
        </div>
      </div>
    );
  }

  const { yesProbability, deadline, resolved, winningOutcome, totalCollateral } = market.data;
  const yesPercent = Math.round(yesProbability * 100);
  const noPercent = 100 - yesPercent;
  const now = BigInt(Math.floor(Date.now() / 1000));
  const isEnded = deadline <= now;

  const statusBadge = resolved
    ? winningOutcome === 1
      ? { label: 'Resolved: YES', bg: 'bg-[#00d4aa]/15', text: 'text-[#00d4aa]', border: 'border-[#00d4aa]/30' }
      : winningOutcome === 0
        ? { label: 'Resolved: NO', bg: 'bg-[#e01b24]/15', text: 'text-[#e01b24]', border: 'border-[#e01b24]/30' }
        : { label: 'Resolved: INVALID', bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/30' }
    : isEnded
      ? { label: 'Ended', bg: 'bg-[#888]/15', text: 'text-[#888]', border: 'border-[#888]/30' }
      : { label: 'Open', bg: 'bg-[#00d4aa]/15', text: 'text-[#00d4aa]', border: 'border-[#00d4aa]/30' };

  return (
    <>
      <div className={`${inShowcase ? 'h-full' : 'h-dvh'} bg-[#1a1a1b] flex flex-col overflow-y-auto`}>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#2d2d2e] shrink-0">
          <button onClick={() => phoneNavigate(-1)} className="p-1 text-white hover:text-[#00d4aa] transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-white font-semibold">Market</span>
        </div>

        {/* Content */}
        <div className="flex-1 px-5 py-5 space-y-5">
          {/* Author row */}
          {author && (
            <div className="flex items-center gap-3">
              <Avatar src={author.avatar} username={author.displayName} />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">{author.displayName}</span>
                  <span className="text-xs text-[#888]">{author.handle}</span>
                  <span className="text-xs text-[#888]">· {timeAgo(author.timestamp)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Question */}
          <h1 className="text-2xl font-bold text-white leading-snug">
            {question || 'Untitled Market'}
          </h1>

          {/* Status badge */}
          <div>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${statusBadge.bg} ${statusBadge.text} ${statusBadge.border}`}>
              {statusBadge.label}
            </span>
          </div>

          {/* Probability bar */}
          <div>
            <div className="flex rounded-full overflow-hidden h-3 border border-[#444]">
              <div
                style={{ width: `${yesPercent}%` }}
                className="bg-gradient-to-r from-[#00d4aa] to-[#00b894] transition-all duration-500"
              />
              <div
                style={{ width: `${noPercent}%` }}
                className="bg-gradient-to-r from-[#e01b24] to-[#ff6b35] transition-all duration-500"
              />
            </div>
          </div>

          {/* YES/NO percentages side by side */}
          <div className="flex gap-4">
            <div className="flex-1 p-4 rounded-2xl bg-[#00d4aa]/10 border border-[#00d4aa]/20 text-center">
              <p className="text-3xl font-bold text-[#00d4aa]">{yesPercent}%</p>
              <p className="text-xs text-[#00d4aa]/70 font-semibold uppercase tracking-wider mt-1">YES</p>
            </div>
            <div className="flex-1 p-4 rounded-2xl bg-[#e01b24]/10 border border-[#e01b24]/20 text-center">
              <p className="text-3xl font-bold text-[#e01b24]">{noPercent}%</p>
              <p className="text-xs text-[#e01b24]/70 font-semibold uppercase tracking-wider mt-1">NO</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-[#222] border border-[#333]">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="w-3.5 h-3.5 text-[#888]" />
                <span className="text-[10px] text-[#888] font-bold uppercase tracking-wider">Deadline</span>
              </div>
              <p className="text-base font-semibold text-white">{formatTimeRemaining(deadline)}</p>
            </div>
            <div className="p-3 rounded-xl bg-[#222] border border-[#333]">
              <div className="mb-1">
                <span className="text-[10px] text-[#888] font-bold uppercase tracking-wider">Pool Size</span>
              </div>
              <p className="text-base font-semibold text-white">{formatPool(totalCollateral)} GRASS</p>
            </div>
          </div>

          {/* Trade button */}
          {!resolved && !isEnded && (
            <OnboardingGuard>
              <button
                onClick={() => {
                  setDrawerOutcome(1);
                  setDrawerOpen(true);
                }}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-[#00d4aa] to-[#00b894] text-[#1a1a1b] font-bold text-base active:scale-[0.98] transition-all"
              >
                Trade
              </button>
            </OnboardingGuard>
          )}
        </div>
      </div>

      <SoothTradeDrawer
        postIdStr={postId ?? ''}
        feedAddress={feedAddress ?? ''}
        question={question}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        initialOutcome={drawerOutcome}
      />
    </>
  );
}
