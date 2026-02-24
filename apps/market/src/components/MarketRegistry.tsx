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
    // Auto-adjust if it's actually 18 decimals
    if (num > 1e9) {
      num = num / 1e12;
    }
    return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } catch {
    return depositStr;
  }
}

function timeAgo(ts: number): string {
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

type SortCol = 'status' | 'deposit' | 'created' | null;
type SortDir = 'asc' | 'desc';

export function MarketRegistry({ onTrade }: MarketRegistryProps) {
  const { markets, isLoading, isError, refetch } = useLaunchpadMarkets();

  const [search, setSearch] = useState('');
  const [filterPill, setFilterPill] = useState<'all' | MarketStatus>('all');
  const [sortCol, setSortCol] = useState<SortCol>(null);
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = (col: SortCol) => {
    if (sortCol === col) {
      if (sortDir === 'desc') setSortDir('asc');
      else setSortCol(null);
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  };

  const graduatedMarkets = useMemo(() => {
    return markets.filter((m) => m.isGraduated);
  }, [markets]);

  const counts = useMemo(() => {
    let trading = 0;
    let settled = 0;
    let finalized = 0;
    graduatedMarkets.forEach((m) => {
      const s = getMarketStatus(m);
      if (s === 'trading') trading++;
      if (s === 'settled') settled++;
      if (s === 'finalized') finalized++;
    });
    return { all: graduatedMarkets.length, trading, settled, finalized };
  }, [graduatedMarkets]);

  const filteredAndSorted = useMemo(() => {
    let result = graduatedMarkets;

    // Filter by pill
    if (filterPill !== 'all') {
      result = result.filter((m) => getMarketStatus(m) === filterPill);
    }

    // Search
    if (search.trim()) {
      const lower = search.toLowerCase();
      result = result.filter(
        (m) =>
          (m.question || m.name || '').toLowerCase().includes(lower) ||
          m.address.toLowerCase().includes(lower) ||
          m.creator.toLowerCase().includes(lower)
      );
    }

    // Sort
    if (sortCol) {
      result.sort((a, b) => {
        let valA: any = 0;
        let valB: any = 0;

        if (sortCol === 'status') {
          const map = { trading: 0, settled: 1, finalized: 2 };
          valA = map[getMarketStatus(a)];
          valB = map[getMarketStatus(b)];
        } else if (sortCol === 'deposit') {
          const parseDep = (d: string) => {
             let v = d.startsWith('0x') ? BigInt(d).toString() : d;
             return parseFloat(v);
          }
          valA = parseDep(a.deposit || '0');
          valB = parseDep(b.deposit || '0');
        } else if (sortCol === 'created') {
          // the api returns createdAt as string
          valA = parseFloat(a.createdAt || '0');
          valB = parseFloat(b.createdAt || '0');
        }

        if (valA < valB) return sortDir === 'asc' ? -1 : 1;
        if (valA > valB) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [graduatedMarkets, filterPill, search, sortCol, sortDir]);

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-zinc-900/50 border border-zinc-800/50 rounded-xl">
        <p className="text-rose-400 mb-4">Indexer unavailable — retry</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const renderBadge = (status: MarketStatus) => {
    if (status === 'trading') {
      return (
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
          Trading
        </div>
      );
    }
    if (status === 'settled') {
      return (
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 text-xs">
          <div className="w-1.5 h-1.5 rounded-full bg-zinc-400"></div>
          Settled
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs">
        <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
        Finalized
      </div>
    );
  };

  const getSortIcon = (col: SortCol) => {
    if (sortCol !== col) return '↕';
    return sortDir === 'desc' ? '↓' : '↑';
  };

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
          {[
            { id: 'all', label: 'All', count: counts.all },
            { id: 'trading', label: 'Trading', count: counts.trading },
            { id: 'settled', label: 'Settled', count: counts.settled },
            { id: 'finalized', label: 'Finalized', count: counts.finalized },
          ].map((pill) => {
            const isActive = filterPill === pill.id;
            return (
              <button
                key={pill.id}
                onClick={() => setFilterPill(pill.id as any)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-full border text-sm transition-colors ${
                  isActive
                    ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                    : 'border-zinc-800 text-zinc-500 hover:text-zinc-300 bg-transparent'
                }`}
              >
                {pill.label} ({pill.count})
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <input
            type="text"
            placeholder="Search markets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-lg pl-3 pr-8 py-1.5 focus:outline-none focus:border-cyan-500/50 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Glass Container */}
      <div className="glass-panel overflow-hidden">
        {/* Table View (md+) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-zinc-950/90 backdrop-blur-sm z-10 border-b border-zinc-800/50 text-xs text-zinc-400 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 font-medium">Network</th>
                <th className="px-4 py-3 font-medium">Market</th>
                <th className="px-4 py-3 font-medium">Question</th>
                <th className="px-4 py-3 font-medium">Creator</th>
                <th
                  className="px-4 py-3 font-medium cursor-pointer hover:text-zinc-200 group"
                  onClick={() => handleSort('status')}
                >
                  Status <span className="opacity-50 group-hover:opacity-100">{getSortIcon('status')}</span>
                </th>
                <th
                  className="px-4 py-3 font-medium cursor-pointer hover:text-zinc-200 group text-right"
                  onClick={() => handleSort('deposit')}
                >
                  Deposit <span className="opacity-50 group-hover:opacity-100">{getSortIcon('deposit')}</span>
                </th>
                <th
                  className="px-4 py-3 font-medium cursor-pointer hover:text-zinc-200 group text-right"
                  onClick={() => handleSort('created')}
                >
                  Created <span className="opacity-50 group-hover:opacity-100">{getSortIcon('created')}</span>
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50 text-sm">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-4"><div className="h-4 skeleton-box rounded w-8"></div></td>
                    <td className="px-4 py-4"><div className="h-4 skeleton-box rounded w-20"></div></td>
                    <td className="px-4 py-4"><div className="h-4 skeleton-box rounded w-48"></div></td>
                    <td className="px-4 py-4"><div className="h-4 skeleton-box rounded w-20"></div></td>
                    <td className="px-4 py-4"><div className="h-4 skeleton-box rounded w-16"></div></td>
                    <td className="px-4 py-4"><div className="h-4 skeleton-box rounded w-16 ml-auto"></div></td>
                    <td className="px-4 py-4"><div className="h-4 skeleton-box rounded w-16 ml-auto"></div></td>
                    <td className="px-4 py-4"></td>
                  </tr>
                ))
              ) : filteredAndSorted.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-zinc-500">
                    No graduated markets yet
                  </td>
                </tr>
              ) : (
                filteredAndSorted.map((m) => {
                  const status = getMarketStatus(m);
                  return (
                    <tr
                      key={m.address}
                      className="hover:bg-zinc-800/30 cursor-pointer group transition-colors"
                      onClick={() => {
                        if (status === 'trading' && onTrade) {
                          onTrade(m);
                        }
                      }}
                    >
                      <td className="px-4 py-3">
                        <span className="text-xs text-zinc-500">Base Sepolia</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-zinc-300">
                        <a
                          href={getAddressUrl(m.address)}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-cyan-400 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {shortAddr(m.address)}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-zinc-200">
                        <div className="max-w-xs truncate" title={m.question || m.name}>
                          {m.question || m.name || 'Unnamed Market'}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-zinc-400">
                        <a
                          href={getAddressUrl(m.creator)}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-cyan-400 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {shortAddr(m.creator)}
                        </a>
                      </td>
                      <td className="px-4 py-3">{renderBadge(status)}</td>
                      <td className="px-4 py-3 font-mono text-right text-zinc-300">
                        {formatDeposit(m.deposit || '0')}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-500 whitespace-nowrap">
                        {m.createdAt ? timeAgo(parseFloat(m.createdAt)) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right pr-6">
                        <span className="text-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          Trade →
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Card View (Mobile) */}
        <div className="md:hidden flex flex-col divide-y divide-zinc-800/50">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div className="h-5 skeleton-box rounded w-3/4"></div>
                  <div className="h-5 skeleton-box rounded w-16"></div>
                </div>
                <div className="flex justify-between items-center">
                  <div className="h-4 skeleton-box rounded w-20"></div>
                  <div className="h-4 skeleton-box rounded w-16"></div>
                </div>
              </div>
            ))
          ) : filteredAndSorted.length === 0 ? (
            <div className="p-12 text-center text-zinc-500">No graduated markets yet</div>
          ) : (
            filteredAndSorted.map((m) => {
              const status = getMarketStatus(m);
              return (
                <div
                  key={m.address}
                  className="p-4 flex flex-col gap-3 hover:bg-zinc-800/30 active:bg-zinc-800/50 transition-colors"
                  onClick={() => {
                    if (status === 'trading' && onTrade) {
                      onTrade(m);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium text-zinc-200 line-clamp-2">
                      {m.question || m.name || 'Unnamed Market'}
                    </span>
                    <div className="shrink-0">{renderBadge(status)}</div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-zinc-500">
                        by {shortAddr(m.creator)}
                      </span>
                      <span className="text-zinc-600">
                        {m.createdAt ? timeAgo(parseFloat(m.createdAt)) : '-'}
                      </span>
                    </div>
                    <span className="font-mono text-zinc-300">
                      {formatDeposit(m.deposit || '0')}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
