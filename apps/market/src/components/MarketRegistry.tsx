import React, { useState, useMemo } from 'react';
import { useLaunchpadMarkets } from '../hooks/indexer/useLaunchpadMarkets';
import { LaunchpadMarket, getMarketStatus, MarketStatus } from '../types';
import { getAddressUrl } from '../config/chains';

interface MarketRegistryProps {
  onTrade?: (market: LaunchpadMarket) => void;
}

function formatDeposit(depositStr: string): string {
  try {
    let val = depositStr;
    if (depositStr.startsWith('0x')) {
      val = BigInt(depositStr).toString();
    }
    let num = parseFloat(val) / 1e6;
    if (num > 1e9) num = num / 1e12;
    return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } catch {
    return depositStr;
  }
}

function timeAgo(ts: number): string {
  if (!ts) return '-';
  const diffMs = Date.now() - ts * 1000;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function shortAddr(addr: string): string {
  if (!addr) return '';
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

function renderBadge(status: MarketStatus) {
  if (status === 'live') {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold font-mono uppercase tracking-wider border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        Live
      </div>
    );
  }
  if (status === 'settled' || status === 'dismissed') {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold font-mono uppercase tracking-wider border bg-zinc-500/10 text-zinc-400 border-zinc-500/20">
        <div className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
        {status}
      </div>
    );
  }
  if (status === 'finalized') {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold font-mono uppercase tracking-wider border bg-blue-500/10 text-blue-400 border-blue-500/20">
        <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
        Finalized
      </div>
    );
  }
  return null;
}

type SortCol = 'status' | 'deposit' | 'created' | null;
type SortDir = 'asc' | 'desc';

export function MarketRegistry({ onTrade }: MarketRegistryProps) {
  const { markets, chainErrors, isLoading, isError, refetch } = useLaunchpadMarkets();

  const [search, setSearch] = useState('');
  const [filterPill, setFilterPill] = useState<'all' | MarketStatus>('all');
  const [sortCol, setSortCol] = useState<SortCol>(null);
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expandedAddress, setExpandedAddress] = useState<string | null>(null);

  const handleSort = (col: SortCol) => {
    if (sortCol === col) {
      if (sortDir === 'desc') setSortDir('asc');
      else setSortCol(null);
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  };

  const counts = useMemo(() => {
    let live = 0, settled = 0, finalized = 0, dismissed = 0;
    markets.forEach((m) => {
      const s = getMarketStatus(m);
      if (s === 'live') live++;
      if (s === 'settled') settled++;
      if (s === 'finalized') finalized++;
      if (s === 'dismissed') dismissed++;
    });
    return { all: markets.length, live, settled, finalized, dismissed };
  }, [markets]);

  const filteredAndSorted = useMemo(() => {
    let result = [...markets];

    if (filterPill !== 'all') {
      result = result.filter((m) => getMarketStatus(m) === filterPill);
    }

    if (search.trim()) {
      const lower = search.toLowerCase();
      result = result.filter(
        (m) =>
          (m.question || m.name || '').toLowerCase().includes(lower) ||
          m.address.toLowerCase().includes(lower) ||
          m.creator.toLowerCase().includes(lower)
      );
    }

    if (sortCol) {
      result.sort((a, b) => {
        let valA: any = 0;
        let valB: any = 0;

        if (sortCol === 'status') {
          const map = { live: 0, settled: 1, finalized: 2, dismissed: 3 };
          valA = map[getMarketStatus(a)];
          valB = map[getMarketStatus(b)];
        } else if (sortCol === 'deposit') {
          const parseDep = (d: string) => parseFloat(d.startsWith('0x') ? BigInt(d).toString() : d);
          valA = parseDep(a.deposit || '0');
          valB = parseDep(b.deposit || '0');
        } else if (sortCol === 'created') {
          valA = parseFloat(a.createdAt as string || '0');
          valB = parseFloat(b.createdAt as string || '0');
        }

        if (valA < valB) return sortDir === 'asc' ? -1 : 1;
        if (valA > valB) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [markets, filterPill, search, sortCol, sortDir]);

  const getSortIcon = (col: SortCol) => {
    if (sortCol !== col) return '↕';
    return sortDir === 'desc' ? '▼' : '▲';
  };

  const colClass = (col: SortCol) => {
    return `px-4 py-4 font-medium cursor-pointer transition-colors whitespace-nowrap ${
      sortCol === col ? 'text-amber-400' : 'hover:text-amber-400 text-zinc-400'
    }`;
  };

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-red-950/10 border border-red-900/20 rounded-xl">
        <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
          <span className="text-red-400 text-xl">⚠</span>
        </div>
        <h3 className="text-zinc-100 font-medium mb-2">Connection Error</h3>
        <p className="text-zinc-400 text-sm mb-6 max-w-md text-center">Failed to load market data from the indexer. Please check your connection and try again.</p>
        <button
          onClick={() => refetch()}
          className="px-6 py-2 bg-zinc-900 hover:bg-zinc-800 text-amber-400 border border-amber-500/30 hover:border-amber-500/50 rounded-lg transition-all font-medium text-sm"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="glass-panel overflow-hidden border border-white/5 rounded-xl flex flex-col w-full shadow-lg bg-zinc-950/40 backdrop-blur-md">
      
      {/* Panel header bar */}
      <div className="px-6 py-5 border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-950/50">
        <div className="flex flex-wrap items-center gap-3 sm:gap-6 w-full sm:w-auto">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-amber-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
            <h2 className="text-lg font-medium tracking-tight text-zinc-100 whitespace-nowrap">Market Instance Directory</h2>
          </div>
          <div className="relative w-full sm:w-64 max-w-sm">
            <input
              type="text"
              placeholder="Search address, creator, question..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-zinc-900/50 border border-zinc-800/80 text-zinc-200 rounded-lg pl-3 pr-8 py-1.5 text-sm focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all placeholder:text-zinc-600"
            />
            {search && (
              <button 
                onClick={() => setSearch('')} 
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors w-4 h-4 flex items-center justify-center rounded-full hover:bg-zinc-800"
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-[10px] text-zinc-500 font-mono border border-zinc-800/80 bg-zinc-900/50 px-2.5 py-1 rounded shadow-inner">
            PROTOCOL_V12.0
          </div>
          <div className="text-[10px] text-zinc-400 font-mono border border-zinc-800/80 bg-zinc-900/50 px-2.5 py-1 rounded flex items-center gap-2 shadow-inner">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            LIVE SYNC
          </div>
        </div>
      </div>

      {/* Filter pills bar */}
      <div className="px-6 py-3 border-b border-white/5 flex flex-wrap items-center gap-2 bg-zinc-950/30">
        {[
          { id: 'all', label: 'All', count: counts.all },
          { id: 'live', label: 'Live', count: counts.live },
          { id: 'settled', label: 'Settled', count: counts.settled },
          { id: 'finalized', label: 'Finalized', count: counts.finalized },
          { id: 'dismissed', label: 'Dismissed', count: counts.dismissed },
        ].map((pill) => {
          const isActive = filterPill === pill.id;
          return (
            <button
              key={pill.id}
              onClick={() => setFilterPill(pill.id as 'all' | MarketStatus)}
              className={`whitespace-nowrap px-3.5 py-1.5 rounded-full border text-[13px] transition-all font-medium flex items-center gap-1.5 ${
                isActive
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
                  : 'border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 hover:border-zinc-700 bg-transparent'
              }`}
            >
              {pill.label} <span className={`text-[11px] font-mono px-1.5 rounded-full ${isActive ? 'bg-amber-500/20 text-amber-300' : 'bg-zinc-800 text-zinc-500'}`}>{pill.count}</span>
            </button>
          );
        })}
      </div>

      <div className="w-full overflow-hidden">
        {/* Desktop Table (md+) */}
        <div className="hidden md:block overflow-x-auto min-h-[400px]">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-zinc-950/90 backdrop-blur-md z-10 border-b border-zinc-800/50 text-[11px] uppercase tracking-wider font-mono">
              <tr>
                <th className="px-6 py-4 font-medium text-zinc-500 whitespace-nowrap">Network</th>
                <th className="px-4 py-4 font-medium text-zinc-500">Market Address</th>
                <th className="px-4 py-4 font-medium text-zinc-500">Question</th>
                <th className="px-4 py-4 font-medium text-zinc-500">Creator</th>
                <th className={colClass('status')} onClick={() => handleSort('status')}>
                  <div className="flex items-center gap-1 group">
                    Status <span className={`opacity-50 transition-opacity ${sortCol === 'status' ? 'opacity-100 text-amber-500' : 'group-hover:opacity-100 group-hover:text-zinc-300'}`}>{getSortIcon('status')}</span>
                  </div>
                </th>
                <th className={`${colClass('deposit')} text-right`} onClick={() => handleSort('deposit')}>
                  <div className="flex items-center justify-end gap-1 group">
                    Deposit <span className={`opacity-50 transition-opacity ${sortCol === 'deposit' ? 'opacity-100 text-amber-500' : 'group-hover:opacity-100 group-hover:text-zinc-300'}`}>{getSortIcon('deposit')}</span>
                  </div>
                </th>
                <th className={`${colClass('created')} text-right`} onClick={() => handleSort('created')}>
                  <div className="flex items-center justify-end gap-1 group">
                    Created <span className={`opacity-50 transition-opacity ${sortCol === 'created' ? 'opacity-100 text-amber-500' : 'group-hover:opacity-100 group-hover:text-zinc-300'}`}>{getSortIcon('created')}</span>
                  </div>
                </th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/30 text-sm">
              {isLoading ? (
                Array.from({ length: 7 }).map((_, i) => (
                  <tr key={i} className="hover:bg-zinc-800/10">
                    <td className="px-6 py-4"><div className="h-4 bg-zinc-800/50 animate-pulse rounded w-20"></div></td>
                    <td className="px-4 py-4"><div className="h-4 bg-zinc-800/50 animate-pulse rounded w-24"></div></td>
                    <td className="px-4 py-4"><div className="h-4 bg-zinc-800/50 animate-pulse rounded w-48"></div></td>
                    <td className="px-4 py-4"><div className="h-4 bg-zinc-800/50 animate-pulse rounded w-24"></div></td>
                    <td className="px-4 py-4"><div className="h-6 bg-zinc-800/50 animate-pulse rounded-full w-20"></div></td>
                    <td className="px-4 py-4"><div className="h-4 bg-zinc-800/50 animate-pulse rounded w-16 ml-auto"></div></td>
                    <td className="px-4 py-4"><div className="h-4 bg-zinc-800/50 animate-pulse rounded w-16 ml-auto"></div></td>
                    <td className="px-6 py-4"></td>
                  </tr>
                ))
              ) : filteredAndSorted.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-24 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-full border border-white/5 bg-zinc-900/50 flex items-center justify-center shadow-inner">
                        <div className="w-5 h-5 rounded-sm border border-zinc-700/50 bg-zinc-800/50" />
                      </div>
                      <div className="text-zinc-300 font-medium tracking-tight">No markets found</div>
                      <div className="text-zinc-500 text-sm">Try adjusting your filters or search criteria.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAndSorted.map((m) => {
                  const status = getMarketStatus(m);
                  const isExpanded = expandedAddress === m.address;
                  const isMonad = m.network?.includes('Monad');
                  const netColor = isMonad ? 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.4)]' : 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]';
                  const netText = isMonad ? 'text-purple-400' : 'text-blue-400';

                  return (
                    <React.Fragment key={m.address}>
                      <tr
                        className={`hover:bg-zinc-800/30 cursor-pointer group transition-all duration-200 ${isExpanded ? 'bg-zinc-800/20' : ''}`}
                        onClick={() => {
                          if (status === 'live' && onTrade) {
                            onTrade(m);
                          } else {
                            setExpandedAddress(isExpanded ? null : m.address);
                          }
                        }}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full ${netColor}`} />
                            <span className={`text-[12px] font-medium ${netText}`}>{m.network ?? 'Base Sepolia'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 font-mono text-zinc-300 text-[13px] whitespace-nowrap">
                          <a
                            href={getAddressUrl(m.address)}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-amber-400 hover:underline transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {shortAddr(m.address)}
                          </a>
                        </td>
                        <td className="px-4 py-4 text-zinc-200 font-medium">
                          <div className="max-w-[280px] lg:max-w-md truncate" title={m.question || m.name}>
                            {m.question || m.name || 'Unnamed Market'}
                          </div>
                        </td>
                        <td className="px-4 py-4 font-mono text-zinc-400 text-[13px] whitespace-nowrap">
                          <a
                            href={getAddressUrl(m.creator)}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-amber-400 hover:underline transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {shortAddr(m.creator)}
                          </a>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">{renderBadge(status)}</td>
                        <td className="px-4 py-4 font-mono text-right text-zinc-300 whitespace-nowrap">
                          {formatDeposit(m.deposit || '0')}
                        </td>
                        <td className="px-4 py-4 text-right text-zinc-500 whitespace-nowrap font-mono text-[13px]">
                          {m.createdAt ? timeAgo(parseFloat(m.createdAt as string)) : '-'}
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap w-24">
                          {status === 'live' ? (
                            <span className="text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity font-bold text-[11px] uppercase tracking-wider flex items-center justify-end gap-1">
                              Trade <span className="text-lg leading-none">→</span>
                            </span>
                          ) : (
                            <span className="text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity font-medium text-[11px] uppercase tracking-wider">
                              {isExpanded ? 'Hide' : 'Details'}
                            </span>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-zinc-900/50 border-t-0 shadow-inner">
                          <td colSpan={8} className="p-0">
                            <div className="px-8 py-5 flex items-start gap-12 border-l-2 border-amber-500/50 mx-6 my-2 bg-zinc-950/30 rounded-r-lg">
                              <div className="flex flex-col gap-1.5">
                                <div className="text-zinc-500 font-mono text-[10px] uppercase tracking-widest">Contract Address</div>
                                <a
                                  href={getAddressUrl(m.address)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-mono text-[13px] text-zinc-300 hover:text-amber-400 transition-colors flex items-center gap-1.5"
                                >
                                  {m.address} <span className="text-[10px]">↗</span>
                                </a>
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <div className="text-zinc-500 font-mono text-[10px] uppercase tracking-widest">Creator</div>
                                <a
                                  href={getAddressUrl(m.creator)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-mono text-[13px] text-zinc-300 hover:text-amber-400 transition-colors flex items-center gap-1.5"
                                >
                                  {m.creator} <span className="text-[10px]">↗</span>
                                </a>
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <div className="text-zinc-500 font-mono text-[10px] uppercase tracking-widest">Creation Date</div>
                                <div className="font-mono text-[13px] text-zinc-300">
                                  {m.createdAt ? new Date(parseFloat(m.createdAt as string) * 1000).toLocaleString() : '-'}
                                </div>
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <div className="text-zinc-500 font-mono text-[10px] uppercase tracking-widest">Initial Deposit</div>
                                <div className="font-mono text-[13px] text-zinc-100 bg-zinc-800/50 px-2 py-0.5 rounded border border-zinc-700/50 inline-block">
                                  {formatDeposit(m.deposit || '0')} <span className="text-zinc-500">USDC</span>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Card View (Mobile) */}
        <div className="md:hidden flex flex-col divide-y divide-zinc-800/30">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-5 flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <div className="h-4 bg-zinc-800/50 animate-pulse rounded w-20"></div>
                  <div className="h-6 bg-zinc-800/50 animate-pulse rounded-full w-16"></div>
                </div>
                <div className="h-5 bg-zinc-800/50 animate-pulse rounded w-3/4"></div>
                <div className="flex justify-between items-center mt-2">
                  <div className="h-4 bg-zinc-800/50 animate-pulse rounded w-24"></div>
                  <div className="h-4 bg-zinc-800/50 animate-pulse rounded w-16"></div>
                </div>
              </div>
            ))
          ) : filteredAndSorted.length === 0 ? (
            <div className="py-16 px-6 text-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full border border-white/5 bg-zinc-900/50 flex items-center justify-center">
                  <div className="w-5 h-5 rounded-sm border border-zinc-700/50 bg-zinc-800/50" />
                </div>
                <div className="text-zinc-300 font-medium tracking-tight">No markets found</div>
                <div className="text-zinc-500 text-sm">Try adjusting your filters or search criteria.</div>
              </div>
            </div>
          ) : (
            filteredAndSorted.map((m) => {
              const status = getMarketStatus(m);
              const isMonad = m.network?.includes('Monad');
              const netColor = isMonad ? 'bg-purple-500' : 'bg-blue-500';
              const netText = isMonad ? 'text-purple-400' : 'text-blue-400';

              return (
                <div
                  key={m.address}
                  className="p-5 flex flex-col gap-3.5 hover:bg-zinc-800/20 active:bg-zinc-800/30 transition-colors cursor-pointer"
                  onClick={() => {
                    if (status === 'live' && onTrade) {
                      onTrade(m);
                    } else {
                      setExpandedAddress(expandedAddress === m.address ? null : m.address);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${netColor} shadow-sm`} />
                        <span className={`text-[11px] font-medium uppercase tracking-wider ${netText}`}>{m.network ?? 'Base Sepolia'}</span>
                      </div>
                      <span className="text-[15px] font-medium text-zinc-100 leading-snug line-clamp-2">
                        {m.question || m.name || 'Unnamed Market'}
                      </span>
                    </div>
                    <div className="shrink-0 pt-1">{renderBadge(status)}</div>
                  </div>
                  
                  <div className="flex items-center justify-between text-[13px] pt-2 border-t border-zinc-800/50 mt-1">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 font-mono text-zinc-500">
                        <span className="text-[10px] uppercase tracking-wider">BY</span>
                        <span className="text-zinc-400">{shortAddr(m.creator)}</span>
                      </div>
                      <div className="text-zinc-500 font-mono text-xs">
                        {m.createdAt ? timeAgo(parseFloat(m.createdAt as string)) : '-'}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-mono text-zinc-100 font-medium">
                        {formatDeposit(m.deposit || '0')}
                      </span>
                      {status === 'live' && (
                        <span className="text-amber-500 font-bold text-[10px] uppercase tracking-wider mt-1">
                          Trade →
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {expandedAddress === m.address && (
                    <div className="mt-3 pt-3 border-t border-zinc-800/50 flex flex-col gap-2.5 text-xs bg-zinc-950/30 p-3 rounded-lg border-l-2 border-l-amber-500/50">
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500 font-mono text-[10px] uppercase tracking-wider">Address</span>
                        <a href={getAddressUrl(m.address)} target="_blank" rel="noreferrer" className="font-mono text-amber-400" onClick={e => e.stopPropagation()}>
                          {shortAddr(m.address)} ↗
                        </a>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500 font-mono text-[10px] uppercase tracking-wider">Full Date</span>
                        <span className="text-zinc-300 font-mono">
                          {m.createdAt ? new Date(parseFloat(m.createdAt as string) * 1000).toLocaleString() : '-'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {Object.entries(chainErrors || {}).length > 0 && (
        <div className="border-t border-white/5 bg-zinc-950/50">
          {Object.entries(chainErrors).map(([chain, err]) => (
            <div key={chain} className="px-6 py-3 bg-red-950/20 border-t border-red-900/20 flex items-center gap-3 text-xs font-mono">
              <span className="text-red-400">⚠ {chain}</span>
              <span className="text-zinc-400 truncate">{String(err)}</span>
              <button onClick={() => refetch()} className="ml-auto text-amber-400 border border-amber-500/30 hover:bg-amber-500/10 px-2 py-0.5 rounded text-[10px] uppercase transition-colors shrink-0">
                Retry
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
