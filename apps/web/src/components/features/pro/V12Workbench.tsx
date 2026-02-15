import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ExternalLink, Loader2 } from 'lucide-react';
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useSwitchChain,
  useWriteContract,
} from 'wagmi';
import { formatUnits, isAddress, parseAbiItem, parseUnits } from 'viem';
import toast from 'react-hot-toast';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { ERC20_ABI, SOOTHBOOK_ABI } from '../../../config/abis';
import deployments from '../../../config/deployments.json';
import { useSoothBookMarket } from '../../../hooks/useSoothBook';

const BASE_SEPOLIA = 84532;
const DEFAULT_MARKET_KEY = '0x79a7bc6308ae7267ddd3776d02ad1446f41d1e3ed74ed41b5184fc53cc8bd5b5';

type DeploymentNetwork = {
  chainId?: number;
  contracts?: Record<string, string>;
};

const getSoothBookAddress = (chainId: number): string | undefined => {
  for (const network of Object.values(deployments.networks as Record<string, DeploymentNetwork>)) {
    if (network.chainId === chainId) {
      return network.contracts?.SoothBook;
    }
  }
  return undefined;
};

const ORDER_PLACED_EVENT = parseAbiItem(
  'event OrderPlaced(bytes32 indexed marketKey, uint8 side, uint16 tick, address indexed maker, uint128 amount, bool escrow)'
);
const ORDER_FILLED_EVENT = parseAbiItem(
  'event OrderFilled(bytes32 indexed marketKey, uint8 takerSide, uint16 yesTick, uint16 noTick, address indexed taker, address indexed maker, uint128 amount, uint256 surplus)'
);
const ORDER_CANCELLED_EVENT = parseAbiItem(
  'event OrderCancelled(bytes32 indexed marketKey, uint8 side, uint16 tick, address indexed maker, uint128 amount)'
);

const explorerUrl = (chainId: number, segment: 'tx' | 'address', value: string) => {
  const base = chainId === BASE_SEPOLIA ? 'https://sepolia.basescan.org' : 'https://sepolia.basescan.org';
  return `${base}/${segment}/${value}`;
};

const toBytes32 = (value: string): `0x${string}` | null => (/^0x[0-9a-fA-F]{64}$/.test(value) ? (value as `0x${string}`) : null);

const parseAmount = (raw: string, decimals: number): bigint | null => {
  if (!raw || Number(raw) <= 0) return null;
  try {
    return parseUnits(raw, decimals);
  } catch {
    return null;
  }
};

const fmt = (value: bigint | undefined, decimals = 18, digits = 4) => {
  if (value === undefined) return '-';
  return Number(formatUnits(value, decimals)).toFixed(digits);
};

type BookRow = {
  tick: number;
  yesAmount: bigint;
  yesCount: bigint;
  noAmount: bigint;
  noCount: bigint;
};

type FeedItem = {
  id: string;
  type: 'placed' | 'filled' | 'cancelled';
  sideLabel: string;
  tickLabel: string;
  amount: bigint;
  account: `0x${string}`;
  block: bigint;
};

const shortAddress = (value: string) => `${value.slice(0, 6)}...${value.slice(-4)}`;

export const V12Workbench = () => {
  const { address: userAddress, isConnected, chainId: walletChainId } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const [soothBookInput, setSoothBookInput] = useState(getSoothBookAddress(BASE_SEPOLIA) || '');
  const [marketKeyInput, setMarketKeyInput] = useState(DEFAULT_MARKET_KEY);
  const [tickInput, setTickInput] = useState('500');
  const [inspectTickInput, setInspectTickInput] = useState('500');
  const [sharesInput, setSharesInput] = useState('1');
  const [mintMergeInput, setMintMergeInput] = useState('1');
  const [approveInput, setApproveInput] = useState('10000');
  const [maxCostInput, setMaxCostInput] = useState('0');
  const [tradeSide, setTradeSide] = useState<'yes' | 'no'>('yes');
  const [escrowExit, setEscrowExit] = useState(false);
  const [cancelSide, setCancelSide] = useState<'yes' | 'no'>('yes');
  const [resolveOutcome, setResolveOutcome] = useState<'0' | '1' | '2'>('1');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const [bookCenterInput, setBookCenterInput] = useState('500');
  const [bookWindowInput, setBookWindowInput] = useState('24');
  const [bookRows, setBookRows] = useState<BookRow[]>([]);
  const [isBookLoading, setIsBookLoading] = useState(false);
  const [lookbackBlocksInput, setLookbackBlocksInput] = useState('50000');
  const [eventFeed, setEventFeed] = useState<FeedItem[]>([]);
  const [isEventFeedLoading, setIsEventFeedLoading] = useState(false);

  const soothBookAddress = useMemo(
    () => (isAddress(soothBookInput) ? (soothBookInput as `0x${string}`) : null),
    [soothBookInput]
  );
  const marketKey = useMemo(() => toBytes32(marketKeyInput), [marketKeyInput]);
  const isWrongNetwork = walletChainId !== BASE_SEPOLIA;
  const currentTick = Math.max(1, Math.min(999, Number(tickInput) || 500));
  const inspectTick = Math.max(1, Math.min(999, Number(inspectTickInput) || 500));
  const bookCenterTick = Math.max(1, Math.min(999, Number(bookCenterInput) || 500));
  const bookWindowSize = Math.max(1, Math.min(120, Number(bookWindowInput) || 24));
  const lookbackBlocks = Math.max(500, Math.min(200000, Number(lookbackBlocksInput) || 50000));

  const canReadMarket = !!soothBookAddress && !!marketKey;

  const { data: owner } = useReadContract({
    address: soothBookAddress ?? undefined,
    abi: SOOTHBOOK_ABI,
    functionName: 'owner',
    query: { enabled: !!soothBookAddress },
  });

  const { marketState, prices, backing, isLoading: isMarketStateLoading } = useSoothBookMarket(
    soothBookAddress ?? undefined,
    marketKey ?? undefined
  );
  const { collateral, yesToken, noToken, isActive, isFinalized, outcome } = marketState;
  const { bestYesTick, bestNoTick, yesPrice, noPrice } = prices;

  const { data: collateralSymbolData } = useReadContract({
    address: collateral,
    abi: ERC20_ABI,
    functionName: 'symbol',
    query: { enabled: !!collateral },
  });
  const { data: collateralDecimalsData = 18 } = useReadContract({
    address: collateral,
    abi: ERC20_ABI,
    functionName: 'decimals',
    query: { enabled: !!collateral },
  });

  const { data: collateralBalanceData = 0n } = useReadContract({
    address: collateral,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!collateral && !!userAddress },
  });
  const { data: yesBalanceData = 0n } = useReadContract({
    address: yesToken,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!yesToken && !!userAddress },
  });
  const { data: noBalanceData = 0n } = useReadContract({
    address: noToken,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!noToken && !!userAddress },
  });
  const { data: allowanceData = 0n } = useReadContract({
    address: collateral,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: userAddress && soothBookAddress ? [userAddress, soothBookAddress] : undefined,
    query: { enabled: !!collateral && !!userAddress && !!soothBookAddress },
  });

  const collateralSymbol = collateralSymbolData as string | undefined;
  const collateralDecimals = collateralDecimalsData as number;
  const collateralBalance = collateralBalanceData as bigint;
  const yesBalance = yesBalanceData as bigint;
  const noBalance = noBalanceData as bigint;
  const allowance = allowanceData as bigint;

  const { data: bookAtTick } = useReadContracts({
    contracts:
      canReadMarket && soothBookAddress
        ? [
            {
              address: soothBookAddress,
              abi: SOOTHBOOK_ABI,
              functionName: 'getOrdersAtTick',
              args: [marketKey!, 1, inspectTick],
            },
            {
              address: soothBookAddress,
              abi: SOOTHBOOK_ABI,
              functionName: 'getOrdersAtTick',
              args: [marketKey!, 0, inspectTick],
            },
          ]
        : [],
    query: { enabled: canReadMarket && !!soothBookAddress },
  });

  const decimals = Number(collateralDecimals);
  const sharesWad = parseAmount(sharesInput, 18);
  const mintMergeAmount = parseAmount(mintMergeInput, decimals);
  const approveAmount = parseAmount(approveInput, decimals);
  const maxCostAmount = parseAmount(maxCostInput, decimals) ?? 0n;

  const ensureBaseSepolia = async () => {
    if (!isWrongNetwork) return true;
    if (!switchChainAsync) {
      toast.error('Wallet cannot switch network automatically');
      return false;
    }
    try {
      const switched = await switchChainAsync({ chainId: BASE_SEPOLIA });
      if (switched.id !== BASE_SEPOLIA) {
        toast.error('Switch to Base Sepolia and retry');
      }
      return false;
    } catch (error: any) {
      toast.error(error?.shortMessage || 'Switch to Base Sepolia first');
      return false;
    }
  };

  const executeWrite = async (
    loadingText: string,
    fn: string,
    args: readonly unknown[],
    addressOverride?: `0x${string}`,
    abiOverride?: typeof SOOTHBOOK_ABI | typeof ERC20_ABI
  ) => {
    if (!isConnected || !userAddress) {
      toast.error('Connect wallet first');
      return;
    }
    if (!(await ensureBaseSepolia())) return;

    const targetAddress = addressOverride ?? soothBookAddress;
    const targetAbi = abiOverride ?? SOOTHBOOK_ABI;
    if (!targetAddress) {
      toast.error('Missing contract address');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading(loadingText);
    try {
      if (publicClient) {
        await publicClient.simulateContract({
          account: userAddress,
          address: targetAddress,
          abi: targetAbi,
          functionName: fn as never,
          args: args as never,
        });
      }
      const hash = await writeContractAsync({
        address: targetAddress,
        abi: targetAbi,
        functionName: fn as never,
        args: args as never,
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      setLastTx(hash);
      toast.success('Transaction confirmed', { id: toastId });
      void refreshBookSnapshot();
      void refreshEventFeed();
    } catch (error: any) {
      toast.error(error?.shortMessage || error?.cause?.shortMessage || error?.message || 'Transaction failed', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const yesAtInspect = (bookAtTick?.[0]?.result as readonly [bigint, bigint] | undefined)?.[0] ?? 0n;
  const yesOrdersCount = (bookAtTick?.[0]?.result as readonly [bigint, bigint] | undefined)?.[1] ?? 0n;
  const noAtInspect = (bookAtTick?.[1]?.result as readonly [bigint, bigint] | undefined)?.[0] ?? 0n;
  const noOrdersCount = (bookAtTick?.[1]?.result as readonly [bigint, bigint] | undefined)?.[1] ?? 0n;

  const isOwner = !!userAddress && !!owner && userAddress.toLowerCase() === (owner as string).toLowerCase();

  const refreshBookSnapshot = useCallback(async () => {
    if (!publicClient || !soothBookAddress || !marketKey) return;
    setIsBookLoading(true);
    try {
      const startTick = Math.max(1, bookCenterTick - bookWindowSize);
      const endTick = Math.min(999, bookCenterTick + bookWindowSize);
      const contracts: Array<{
        address: `0x${string}`;
        abi: typeof SOOTHBOOK_ABI;
        functionName: 'getOrdersAtTick';
        args: readonly [`0x${string}`, number, number];
      }> = [];

      for (let tick = startTick; tick <= endTick; tick++) {
        contracts.push({
          address: soothBookAddress,
          abi: SOOTHBOOK_ABI,
          functionName: 'getOrdersAtTick',
          args: [marketKey, 1, tick],
        });
        contracts.push({
          address: soothBookAddress,
          abi: SOOTHBOOK_ABI,
          functionName: 'getOrdersAtTick',
          args: [marketKey, 0, tick],
        });
      }

      const results = await publicClient.multicall({ contracts });
      const rows: BookRow[] = [];
      let idx = 0;
      for (let tick = startTick; tick <= endTick; tick++) {
        const yesRes = results[idx++];
        const noRes = results[idx++];
        const yesTuple = yesRes.status === 'success' ? (yesRes.result as readonly [bigint, bigint]) : [0n, 0n] as const;
        const noTuple = noRes.status === 'success' ? (noRes.result as readonly [bigint, bigint]) : [0n, 0n] as const;
        rows.push({
          tick,
          yesAmount: yesTuple[0],
          yesCount: yesTuple[1],
          noAmount: noTuple[0],
          noCount: noTuple[1],
        });
      }
      setBookRows(rows);
    } catch (error: any) {
      toast.error(error?.shortMessage || error?.message || 'Failed to refresh bitmap snapshot');
    } finally {
      setIsBookLoading(false);
    }
  }, [publicClient, soothBookAddress, marketKey, bookCenterTick, bookWindowSize]);

  const refreshEventFeed = useCallback(async () => {
    if (!publicClient || !soothBookAddress || !marketKey) return;
    setIsEventFeedLoading(true);
    try {
      const latestBlock = await publicClient.getBlockNumber();
      const fromBlock = latestBlock > BigInt(lookbackBlocks) ? latestBlock - BigInt(lookbackBlocks) : 0n;

      const [placedLogs, filledLogs, cancelledLogs] = await Promise.all([
        publicClient.getLogs({
          address: soothBookAddress,
          event: ORDER_PLACED_EVENT,
          args: { marketKey },
          fromBlock,
          toBlock: 'latest',
        }),
        publicClient.getLogs({
          address: soothBookAddress,
          event: ORDER_FILLED_EVENT,
          args: { marketKey },
          fromBlock,
          toBlock: 'latest',
        }),
        publicClient.getLogs({
          address: soothBookAddress,
          event: ORDER_CANCELLED_EVENT,
          args: { marketKey },
          fromBlock,
          toBlock: 'latest',
        }),
      ]);

      const feed: FeedItem[] = [];
      for (const log of placedLogs) {
        feed.push({
          id: `${log.transactionHash}-${log.logIndex}-placed`,
          type: 'placed',
          sideLabel: Number(log.args.side) === 1 ? 'YES' : 'NO',
          tickLabel: String(log.args.tick),
          amount: log.args.amount ?? 0n,
          account: log.args.maker as `0x${string}`,
          block: log.blockNumber ?? 0n,
        });
      }
      for (const log of filledLogs) {
        const yesTick = Number(log.args.yesTick ?? 0);
        const noTick = Number(log.args.noTick ?? 0);
        const takerSide = Number(log.args.takerSide) === 1 ? 'YES taker' : 'NO taker';
        feed.push({
          id: `${log.transactionHash}-${log.logIndex}-filled`,
          type: 'filled',
          sideLabel: takerSide,
          tickLabel: `${yesTick}/${noTick}`,
          amount: log.args.amount ?? 0n,
          account: log.args.taker as `0x${string}`,
          block: log.blockNumber ?? 0n,
        });
      }
      for (const log of cancelledLogs) {
        feed.push({
          id: `${log.transactionHash}-${log.logIndex}-cancelled`,
          type: 'cancelled',
          sideLabel: Number(log.args.side) === 1 ? 'YES' : 'NO',
          tickLabel: String(log.args.tick),
          amount: log.args.amount ?? 0n,
          account: log.args.maker as `0x${string}`,
          block: log.blockNumber ?? 0n,
        });
      }

      feed.sort((a, b) => {
        if (a.block === b.block) return a.id > b.id ? -1 : 1;
        return a.block > b.block ? -1 : 1;
      });
      setEventFeed(feed.slice(0, 100));
    } catch (error: any) {
      toast.error(error?.shortMessage || error?.message || 'Failed to load order events');
    } finally {
      setIsEventFeedLoading(false);
    }
  }, [publicClient, soothBookAddress, marketKey, lookbackBlocks]);

  useEffect(() => {
    if (!canReadMarket || !publicClient || isWrongNetwork) return;
    void refreshBookSnapshot();
    void refreshEventFeed();
  }, [canReadMarket, publicClient, isWrongNetwork, refreshBookSnapshot, refreshEventFeed]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">V12 Workbench</h1>
          <p className="text-sm text-slate-400">Comprehensive SoothBook tester (trade, mint/merge, cancel, redeem, inspect).</p>
        </div>
        <Badge variant={isWrongNetwork ? 'warning' : 'success'}>
          {isWrongNetwork ? `Wallet: ${walletChainId ?? 'unknown'} (wrong)` : `Wallet: ${walletChainId} (Base Sepolia)`}
        </Badge>
      </div>

      {isWrongNetwork && (
        <Card className="border-amber-500/40 bg-amber-500/10 p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-amber-300 text-sm">
              <AlertCircle className="w-4 h-4" />
              Switch wallet to Base Sepolia (`84532`) before submitting.
            </div>
            <Button onClick={() => switchChainAsync?.({ chainId: BASE_SEPOLIA })} disabled={!isConnected || isSwitching}>
              {isSwitching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Switch Network'}
            </Button>
          </div>
        </Card>
      )}

      <Card className="p-4 space-y-3">
        <div className="text-xs uppercase tracking-wider text-slate-500">Target</div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <label className="text-xs text-slate-400 space-y-1">
            <span>SoothBook address</span>
            <input value={soothBookInput} onChange={(e) => setSoothBookInput(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-white" />
          </label>
          <label className="text-xs text-slate-400 space-y-1">
            <span>Market key (bytes32)</span>
            <input value={marketKeyInput} onChange={(e) => setMarketKeyInput(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-white" />
          </label>
        </div>
        {soothBookAddress ? (
          <a href={explorerUrl(chainId, 'address', soothBookAddress)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-300">
            View SoothBook on explorer <ExternalLink className="w-3.5 h-3.5" />
          </a>
        ) : (
          <div className="text-xs text-rose-400">Invalid SoothBook address</div>
        )}
        {!marketKey && <div className="text-xs text-rose-400">Market key must be a full bytes32 hex string.</div>}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4 space-y-2">
          <div className="text-xs uppercase tracking-wider text-slate-500">Market State</div>
          {isMarketStateLoading && <div className="text-xs text-slate-500">Loading market state...</div>}
          <div className="text-sm text-slate-300">Status: {isFinalized ? 'Finalized' : isActive ? 'Active' : 'Inactive/Unknown'}</div>
          <div className="text-sm text-slate-300">Outcome: {outcome} ({outcome === 0 ? 'NO' : outcome === 1 ? 'YES' : 'INVALID'})</div>
          <div className="text-sm text-slate-300 font-mono">Collateral: {collateral ?? '-'}</div>
          <div className="text-sm text-slate-300 font-mono">YES token: {yesToken ?? '-'}</div>
          <div className="text-sm text-slate-300 font-mono">NO token: {noToken ?? '-'}</div>
          <div className="text-sm text-slate-300">Collateral backing: {fmt(backing as bigint | undefined, decimals, 4)} {collateralSymbol ?? ''}</div>
          <div className="text-sm text-slate-300">Best YES tick: {String(bestYesTick ?? '-')}</div>
          <div className="text-sm text-slate-300">Best NO tick: {String(bestNoTick ?? '-')}</div>
          <div className="text-sm text-slate-300">Implied YES: {fmt(yesPrice, 18, 4)}</div>
          <div className="text-sm text-slate-300">Implied NO: {fmt(noPrice, 18, 4)}</div>
        </Card>

        <Card className="p-4 space-y-2">
          <div className="text-xs uppercase tracking-wider text-slate-500">Wallet</div>
          <div className="text-sm text-slate-300 font-mono">Address: {userAddress ?? '-'}</div>
          <div className="text-sm text-slate-300">{collateralSymbol ?? 'Collateral'} balance: {fmt(collateralBalance, decimals, 4)}</div>
          <div className="text-sm text-slate-300">YES balance: {fmt(yesBalance, 18, 4)}</div>
          <div className="text-sm text-slate-300">NO balance: {fmt(noBalance, 18, 4)}</div>
          <div className="text-sm text-slate-300">Allowance to SoothBook: {fmt(allowance, decimals, 4)}</div>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <input value={approveInput} onChange={(e) => setApproveInput(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-white" placeholder="Approve amount" />
            <Button
              disabled={!approveAmount || !collateral || !soothBookAddress || isSubmitting}
              onClick={() => {
                if (!approveAmount || !collateral || !soothBookAddress) return;
                void executeWrite('Approving collateral...', 'approve', [soothBookAddress, approveAmount], collateral, ERC20_ABI);
              }}
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Approve'}
            </Button>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4 space-y-3">
          <div className="text-xs uppercase tracking-wider text-slate-500">Trade (buyYes / buyNo)</div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setTradeSide('yes')} className={`rounded-lg border px-3 py-2 text-sm ${tradeSide === 'yes' ? 'border-slate-500 bg-slate-800 text-white' : 'border-slate-700 bg-slate-950 text-slate-400'}`}>buyYes</button>
            <button onClick={() => setTradeSide('no')} className={`rounded-lg border px-3 py-2 text-sm ${tradeSide === 'no' ? 'border-slate-500 bg-slate-800 text-white' : 'border-slate-700 bg-slate-950 text-slate-400'}`}>buyNo</button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input value={tickInput} onChange={(e) => setTickInput(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-white" placeholder="tick 1-999" />
            <input value={sharesInput} onChange={(e) => setSharesInput(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-white" placeholder="shares (18d)" />
            <input value={maxCostInput} onChange={(e) => setMaxCostInput(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-white" placeholder="maxCost (0=off)" />
          </div>
          <label className="text-sm text-slate-300 inline-flex items-center gap-2">
            <input type="checkbox" checked={escrowExit} onChange={(e) => setEscrowExit(e.target.checked)} />
            escrow=true (exit opposite position)
          </label>
          <Button
            disabled={!sharesWad || !canReadMarket || !soothBookAddress || isSubmitting}
            onClick={() => {
              if (!sharesWad || !marketKey || !soothBookAddress) return;
              const fn = tradeSide === 'yes' ? 'buyYes' : 'buyNo';
              void executeWrite('Submitting order...', fn, [marketKey, currentTick, sharesWad, escrowExit, maxCostAmount]);
            }}
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : `Execute ${tradeSide === 'yes' ? 'buyYes' : 'buyNo'}`}
          </Button>
        </Card>

        <Card className="p-4 space-y-3">
          <div className="text-xs uppercase tracking-wider text-slate-500">Mint / Merge / Redeem</div>
          <input value={mintMergeInput} onChange={(e) => setMintMergeInput(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-white" placeholder={`amount (${collateralSymbol ?? 'collateral'} decimals)`} />
          <div className="grid grid-cols-2 gap-2">
            <Button disabled={!mintMergeAmount || !marketKey || isSubmitting} onClick={() => marketKey && mintMergeAmount && executeWrite('Minting complete set...', 'mint', [marketKey, mintMergeAmount])}>Mint</Button>
            <Button disabled={!mintMergeAmount || !marketKey || isSubmitting} onClick={() => marketKey && mintMergeAmount && executeWrite('Merging complete set...', 'merge', [marketKey, mintMergeAmount])}>Merge</Button>
          </div>
          <Button disabled={!marketKey || isSubmitting} onClick={() => marketKey && executeWrite('Redeeming...', 'redeem', [marketKey])}>Redeem</Button>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4 space-y-3">
          <div className="text-xs uppercase tracking-wider text-slate-500">Cancel Orders</div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setCancelSide('yes')} className={`rounded-lg border px-3 py-2 text-sm ${cancelSide === 'yes' ? 'border-slate-500 bg-slate-800 text-white' : 'border-slate-700 bg-slate-950 text-slate-400'}`}>side=YES (1)</button>
            <button onClick={() => setCancelSide('no')} className={`rounded-lg border px-3 py-2 text-sm ${cancelSide === 'no' ? 'border-slate-500 bg-slate-800 text-white' : 'border-slate-700 bg-slate-950 text-slate-400'}`}>side=NO (0)</button>
          </div>
          <input value={inspectTickInput} onChange={(e) => setInspectTickInput(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-white" placeholder="tick 1-999" />
          <Button
            disabled={!marketKey || !soothBookAddress || isSubmitting}
            onClick={() => {
              if (!marketKey) return;
              void executeWrite('Cancelling order...', 'cancel', [marketKey, cancelSide === 'yes' ? 1 : 0, inspectTick]);
            }}
          >
            Cancel oldest self order @ tick
          </Button>
        </Card>

        <Card className="p-4 space-y-3">
          <div className="text-xs uppercase tracking-wider text-slate-500">Book Inspector + Resolve</div>
          <div className="text-sm text-slate-300">Inspect tick {inspectTick}</div>
          <div className="text-sm text-slate-300">YES side amount: {fmt(yesAtInspect, 18, 4)} | orders: {String(yesOrdersCount)}</div>
          <div className="text-sm text-slate-300">NO side amount: {fmt(noAtInspect, 18, 4)} | orders: {String(noOrdersCount)}</div>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => setResolveOutcome('0')} className={`rounded-lg border px-3 py-2 text-sm ${resolveOutcome === '0' ? 'border-slate-500 bg-slate-800 text-white' : 'border-slate-700 bg-slate-950 text-slate-400'}`}>NO</button>
            <button onClick={() => setResolveOutcome('1')} className={`rounded-lg border px-3 py-2 text-sm ${resolveOutcome === '1' ? 'border-slate-500 bg-slate-800 text-white' : 'border-slate-700 bg-slate-950 text-slate-400'}`}>YES</button>
            <button onClick={() => setResolveOutcome('2')} className={`rounded-lg border px-3 py-2 text-sm ${resolveOutcome === '2' ? 'border-slate-500 bg-slate-800 text-white' : 'border-slate-700 bg-slate-950 text-slate-400'}`}>INVALID</button>
          </div>
          <Button
            disabled={!isOwner || !marketKey || isSubmitting}
            onClick={() => marketKey && executeWrite('Resolving market...', 'resolveMarket', [marketKey, Number(resolveOutcome)])}
          >
            Resolve market (owner only)
          </Button>
          {!isOwner && <div className="text-xs text-slate-500">Connected wallet is not owner ({String(owner ?? '-')}).</div>}
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs uppercase tracking-wider text-slate-500">Bitmap Snapshot (by tick)</div>
            <Button disabled={isBookLoading || !canReadMarket || isWrongNetwork} onClick={() => void refreshBookSnapshot()}>
              {isBookLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Refresh'}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input value={bookCenterInput} onChange={(e) => setBookCenterInput(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-white" placeholder="center tick" />
            <input value={bookWindowInput} onChange={(e) => setBookWindowInput(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-white" placeholder="window +/-" />
          </div>
          <div className="text-xs text-slate-500">Window: {Math.max(1, bookCenterTick - bookWindowSize)} to {Math.min(999, bookCenterTick + bookWindowSize)}. Active ticks are non-zero counts.</div>
          <div className="max-h-80 overflow-auto rounded-lg border border-slate-800">
            <table className="w-full text-xs font-mono">
              <thead className="sticky top-0 bg-slate-950 text-slate-400">
                <tr>
                  <th className="text-left p-2">tick</th>
                  <th className="text-right p-2">YES orders</th>
                  <th className="text-right p-2">YES amt</th>
                  <th className="text-right p-2">NO orders</th>
                  <th className="text-right p-2">NO amt</th>
                </tr>
              </thead>
              <tbody>
                {bookRows.map((row) => {
                  const active = row.yesCount > 0n || row.noCount > 0n;
                  return (
                    <tr key={row.tick} className={active ? 'bg-slate-900/60' : 'bg-slate-950/40'}>
                      <td className="p-2 text-slate-300">{row.tick}</td>
                      <td className="p-2 text-right text-slate-300">{row.yesCount.toString()}</td>
                      <td className="p-2 text-right text-emerald-300">{fmt(row.yesAmount, 18, 3)}</td>
                      <td className="p-2 text-right text-slate-300">{row.noCount.toString()}</td>
                      <td className="p-2 text-right text-rose-300">{fmt(row.noAmount, 18, 3)}</td>
                    </tr>
                  );
                })}
                {bookRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-3 text-center text-slate-500">No snapshot loaded yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs uppercase tracking-wider text-slate-500">Order Event List</div>
            <Button disabled={isEventFeedLoading || !canReadMarket || isWrongNetwork} onClick={() => void refreshEventFeed()}>
              {isEventFeedLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Refresh'}
            </Button>
          </div>
          <input value={lookbackBlocksInput} onChange={(e) => setLookbackBlocksInput(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-white" placeholder="lookback blocks" />
          <div className="text-xs text-slate-500">Ordered by latest block. This is event-based (great for testing flow and fills).</div>
          <div className="max-h-80 overflow-auto rounded-lg border border-slate-800 divide-y divide-slate-800">
            {eventFeed.length === 0 ? (
              <div className="p-3 text-sm text-slate-500">No events in current lookback window.</div>
            ) : (
              eventFeed.map((item) => {
                const mine = !!userAddress && item.account.toLowerCase() === userAddress.toLowerCase();
                return (
                  <div key={item.id} className="p-3 text-xs font-mono space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-200">{item.type.toUpperCase()} {item.sideLabel}</span>
                      <span className="text-slate-500">blk {item.block.toString()}</span>
                    </div>
                    <div className="text-slate-400">tick: {item.tickLabel} | amount: {fmt(item.amount, 18, 4)}</div>
                    <div className={mine ? 'text-emerald-300' : 'text-slate-500'}>
                      {mine ? 'you' : shortAddress(item.account)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      {lastTx && (
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">Last Transaction</div>
          <a href={explorerUrl(chainId, 'tx', lastTx)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-slate-300 hover:text-white font-mono">
            {lastTx.slice(0, 10)}...{lastTx.slice(-8)}
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </Card>
      )}
    </div>
  );
};

export default V12Workbench;
