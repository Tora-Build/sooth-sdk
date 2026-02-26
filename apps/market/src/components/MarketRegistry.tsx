import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLaunchpadMarkets } from '../hooks/indexer/useLaunchpadMarkets';
import { LaunchpadMarket, getMarketStatus, MarketStatus } from '../types';
import { getAddressUrl } from '../config/chains';
import { getInstanceBySoothBook } from '../config/deployments';

import { Footer } from './Footer';
import { AboutSection } from './AboutSection';

import { EcosystemCards } from './EcosystemCards';

interface MarketRegistryProps {
  onTrade?: (market: LaunchpadMarket) => void;
}

function formatDeposit(depositStr: string): string {
  try {
    const val = depositStr.startsWith('0x')
      ? BigInt(depositStr).toString()
      : depositStr;
    const num = parseFloat(val) / 1e18;
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
      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium font-mono uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
        <div className="w-1 h-1 rounded-full bg-emerald-500" />
        Live
      </div>
    );
  }
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium font-mono uppercase tracking-wider bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
      <div className="w-1 h-1 rounded-full bg-zinc-500" />
      {status}
    </div>
  );
}

const EmptyIcon = () => (
  <svg className="w-6 h-6 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9h6m-6 3h6m-6 3h4" />
  </svg>
);

const ErrorIcon = () => (
  <svg className="w-6 h-6 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

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
        let valA: number = 0;
        let valB: number = 0;

        if (sortCol === 'status') {
          const map: Record<string, number> = { live: 0, settled: 1, finalized: 2, dismissed: 3 };
          valA = map[getMarketStatus(a)] ?? 99;
          valB = map[getMarketStatus(b)] ?? 99;
        } else if (sortCol === 'deposit') {
          const parseDep = (d: string) => parseFloat(d.startsWith('0x') ? BigInt(d).toString() : d);
          valA = parseDep(a.deposit || '0');
          valB = parseDep(b.deposit || '0');
        } else if (sortCol === 'created') {
          valA = parseFloat((a.createdAt as string) || '0');
          valB = parseFloat((b.createdAt as string) || '0');
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
    return `px-4 py-4 cursor-pointer transition-colors whitespace-nowrap ${
      sortCol === col ? 'text-zinc-300' : 'hover:text-zinc-300 text-zinc-500'
    }`;
  };

  if (isError) {
    return (
      <div className="surface-card flex flex-col items-center justify-center p-12 bg-rose-950/10 border-rose-900/20">
        <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center mb-4">
          <ErrorIcon />
        </div>
        <h3 className="text-zinc-50 font-medium mb-2">Connection Error</h3>
        <p className="text-zinc-400 text-sm mb-6 max-w-md text-center">Failed to load market data from the indexer. Please check your connection and try again.</p>
        <button
          onClick={() => refetch()}
          className="px-5 py-2 bg-zinc-900 hover:bg-zinc-800 text-amber-400 border border-amber-400/30 hover:border-amber-400/50 rounded-xl transition-all font-medium text-sm"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="text-zinc-500 font-mono text-xs uppercase tracking-widest px-2 flex items-center gap-2 select-none">
        Markets
        <span className="text-zinc-600">{counts.all}</span>
      </div>
      <div className="surface-card rounded-3xl overflow-hidden w-full flex flex-col">
      {/* Filter pills + Search bar */}
      <div className="px-6 py-3 border-b border-white/[0.04] flex flex-wrap items-center gap-2 bg-zinc-900/20">
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
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-[13px] transition-all font-medium flex items-center gap-2 ${
                isActive
                  ? 'bg-zinc-800 text-zinc-100 border border-white/[0.1]'
                  : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
              }`}
            >
              {pill.label}
              <span className={`text-[11px] font-mono px-1 rounded-full ${isActive ? 'text-zinc-400' : 'text-zinc-600'}`}>
                {pill.count}
              </span>
            </button>
          );
        })}

        <div className="relative ml-auto w-full sm:w-72">
          <input
            type="text"
            placeholder="Search address, creator, question..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-900 border border-white/[0.06] rounded-xl px-4 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-white/[0.12] transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors w-4 h-4 flex items-center justify-center"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className="w-full overflow-hidden">
        {/* Desktop Table (md+) */}
        <div className="hidden md:block overflow-x-auto min-h-[400px]">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-zinc-950/80 backdrop-blur-md z-10 border-b border-white/[0.04] text-[11px] uppercase tracking-wider font-mono">
              <tr>
                <th className="px-6 py-4 font-normal text-zinc-500 whitespace-nowrap">Node</th>
                <th className="px-4 py-4 font-normal text-zinc-500 whitespace-nowrap">Network</th>
                <th className="px-4 py-4 font-normal text-zinc-500 whitespace-nowrap">Market Address</th>
                <th className="px-4 py-4 font-normal text-zinc-500 whitespace-nowrap">Question</th>
                <th className="px-4 py-4 font-normal text-zinc-500 whitespace-nowrap">Creator</th>
                <th className={colClass('status')} onClick={() => handleSort('status')}>
                  <div className="flex items-center gap-1.5 group">
                    Status <span className={`opacity-50 transition-opacity ${sortCol === 'status' ? 'opacity-100' : 'group-hover:opacity-100 group-hover:text-zinc-400'}`}>{getSortIcon('status')}</span>
                  </div>
                </th>
                <th className={`${colClass('deposit')} text-right`} onClick={() => handleSort('deposit')}>
                  <div className="flex items-center justify-end gap-1.5 group">
                    Deposit <span className={`opacity-50 transition-opacity ${sortCol === 'deposit' ? 'opacity-100' : 'group-hover:opacity-100 group-hover:text-zinc-400'}`}>{getSortIcon('deposit')}</span>
                  </div>
                </th>
                <th className={`${colClass('created')} text-right`} onClick={() => handleSort('created')}>
                  <div className="flex items-center justify-end gap-1.5 group">
                    Created <span className={`opacity-50 transition-opacity ${sortCol === 'created' ? 'opacity-100' : 'group-hover:opacity-100 group-hover:text-zinc-400'}`}>{getSortIcon('created')}</span>
                  </div>
                </th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] text-sm">
              {isLoading ? (
                Array.from({ length: 7 }).map((_, i) => (
                  <tr key={i} className="hover:bg-transparent">
                    <td className="px-6 py-4"><div className="skeleton h-4 w-20 rounded" /></td>
                    <td className="px-4 py-4"><div className="skeleton h-4 w-24 rounded" /></td>
                    <td className="px-4 py-4"><div className="skeleton h-4 w-48 rounded" /></td>
                    <td className="px-4 py-4"><div className="skeleton h-4 w-24 rounded" /></td>
                    <td className="px-4 py-4"><div className="skeleton h-5 w-16 rounded-full" /></td>
                    <td className="px-4 py-4 flex justify-end"><div className="skeleton h-4 w-16 rounded" /></td>
                    <td className="px-4 py-4 flex justify-end"><div className="skeleton h-4 w-16 rounded" /></td>
                    <td className="px-6 py-4"></td>
                  </tr>
                ))
              ) : filteredAndSorted.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-24 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-full border border-white/[0.06] bg-zinc-900/40 flex items-center justify-center">
                        <EmptyIcon />
                      </div>
                      <div className="text-zinc-300 font-medium tracking-tight">No markets found</div>
                      <div className="text-zinc-500 text-sm">Try adjusting your filters or search criteria.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAndSorted.map((m, index) => {
                  const status = getMarketStatus(m);
                  const isExpanded = expandedAddress === m.address;
                  const isMonad = m.network?.includes('Monad');
                  const netText = isMonad ? 'text-zinc-400' : 'text-zinc-500';
                  return (
                    <React.Fragment key={m.address}>
                      <motion.tr
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.03 }}
                        className={`hover:bg-white/[0.02] cursor-pointer group transition-colors duration-200 ${isExpanded ? 'bg-white/[0.02]' : ''}`}
                        onClick={() => {
                          if (status === 'live' && onTrade) {
                            onTrade(m);
                          } else {
                            setExpandedAddress(isExpanded ? null : m.address);
                          }
                        }}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-mono text-[10px] px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded">
                            {m.soothBookAddress ? (getInstanceBySoothBook(m.soothBookAddress)?.id ?? '—') : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`text-[12px] font-medium ${netText}`}>{m.network ?? 'Base Sepolia'}</span>
                        </td>

                        <td className="px-4 py-4 font-mono text-zinc-400 text-[13px] whitespace-nowrap">
                          <a
                            href={getAddressUrl(m.address)}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-zinc-200 hover:underline transition-colors"
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
                            className="hover:text-zinc-200 hover:underline transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {shortAddr(m.creator)}
                          </a>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">{renderBadge(status)}</td>
                        <td className="px-4 py-4 font-mono tabular-nums text-right text-zinc-300 whitespace-nowrap">
                          {formatDeposit(m.deposit || '0')}
                        </td>
                        <td className="px-4 py-4 text-right text-zinc-500 whitespace-nowrap font-mono text-[13px]">
                          {m.createdAt ? timeAgo(parseFloat(m.createdAt as string)) : '-'}
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap w-24">
                          {status === 'live' ? (
                            <span className="text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity font-medium text-[11px] uppercase tracking-wider inline-flex items-center justify-end gap-1">
                              Trade <span className="text-sm leading-none">→</span>
                            </span>
                          ) : (
                            <span className="text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity font-medium text-[11px] uppercase tracking-wider">
                              {isExpanded ? 'Hide' : 'Details'}
                            </span>
                          )}
                        </td>
                      </motion.tr>
                      <AnimatePresence>
                        {isExpanded && (
                          <tr className="bg-zinc-900/40 border-l-2 border-l-amber-400/40">
                            <td colSpan={8} className="p-0">
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="flex flex-wrap gap-10 px-8 py-5">
                                  <div className="flex flex-col gap-1.5">
                                    <div className="text-zinc-500 font-mono text-[10px] uppercase tracking-wider">Contract Address</div>
                                    <a
                                      href={getAddressUrl(m.address)}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="font-mono text-[13px] text-zinc-300 hover:text-amber-400 transition-colors flex items-center gap-1.5"
                                      onClick={(e) => e.stopPropagation()}
                                      >
                                      {m.address} <span className="text-[10px]">↗</span>
                                      </a>
                                      </div>
                                      <div className="flex flex-col gap-1.5">
                                      <div className="text-zinc-500 font-mono text-[10px] uppercase tracking-wider">Creator</div>
                                      <a
                                      href={getAddressUrl(m.creator)}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="font-mono text-[13px] text-zinc-300 hover:text-amber-400 transition-colors flex items-center gap-1.5"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {m.creator} <span className="text-[10px]">↗</span>
                                    </a>
                                  </div>
                                  <div className="flex flex-col gap-1.5">
                                    <div className="text-zinc-500 font-mono text-[10px] uppercase tracking-wider">Creation Date</div>
                                    <div className="font-mono text-[13px] text-zinc-300">
                                      {m.createdAt ? new Date(parseFloat(m.createdAt as string) * 1000).toLocaleString() : '-'}
                                    </div>
                                  </div>
                                  <div className="flex flex-col gap-1.5">
                                    <div className="text-zinc-500 font-mono text-[10px] uppercase tracking-wider">Initial Deposit</div>
                                    <div className="font-mono tabular-nums text-[13px] text-zinc-100">
                                      {formatDeposit(m.deposit || '0')} <span className="text-zinc-500">USDC</span>
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            </td>
                          </tr>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Card View (Mobile) */}
        <div className="md:hidden flex flex-col divide-y divide-white/[0.04]">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-5 flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <div className="skeleton h-4 w-20 rounded"></div>
                  <div className="skeleton h-5 w-16 rounded-full"></div>
                </div>
                <div className="skeleton h-5 w-3/4 rounded"></div>
                <div className="flex justify-between items-center mt-2">
                  <div className="skeleton h-4 w-24 rounded"></div>
                  <div className="skeleton h-4 w-16 rounded"></div>
                </div>
              </div>
            ))
          ) : filteredAndSorted.length === 0 ? (
            <div className="py-16 px-6 text-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full border border-white/[0.06] bg-zinc-900/40 flex items-center justify-center">
                  <EmptyIcon />
                </div>
                <div className="text-zinc-300 font-medium tracking-tight">No markets found</div>
                <div className="text-zinc-500 text-sm">Try adjusting your filters or search criteria.</div>
              </div>
            </div>
          ) : (
            filteredAndSorted.map((m, index) => {
              const status = getMarketStatus(m);
              const isMonad = m.network?.includes('Monad');

              const netText = isMonad ? 'text-zinc-400' : 'text-zinc-500';
              return (
                <motion.div
                  key={m.address}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.03 }}
                  className="p-5 flex flex-col gap-3.5 hover:bg-white/[0.02] active:bg-white/[0.03] transition-colors cursor-pointer"
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
                        {m.soothBookAddress && (
                          <span className="font-mono text-[10px] px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded">
                            {getInstanceBySoothBook(m.soothBookAddress)?.id ?? ''}
                          </span>
                        )}
                        <span className={`text-[11px] font-medium uppercase tracking-wider ${netText}`}>{m.network ?? 'Base Sepolia'}</span>
                      </div>
                      <span className="text-[15px] font-medium text-zinc-100 leading-snug line-clamp-2">
                        {m.question || m.name || 'Unnamed Market'}
                      </span>
                    </div>
                    <div className="shrink-0 pt-1">{renderBadge(status)}</div>
                  </div>
                  
                  <div className="flex items-center justify-between text-[13px] pt-2 border-t border-white/[0.04] mt-1">
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
                      <span className="font-mono tabular-nums text-zinc-100 font-medium">
                        {formatDeposit(m.deposit || '0')}
                      </span>
                      {status === 'live' && (
                        <span className="text-amber-400 font-medium text-[10px] uppercase tracking-wider mt-1">
                          Trade →
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <AnimatePresence>
                    {expandedAddress === m.address && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 pt-3 border-t border-white/[0.04] flex flex-col gap-2.5 text-xs bg-zinc-900/40 p-3 rounded-lg border-l-2 border-l-amber-400/40">
                          <div className="flex justify-between items-center">
                            <span className="text-zinc-500 font-mono text-[10px] uppercase tracking-wider">Address</span>
                            <a href={getAddressUrl(m.address)} target="_blank" rel="noreferrer" className="font-mono text-zinc-300 hover:text-amber-400 transition-colors" onClick={e => e.stopPropagation()}>
                              {shortAddr(m.address)} ↗
                            </a>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-zinc-500 font-mono text-[10px] uppercase tracking-wider">Date</span>
                            <span className="text-zinc-300 font-mono">
                              {m.createdAt ? new Date(parseFloat(m.createdAt as string) * 1000).toLocaleString() : '-'}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      {Object.entries(chainErrors || {}).length > 0 && (
        <div className="bg-rose-950/20 border-t border-rose-900/20">
          {Object.entries(chainErrors).map(([chain, err]) => (
            <div key={chain} className="px-6 py-3 flex items-center gap-3 text-xs font-mono">
              <span className="text-rose-500">Error on {chain}</span>
              <span className="text-zinc-500 truncate">{String(err)}</span>
              <button onClick={() => refetch()} className="ml-auto text-amber-400 hover:text-amber-300 px-2 py-0.5 rounded-xl text-[10px] uppercase transition-colors shrink-0">
                Retry
              </button>
            </div>
          ))}
        </div>
      )}


    </div>
    <EcosystemCards />
    <AboutSection />
    <Footer />
    </>
  );
}
