import { useCallback, useEffect, useRef, useState } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { CircleDot, ExternalLink, Loader2, LogOut, Wallet } from 'lucide-react';
import { useLensAuth } from '../hooks/useLensAuth';
import { useWGHOBalance } from '../hooks/useWGHOBalance';
import { formatUnits, type Address } from 'viem';
import { useSoothPosition } from '../hooks/useSoothPosition';
import { useSoothMarket } from '../hooks/useSoothMarket';
import { useLensFeed, type LensPost } from '../hooks/useLensFeed';
import { IS_TESTNET } from '../lib/lensConfig';
import { useShowcase } from '../hooks/useShowcase';
import { SoothTradeDrawer } from '../components/SoothTradeDrawer';

const TOKEN_LABEL = IS_TESTNET ? 'WGRASS' : 'WGHO';
const NETWORK_NAME = IS_TESTNET ? 'Lens Testnet' : 'Lens Chain';
const EXPLORER_BASE = IS_TESTNET
  ? 'https://explorer.testnet.lens.xyz/address/'
  : 'https://explorer.lens.xyz/address/';

interface LensAccountDetails {
  username?: string;
  avatar?: string;
}

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatBalance(formatted: string): string {
  const num = parseFloat(formatted);
  if (num === 0) return '0.00';
  if (num < 0.01) return '<0.01';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  return num.toFixed(4);
}

function IdentityCard({
  isAuthenticated,
  address,
  accountDetails,
  isLoadingDetails,
}: {
  isAuthenticated: boolean;
  address: string | undefined;
  accountDetails: LensAccountDetails | null;
  isLoadingDetails: boolean;
}) {
  const displayName = isAuthenticated && accountDetails?.username
    ? accountDetails.username
    : address
      ? formatAddress(address)
      : 'Not Connected';

  const avatarUrl = isAuthenticated && accountDetails?.avatar
    ? accountDetails.avatar
    : null;

  return (
    <div className="mx-4 mt-6 p-6 rounded-2xl bg-white/5 border border-white/10">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="shrink-0">
          {isLoadingDetails ? (
            <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-[#00d4aa] animate-spin" />
            </div>
          ) : avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Avatar"
              className="w-16 h-16 rounded-full object-cover bg-white/10"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
              <Wallet className="w-8 h-8 text-[#00d4aa]" />
            </div>
          )}
        </div>

        {/* Identity Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-bold text-white truncate">
              {displayName}
            </h2>
            {isAuthenticated && (
              <span className="shrink-0 px-2 py-1 rounded-full bg-[#00d4aa]/10 text-[#00d4aa] text-xs font-medium border border-[#00d4aa]/20">
                Lens
              </span>
            )}
          </div>

          {/* Network Badge */}
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-[#888] text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-[#00d4aa]" />
              {NETWORK_NAME}
            </span>
          </div>

          {/* Address (if Lens authenticated) */}
          {isAuthenticated && address && (
            <p className="text-xs text-[#666] font-mono">
              {formatAddress(address)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function BalanceCard({ address }: { address: string | undefined }) {
  const { data, isLoading } = useWGHOBalance(address as Address | undefined);

  return (
    <div className="mx-4 mt-4 p-4 rounded-2xl bg-white/5 border border-white/10">
      <div className="text-xs text-[#888] uppercase tracking-wider mb-2">
        Balance
      </div>
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

function ExplorerLink({ address }: { address: string | undefined }) {
  if (!address) return null;

  return (
    <a
      href={`${EXPLORER_BASE}${address}`}
      target="_blank"
      rel="noopener noreferrer"
      className="mx-4 mt-4 p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between hover:bg-white/10 transition-colors"
    >
      <span className="text-sm font-medium text-white">View on Explorer</span>
      <ExternalLink className="w-4 h-4 text-[#00d4aa]" />
    </a>
  );
}

function DisconnectButton({ onDisconnect }: { onDisconnect: () => void }) {
  return (
    <button
      onClick={onDisconnect}
      className="mx-4 mt-4 w-[calc(100%-2rem)] py-3 rounded-2xl bg-white/5 border border-white/10 text-white font-medium text-sm flex items-center justify-center gap-2 hover:bg-white/10 active:scale-95 transition-all"
    >
      <LogOut className="w-4 h-4" />
      Disconnect Wallet
    </button>
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
        Connect your wallet to view your Lens identity, {TOKEN_LABEL} balance, and positions.
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

type PositionResult = 'win' | 'loss' | 'pending' | 'none';

function PositionRow({
  post,
  user,
  onChecked,
}: {
  post: LensPost;
  user: Address;
  onChecked: (id: string, result: PositionResult) => void;
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

  const resolved = market.data?.resolved ?? false;
  const winningOutcome = market.data?.winningOutcome ?? -1;

  const reported = useRef(false);

  useEffect(() => {
    if (!position.isLoading && !market.isLoading && !reported.current) {
      reported.current = true;
      if (!hasPos) {
        onChecked(post.id, 'none');
      } else if (!resolved) {
        onChecked(post.id, 'pending');
      } else if (hasWinningShares(winningOutcome, yesShares, noShares)) {
        onChecked(post.id, 'win');
      } else {
        onChecked(post.id, 'loss');
      }
    }
  }, [position.isLoading, market.isLoading, hasPos, resolved, winningOutcome, yesShares, noShares, post.id, onChecked]);

  if (position.isLoading || market.isLoading || !hasPos) return null;

  const question =
    post.content?.replace(/#ORB-INTERNAL_ID:\w+/g, '').trim() ?? 'Untitled Market';

  const isWin = resolved && hasWinningShares(winningOutcome, yesShares, noShares);
  const canRedeem = resolved && isWin;

  return (
    <>
      <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
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
          <div className="flex items-center gap-2">
            {resolved ? (
              <>
                <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 text-[#888] font-medium">
                  Resolved: {outcomeLabel(winningOutcome)}
                </span>
                {isWin ? (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-[#00d4aa]/10 text-[#00d4aa] border border-[#00d4aa]/20 font-medium">
                    Win
                  </span>
                ) : (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-[#e01b24]/10 text-[#e01b24] border border-[#e01b24]/20 font-medium">
                    Loss
                  </span>
                )}
              </>
            ) : (
              <span className="text-xs px-2.5 py-1 rounded-full bg-[#00d4aa]/10 text-[#00d4aa] border border-[#00d4aa]/20 font-medium">
                Live
              </span>
            )}
          </div>

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

function PositionsSection({ address }: { address: Address }) {
  const { data: posts, isLoading: feedLoading } = useLensFeed('sooth-market');

  const soothMarketPosts = (posts ?? []).filter(
    (p) => p.tags.includes('sooth-market') && p.feedAddress,
  );

  const [checkedCount, setCheckedCount] = useState(0);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [pending, setPending] = useState(0);

  const onChecked = useCallback((_id: string, result: PositionResult) => {
    setCheckedCount((c) => c + 1);
    if (result === 'win') setWins((c) => c + 1);
    if (result === 'loss') setLosses((c) => c + 1);
    if (result === 'pending') setPending((c) => c + 1);
  }, []);

  const allChecked = checkedCount >= soothMarketPosts.length;
  const isScanning = soothMarketPosts.length > 0 && !allChecked;
  const totalPositions = wins + losses + pending;

  if (feedLoading) {
    return (
      <div className="mx-4 mt-6">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-3">
          Positions
        </h2>
        <div className="flex items-center gap-2 py-4">
          <Loader2 className="w-4 h-4 text-[#00d4aa] animate-spin" />
          <span className="text-sm text-[#888]">Loading markets…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-4 mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">
          Positions
        </h2>
        {isScanning && (
          <div className="flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 text-[#00d4aa] animate-spin" />
            <span className="text-xs text-[#888]">
              Scanning {checkedCount}/{soothMarketPosts.length}
            </span>
          </div>
        )}
      </div>

      {allChecked && totalPositions > 0 && (
        <div className="p-3 rounded-2xl bg-white/5 border border-white/10 mb-3">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-[#00d4aa] font-bold">{wins} {wins === 1 ? 'win' : 'wins'}</span>
            <span className="text-[#e01b24] font-bold">{losses} {losses === 1 ? 'loss' : 'losses'}</span>
            <span className="text-[#888] font-medium">{pending} live</span>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {soothMarketPosts.map((post) => (
          <PositionRow
            key={post.id}
            post={post}
            user={address}
            onChecked={onChecked}
          />
        ))}
      </div>

      {allChecked && totalPositions === 0 && (
        <div className="py-8 flex flex-col items-center text-center">
          <CircleDot className="w-10 h-10 text-white/10 mb-3" />
          <p className="text-sm text-[#888]">No positions yet</p>
          <p className="text-xs text-[#555] mt-1">
            Trade on markets to see your positions here
          </p>
        </div>
      )}
    </div>
  );
}

export function Profile() {
  const { open } = useAppKit();
  const { isConnected, address } = useAccount();
  const { disconnect } = useDisconnect();
  const { isAuthenticated, sessionClient } = useLensAuth();
  const inShowcase = useShowcase();

  const [accountDetails, setAccountDetails] = useState<LensAccountDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setAccountDetails(null);
      return;
    }

    const fetchDetails = async () => {
      try {
        setIsLoadingDetails(true);
        const authUserResult = sessionClient?.getAuthenticatedUser();
        if (authUserResult && !authUserResult.isErr()) {
          const authUser = authUserResult.value;
          setAccountDetails({
            username: authUser.signer ? `${authUser.signer.slice(0, 6)}...` : undefined,
            avatar: undefined,
          });
        }
      } catch (error) {
        console.error('Failed to fetch Lens account details:', error);
      } finally {
        setIsLoadingDetails(false);
      }
    };

    void fetchDetails();
  }, [isAuthenticated, sessionClient]);

  return (
    <div className={`${inShowcase ? 'h-full' : 'min-h-dvh'} w-full flex flex-col bg-mesh text-white`}>
      {/* Header */}
      <header className="shrink-0 pt-4 px-4 pb-2 flex items-center justify-between">
        <h1 className="text-lg font-bold">Profile</h1>
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

      {/* Content */}
      {!isConnected ? (
        <ConnectPrompt onConnect={() => open()} />
      ) : (
        <div className="flex-1 overflow-y-auto pb-24">
          <IdentityCard
            isAuthenticated={isAuthenticated}
            address={address}
            accountDetails={accountDetails}
            isLoadingDetails={isLoadingDetails}
          />

          <BalanceCard address={address} />

          <PositionsSection address={address as Address} />

          <ExplorerLink address={address} />

          <DisconnectButton onDisconnect={() => disconnect()} />
        </div>
      )}
    </div>
  );
}
