import { useState } from "react";
import { MessageCircle, Repeat2, Bookmark, ThumbsUp, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import type { LensPost } from "../hooks/useLensFeed";
import type { Address } from "viem";
import { useSoothMarket } from "../hooks";
import { useUpvote, useBookmark } from "../hooks/useReactions";
import { SoothTradeDrawer } from "./SoothTradeDrawer";
import { CommentThread } from "./CommentThread";
import { IS_TESTNET } from "../lib/lensConfig";

function timeAgo(timestamp: string): string {
  if (!timestamp) return "";
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return new Date(timestamp).toLocaleDateString("en", { month: "short", day: "numeric" });
}

function Avatar({ src, username }: { src: string | null; username: string | null }) {
  if (src) {
    return (
      <img
        src={src}
        alt={username ?? "avatar"}
        className="w-10 h-10 rounded-full object-cover bg-[#2d2d2e]"
      />
    );
  }

  const letter = username?.[0]?.toUpperCase() ?? "?";
  const colors = [
    "from-emerald-500 to-teal-600",
    "from-violet-500 to-purple-600",
    "from-amber-500 to-orange-600",
    "from-rose-500 to-pink-600",
    "from-cyan-500 to-blue-600",
  ];
  const idx = (username ?? "").charCodeAt(0) % colors.length;

  return (
    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${colors[idx]} flex items-center justify-center`}>
      <span className="text-white text-sm font-bold">{letter}</span>
    </div>
  );
}

function StatButton({ icon: Icon, count, label }: {
  icon: typeof MessageCircle;
  count: number;
  label: string;
}) {
  return (
    <button
      className="flex items-center gap-1.5 text-[#888] hover:text-white transition-colors group"
      aria-label={label}
    >
      <Icon className="w-4 h-4 group-hover:scale-110 transition-transform" />
      {count > 0 && <span className="text-xs">{count}</span>}
    </button>
  );
}

export function LensPostCard({ post }: { post: LensPost }) {
  const displayName = post.author.displayName ?? post.author.username ?? post.author.address.slice(0, 10);
  const handle = post.author.username ? `@${post.author.username.replace("lens/", "")}` : post.author.address.slice(0, 8) + "...";

  const isSoothMarket = post.tags.includes('sooth-market');
  const feed = isSoothMarket && post.feedAddress ? (post.feedAddress as Address) : undefined;
  const postIdBig = isSoothMarket ? (() => { try { return BigInt(post.id); } catch { return undefined; } })() : undefined;
  const market = useSoothMarket(feed, postIdBig);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerOutcome, setDrawerOutcome] = useState<0 | 1>(1);
  const [showComments, setShowComments] = useState(false);

  const EXPLORER_BASE = IS_TESTNET ? 'https://explorer.testnet.lens.xyz' : 'https://explorer.lens.xyz';

  const upvote = useUpvote(post.id, post.stats.upvotes);
  const bookmark = useBookmark(post.id);

  const yesPercent = Math.round((market.data?.yesProbability ?? 0.5) * 100);
  const noPercent = 100 - yesPercent;
  const showMarketOverlay = isSoothMarket && feed && postIdBig !== undefined && !market.isLoading && market.data && market.data.b > 0n;

  return (
    <>
    <article className="px-4 py-4 border-b border-[#2d2d2e] hover:bg-[#1f1f20] transition-colors">
      <div className="flex gap-3">
        <Avatar src={post.author.avatar} username={post.author.username} />

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm text-white truncate">{displayName}</span>
            <span className="text-[#888] text-sm truncate">{handle}</span>
            <span className="text-[#888] text-xs shrink-0">· {timeAgo(post.timestamp)}</span>
          </div>

          {/* Content */}
          {post.content && (
            <p className="text-[15px] text-[#e0e0e0] leading-relaxed whitespace-pre-wrap break-words mb-2">
              {post.content.replace(/#ORB-INTERNAL_ID:\w+/g, "").trim()}
            </p>
          )}

          {/* Tags */}
          {post.tags.filter(t => !t.includes('INTERNAL_ID') && !t.includes('ORB-')).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {post.tags
                .filter(t => !t.includes('INTERNAL_ID') && !t.includes('ORB-'))
                .map((tag) => (
                <span
                  key={tag}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-[#00d4aa]/10 text-[#00d4aa] border border-[#00d4aa]/20"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {showMarketOverlay && (
            <div className="mb-3 p-3 rounded-2xl bg-[#1f1f20] border border-[#2d2d2e]">
              <div className="flex rounded-full overflow-hidden h-1.5 mb-2">
                <div style={{ width: `${yesPercent}%` }} className="bg-[#00d4aa] transition-all duration-500" />
                <div style={{ width: `${noPercent}%` }} className="bg-[#e01b24] transition-all duration-500" />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setDrawerOutcome(1); setDrawerOpen(true); }}
                  className="flex-1 py-1.5 rounded-xl text-xs font-bold bg-[#00d4aa]/10 text-[#00d4aa] border border-[#00d4aa]/30 hover:bg-[#00d4aa]/20 active:scale-95 transition-all"
                >
                  YES {yesPercent}%
                </button>
                <button
                  onClick={() => { setDrawerOutcome(0); setDrawerOpen(true); }}
                  className="flex-1 py-1.5 rounded-xl text-xs font-bold bg-[#e01b24]/10 text-[#e01b24] border border-[#e01b24]/30 hover:bg-[#e01b24]/20 active:scale-95 transition-all"
                >
                  NO {noPercent}%
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-6">
            <button
              onClick={() => setShowComments((v) => !v)}
              className="flex items-center gap-1.5 text-[#888] hover:text-white transition-colors group"
              aria-label="Comments"
            >
              <MessageCircle className="w-4 h-4 group-hover:scale-110 transition-transform" />
              {post.stats.comments > 0 && <span className="text-xs">{post.stats.comments}</span>}
              {showComments ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            <StatButton icon={Repeat2} count={post.stats.reposts} label="Reposts" />
            <button
              onClick={upvote.toggle}
              className={`flex items-center gap-1.5 transition-colors group ${
                upvote.isUpvoted ? "text-[#00d4aa]" : "text-[#888] hover:text-white"
              }`}
              aria-label="Upvote"
            >
              <ThumbsUp className={`w-4 h-4 group-hover:scale-110 transition-transform ${upvote.isUpvoted ? "fill-current" : ""}`} />
              {upvote.count > 0 && <span className="text-xs tabular-nums">{upvote.count}</span>}
            </button>
            <button
              onClick={bookmark.toggle}
              className={`flex items-center gap-1.5 transition-colors group ${
                bookmark.isBookmarked ? "text-[#00d4aa]" : "text-[#888] hover:text-white"
              }`}
              aria-label="Bookmark"
            >
              <Bookmark className={`w-4 h-4 group-hover:scale-110 transition-transform ${bookmark.isBookmarked ? "fill-current" : ""}`} />
            </button>
            <a
              href={IS_TESTNET && feed ? `${EXPLORER_BASE}/address/${feed}` : `https://hey.xyz/posts/${post.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-[#888] hover:text-[#00d4aa] transition-colors"
              aria-label={IS_TESTNET && feed ? 'View Market on Explorer' : 'View on Hey'}
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </article>
    {showComments && (
      <CommentThread postId={post.id} commentCount={post.stats.comments} />
    )}
    {isSoothMarket && feed && postIdBig !== undefined && (
      <SoothTradeDrawer
        postIdStr={post.id}
        feedAddress={post.feedAddress}
        question={post.content ?? ''}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        initialOutcome={drawerOutcome}
      />
    )}
    </>
  );
}
