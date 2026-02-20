import { useCallback, useEffect, useRef, useState } from 'react';
import { useAccount } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { formatUnits, type Address } from 'viem';
import { Wallet, Loader2, TrendingUp, CircleDot } from 'lucide-react';
import { useWGHOBalance } from '../hooks/useWGHOBalance';
import { useSoothPosition } from '../hooks/useSoothPosition';
import { useSoothMarket } from '../hooks/useSoothMarket';
import { useLensFeed, type LensPost } from '../hooks/useLensFeed';
import { IS_TESTNET } from '../lib/lensConfig';
import { useShowcase } from '../hooks/useShowcase';
import { SoothTradeDrawer } from '../components/SoothTradeDrawer';

const TOKEN_LABEL = IS_TESTNET ? 'WGRASS' : 'WGHO';

// OUTCOME: NO=0, YES=1, INVALID=2
function outcomeLabel(outcome: number): string {
  if (outcome === 1) return 'YES';
  if (outcome === 0) return 'NO';
  return 'INVALID';
}

function hasWinningShares(
  winningOutcome: number,
  yesShares: bigint,
  noShares: bigint,
): boolean {
  if (winningOutcome === 1 && yesShares > 0n) return true;
  if (winningOutcome === 0 && noShares > 0n) return true;
  if (winningOutcome === 2 && (yesShares > 0n || noShares > 0n)) return true;
  return false;
}

function formatShares(shares: bigint): string {
  const formatted = formatUnits(shares, 18);
  const num = parseFloat(formatted);
  if (num === 0) return '0';
  if (num < 0.01) return '<0.01';
  return num.toFixed(2);
}

function formatBalance(formatted: string): string {
  const num = parseFloat(formatted);
  if (num === 0) return '0.00';
  if (num < 0.01) return '<0.01';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  return num.toFixed(4);
}

function BalanceCard({ address }: { address: Address }) {
  const { data, isLoading } = useWGHOBalance(address);

  return (
    <div className="mx-4 mt-4 p-4 rounded-2xl bg-white/5 border border-white/10">
      <div className="text-xs text-[#888] uppercase tracking-wider mb-1">Balance</div>
      {isLoading ? (
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 text-[#00d4aa] animate-spin" />
          <span className="text-sm text-[#888]">Loading…</span>
        </div>
      ) : (
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-white font-mono tabular-nums">
            {data ? formatBalance(data.balanceFormatted) : '—'}
          </span>
          <span className="text-sm text-[#00d4aa] font-medium">{TOKEN_LABEL}</span>
        </div>
      )}
    </div>
  );
}

function PositionRow({
  post,
  user,
  onChecked,
}: {
  post: LensPost;
  user: Address;
  onChecked: (id: string, hasPosition: boolean) => void;
}) {
  const feed = post.feedAddress ? (post.feedAddress as Address) : undefined;
  const postIdBig = (() => {
    try {
      return BigInt(post.id);
    } catch {
      return undefined;
    }
  })();

  const position = useSoothPosition(feed, postIdBig, user);
  const market = useSoothMarket(feed, postIdBig);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const yesShares = position.data?.yesShares ?? 0n;
  const noShares = position.data?.noShares ?? 0n;
  const hasPos = yesShares > 0n || noShares > 0n;

  const reported = useRef(false);

  useEffect(() => {
    if (!position.isLoading && !reported.current) {
      reported.current = true;
      onChecked(post.id, hasPos);
    }
  }, [position.isLoading, hasPos, post.id, onChecked]);

  if (position.isLoading || !hasPos) return null;

  const resolved = market.data?.resolved ?? false;
  const winningOutcome = market.data?.winningOutcome ?? -1;
  const canRedeem = resolved && hasWinningShares(winningOutcome, yesShares, noShares);

  const question =
    post.content?.replace(/#ORB-INTERNAL_ID:\w+/g, '').trim() ?? 'Untitled Market';

  return (
    <>
    <div className="mx-4 mb-3 p-4 rounded-2xl bg-white/5 border border-white/10">
      <p className="text-sm text-[#e0e0e0] leading-snug mb-3 line-clamp-2 text-pretty">
        {question}
      </p>

      <div className="flex items-center gap-3 mb-3">
        {yesShares > 0n && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[#00d4aa] font-bold">YES</span>
            <span className="text-white font-mono tabular-nums">
              {formatShares(yesShares)}
            </span>
          </div>
        )}
        {noShares > 0n && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[#e01b24] font-bold">NO</span>
            <span className="text-white font-mono tabular-nums">
              {formatShares(noShares)}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        {resolved ? (
          <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 text-[#888] font-medium">
            Resolved: {outcomeLabel(winningOutcome)}
          </span>
        ) : (
          <span className="text-xs px-2.5 py-1 rounded-full bg-[#00d4aa]/10 text-[#00d4aa] border border-[#00d4aa]/20 font-medium">
            Live
          </span>
        )}

        {canRedeem && (
          <button
            onClick={() => setDrawerOpen(true)}
            className="text-xs px-3 py-1.5 rounded-xl bg-[#00d4aa] text-black font-bold hover:bg-[#00d4aa]/90 active:scale-95 transition-all"
          >
            Redeem
          </button>
        )}
      </div>
    </div>
    {canRedeem && (
      <SoothTradeDrawer
        postIdStr={post.id}
        feedAddress={post.feedAddress}
        question={question}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    )}
    </>
  );
}

function PositionsSection({
  posts,
  user,
}: {
  posts: LensPost[];
  user: Address;
}) {
  const [checkedCount, setCheckedCount] = useState(0);
  const [foundCount, setFoundCount] = useState(0);

  const onChecked = useCallback((_id: string, hasPosition: boolean) => {
    setCheckedCount((c) => c + 1);
    if (hasPosition) setFoundCount((c) => c + 1);
  }, []);

  const allChecked = checkedCount >= posts.length;
  const isScanning = posts.length > 0 && !allChecked;

  return (
    <div className="mt-6 pb-24">
      <div className="px-4 mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">
          Positions
        </h2>
        {isScanning && (
          <div className="flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 text-[#00d4aa] animate-spin" />
            <span className="text-xs text-[#888]">
              Scanning {checkedCount}/{posts.length}
            </span>
          </div>
        )}
      </div>

      {posts.map((post) => (
        <PositionRow
          key={post.id}
          post={post}
          user={user}
          onChecked={onChecked}
        />
      ))}

      {allChecked && foundCount === 0 && (
        <div className="mx-4 py-8 flex flex-col items-center text-center">
          <CircleDot className="w-10 h-10 text-white/10 mb-3" />
          <p className="text-sm text-[#888]">No positions found</p>
          <p className="text-xs text-[#555] mt-1">
            Trade on markets to see your positions here
          </p>
        </div>
      )}
    </div>
  );
}

function ConnectPrompt({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
      <div className="size-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
        <Wallet className="w-8 h-8 text-[#00d4aa]" />
      </div>
      <h2 className="text-lg font-bold text-white mb-2 text-balance">
        Connect your wallet
      </h2>
      <p className="text-sm text-[#888] mb-6 text-pretty">
        Connect your wallet to view your {TOKEN_LABEL} balance and market
        positions.
      </p>
      <button
        onClick={onConnect}
        className="px-6 py-3 rounded-2xl bg-[#00d4aa] text-black font-bold text-sm hover:bg-[#00d4aa]/90 active:scale-95 transition-all"
      >
        Connect Wallet
      </button>
    </div>
  );
}

export function Portfolio() {
  const { open } = useAppKit();
  const { isConnected, address } = useAccount();
  const inShowcase = useShowcase();

  const { data: posts, isLoading: feedLoading } = useLensFeed('sooth-market');

  const soothMarketPosts = (posts ?? []).filter(
    (p) => p.tags.includes('sooth-market') && p.feedAddress,
  );

  return (
    <div
      className={`${inShowcase ? 'h-full' : 'min-h-dvh'} w-full flex flex-col bg-mesh text-white`}
    >
      <header className="shrink-0 pt-4 px-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[#00d4aa]" />
          <h1 className="text-lg font-bold">Portfolio</h1>
        </div>
        {isConnected && (
          <button
            onClick={() => open()}
            className="active:scale-90 transition-transform"
            aria-label="Open wallet"
          >
            <Wallet className="w-5 h-5 text-[#00d4aa]" />
          </button>
        )}
      </header>

      {!isConnected ? (
        <ConnectPrompt onConnect={() => open()} />
      ) : (
        <div className="flex-1 overflow-y-auto">
          <BalanceCard address={address as Address} />

          {feedLoading ? (
            <div className="mt-8 flex flex-col items-center">
              <Loader2 className="w-8 h-8 text-[#00d4aa] animate-spin mb-2" />
              <p className="text-sm text-[#888]">Loading markets…</p>
            </div>
          ) : soothMarketPosts.length === 0 ? (
            <div className="mt-6 pb-24">
              <div className="px-4 mb-3">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Positions
                </h2>
              </div>
              <div className="mx-4 py-8 flex flex-col items-center text-center">
                <CircleDot className="w-10 h-10 text-white/10 mb-3" />
                <p className="text-sm text-[#888]">No markets to scan</p>
                <p className="text-xs text-[#555] mt-1">
                  Markets will appear here once created
                </p>
              </div>
            </div>
          ) : (
            <PositionsSection
              posts={soothMarketPosts}
              user={address as Address}
            />
          )}
        </div>
      )}
    </div>
  );
}
