import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ChevronDown, Clock } from 'lucide-react';
import type { LensPost } from '../hooks/useLensFeed';
import type { Address } from 'viem';
import { useSoothMarket } from '../hooks';
import { SoothTradeDrawer } from './SoothTradeDrawer';
import { OnboardingGuard } from './OnboardingGuard';

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
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

export function SnapMarketCard({ post }: { post: LensPost }) {
  const feed = post.feedAddress as Address;
  const postIdBig = (() => {
    try {
      return BigInt(post.id);
    } catch {
      return undefined;
    }
  })();
  const market = useSoothMarket(feed, postIdBig);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerOutcome, setDrawerOutcome] = useState<0 | 1>(1);
  const navigate = useNavigate();

  const displayName =
    post.author.displayName ?? post.author.username ?? post.author.address.slice(0, 10);
  const handle = post.author.username
    ? `@${post.author.username.replace('lens/', '')}`
    : post.author.address.slice(0, 8) + '...';
  const cleanContent =
    post.content?.replace(/#ORB-INTERNAL_ID:\w+/g, '').trim() ?? '';

  // Loading state
  if (market.isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-mesh">
        <Loader2 className="w-10 h-10 text-[#00d4aa] animate-spin" />
      </div>
    );
  }

  // Not initialized
  if (!market.data || market.data.b === 0n) {
    return (
      <div className="h-full relative bg-mesh">
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a1a1b]/40 via-[#1a1a1b]/80 to-[#1a1a1b]" />
        <div className="relative z-10 h-full flex flex-col items-center justify-center px-8 text-center">
          <p className="text-[26px] font-bold text-white mb-4 leading-snug">
            {cleanContent || 'Untitled Market'}
          </p>
          <div className="flex items-center gap-2 text-[#888]">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Market initializing…</span>
          </div>
        </div>
      </div>
    );
  }

  const { yesProbability, deadline, resolved, winningOutcome, totalCollateral } =
    market.data;
  const yesPercent = Math.round(yesProbability * 100);
  const noPercent = 100 - yesPercent;
  const outcomeLabel =
    winningOutcome === 1 ? 'YES' : winningOutcome === 0 ? 'NO' : 'INVALID';

  return (
    <>
      <div className="h-full relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-mesh" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a1a1b]/40 via-[#1a1a1b]/80 to-[#1a1a1b]" />

        {/* Author - top left */}
        <div className="absolute top-4 left-6 z-10 flex items-center gap-3">
          <Avatar src={post.author.avatar} username={post.author.username} />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">{displayName}</span>
              <span className="text-xs text-[#888]">{handle}</span>
              <span className="text-xs text-[#888]">· {timeAgo(post.timestamp)}</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#00d4aa]/10 text-[#00d4aa] border border-[#00d4aa]/20">
              #sooth-market
            </span>
          </div>
        </div>

        {/* Resolved badge */}
        {resolved && (
          <div className="absolute top-4 right-6 z-20">
            <span
              className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider border backdrop-blur-sm ${
                winningOutcome === 1
                  ? 'bg-[#00d4aa]/20 text-[#00d4aa] border-[#00d4aa]/30'
                  : winningOutcome === 0
                    ? 'bg-[#e01b24]/20 text-[#e01b24] border-[#e01b24]/30'
                    : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
              }`}
            >
              RESOLVED: {outcomeLabel}
            </span>
          </div>
        )}

        {/* Question - center */}
        <div
          className="absolute inset-0 flex items-center justify-center px-8 z-10 cursor-pointer"
          onClick={() => navigate(`/market/${post.feedAddress}/${post.id}`, {
            state: {
              question: cleanContent,
              author: { displayName, handle, avatar: post.author.avatar, timestamp: post.timestamp }
            }
          })}
        >
          <h1 className="text-[30px] leading-tight font-bold text-white text-center tracking-tight">
            {cleanContent || 'Untitled Market'}
          </h1>
        </div>

        {/* Swipe chevrons */}
        <div className="absolute left-1/2 top-[55%] -translate-x-1/2 flex flex-col items-center gap-1 opacity-40 z-10">
          <span className="text-[10px] uppercase tracking-widest text-[#888] font-medium">
            Swipe
          </span>
          <div className="flex flex-col items-center animate-bounce">
            <ChevronDown className="w-6 h-6 text-[#888]" />
            <ChevronDown className="w-6 h-6 text-[#888] -mt-4" />
          </div>
        </div>

        {/* Stats row */}
        <div className="absolute bottom-52 left-0 right-0 px-6 z-10">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] text-[#888] font-bold uppercase tracking-wider mb-1">
                Odds
              </p>
              <p className="text-2xl font-bold text-[#00d4aa]">{yesPercent}% YES</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-[#888] font-bold uppercase tracking-wider mb-1">
                Pool
              </p>
              <p className="text-lg font-semibold text-white">
                {formatPool(totalCollateral)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-[#888] font-bold uppercase tracking-wider mb-1">
                Ends
              </p>
              <div className="flex items-center gap-1 text-white">
                <Clock className="w-3.5 h-3.5 text-[#888]" />
                <span className="text-lg font-semibold">
                  {formatTimeRemaining(deadline)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Probability bar */}
        <div className="absolute bottom-40 left-0 right-0 px-6 z-10">
          <div className="flex rounded-full overflow-hidden h-2.5 border border-[#444]">
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

        {/* Trade buttons */}
        {!resolved && (
          <div className="absolute bottom-24 left-0 right-0 px-4 z-20">
            <OnboardingGuard>
              <div className="max-w-md mx-auto flex gap-2">
                <button
                  onClick={() => {
                    setDrawerOutcome(1);
                    setDrawerOpen(true);
                  }}
                  className="flex-1 h-12 rounded-xl bg-gradient-to-r from-[#00d4aa] to-[#00b894] text-[#1a1a1b] font-bold text-sm active:scale-95 transition-all"
                >
                  YES {yesPercent}¢
                </button>
                <button
                  onClick={() => {
                    setDrawerOutcome(0);
                    setDrawerOpen(true);
                  }}
                  className="flex-1 h-12 rounded-xl bg-gradient-to-r from-[#e01b24] to-[#ff6b35] text-white font-bold text-sm active:scale-95 transition-all"
                >
                  NO {noPercent}¢
                </button>
              </div>
            </OnboardingGuard>
          </div>
        )}
      </div>

      <SoothTradeDrawer
        postIdStr={post.id}
        feedAddress={post.feedAddress}
        question={post.content ?? ''}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        initialOutcome={drawerOutcome}
      />
    </>
  );
}