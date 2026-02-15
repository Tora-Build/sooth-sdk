import { useState } from 'react'
import { MARKETS } from './config'
import { useOrderBook, useMarketInfo, fmt, type OrderLevel } from './hooks'
import { RefreshCw, ExternalLink, Zap, BookOpen } from 'lucide-react'

const market = MARKETS[0]

export default function App() {
  const { data: book, isLoading, refetch } = useOrderBook(market.marketKey)
  const { data: info } = useMarketInfo(market.marketKey)

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-bold text-[#00d4aa] tracking-wider uppercase">SoothBook V12</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#00d4aa]/10 text-[#00d4aa] border border-[#00d4aa]/20 font-mono">Base Sepolia</span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold">{market.question}</h1>
            {info && (
              <div className="flex items-center gap-3 mt-2 text-sm text-[#888]">
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  info.active && !info.finalized ? 'bg-[#00d4aa]/10 text-[#00d4aa]' : 'bg-[#e01b24]/10 text-[#e01b24]'
                }`}>
                  {info.finalized ? (info.outcome === 1 ? 'YES Won' : 'NO Won') : 'Active'}
                </span>
                <span className="font-mono text-xs">TVL {(Number(info.backing) / 1e18).toFixed(2)} USDC</span>
              </div>
            )}
          </div>
          <button onClick={() => refetch()} className="p-2 text-[#555] hover:text-white transition-colors" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Price cards */}
        {book && (
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-[#00d4aa]/5 border border-[#00d4aa]/20 rounded-xl p-4 text-center">
              <div className="text-[10px] font-bold text-[#00d4aa]/50 uppercase tracking-wider mb-1">YES</div>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-[#00d4aa]">
                {book.yesPrice > 0 ? (book.yesPrice * 100).toFixed(1) : '--'}¢
              </div>
            </div>
            <div className="bg-[#e01b24]/5 border border-[#e01b24]/20 rounded-xl p-4 text-center">
              <div className="text-[10px] font-bold text-[#e01b24]/50 uppercase tracking-wider mb-1">NO</div>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-[#e01b24]">
                {book.noPrice > 0 ? (book.noPrice * 100).toFixed(1) : '--'}¢
              </div>
            </div>
          </div>
        )}

        {/* Order Book */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-[#00d4aa] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : book ? (
          <OrderBookView yesBids={book.yesBids} noBids={book.noBids} />
        ) : (
          <div className="text-center py-16 text-[#555]">Failed to load orderbook</div>
        )}

        {/* Contract info */}
        <div className="mt-6 bg-[#111113] rounded-xl border border-[#222] p-4 space-y-2 text-sm">
          <div className="text-[10px] font-bold text-[#555] uppercase tracking-wider mb-2">Contracts</div>
          <Row label="SoothBook" value="0x9a99...2aB8" href="https://sepolia.basescan.org/address/0x9a992959490578c8f171C25BC8615E9Cc1AA2aB8" />
          <Row label="YES Token" value={short(market.yesToken)} href={`https://sepolia.basescan.org/address/${market.yesToken}`} />
          <Row label="NO Token" value={short(market.noToken)} href={`https://sepolia.basescan.org/address/${market.noToken}`} />
          <Row label="Model" value="4-Atomic (buyYes, buyNo, mint, merge)" />
        </div>
      </div>
    </div>
  )
}

function OrderBookView({ yesBids, noBids }: { yesBids: OrderLevel[]; noBids: OrderLevel[] }) {
  const [hovered, setHovered] = useState<string | null>(null)
  const maxCum = [...yesBids, ...noBids].reduce((m, l) => l.cumulative > m ? l.cumulative : m, 1n)
  const rows = Math.max(yesBids.length, noBids.length, 1)
  const canMatch = yesBids[0] && noBids[0] && (yesBids[0].tick + noBids[0].tick >= 1000)
  const spread = yesBids[0] && noBids[0] ? ((1000 - yesBids[0].tick - noBids[0].tick) / 10).toFixed(1) : null

  return (
    <div className="bg-[#111113] rounded-xl border border-[#222] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#222] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[#555]" />
          <span className="text-xs font-bold text-[#888] uppercase tracking-wider">Order Book</span>
        </div>
        <div className="flex items-center gap-3">
          {canMatch && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-[#00d4aa] bg-[#00d4aa]/10 px-2 py-1 rounded-full border border-[#00d4aa]/20">
              <Zap className="w-3 h-3" /> MATCHABLE
            </span>
          )}
          {spread && <span className="text-[10px] text-[#555] font-mono">spread {spread}%</span>}
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_70px_70px_1fr] px-4 py-1.5 text-[10px] font-bold text-[#444] uppercase tracking-wider border-b border-[#1a1a1d]">
        <span>Cum.</span>
        <span className="text-right">Size</span>
        <span className="text-left pl-3">Size</span>
        <span className="text-right">Cum.</span>
      </div>

      {/* Rows */}
      {(yesBids.length === 0 && noBids.length === 0) ? (
        <div className="px-4 py-10 text-center text-sm text-[#555]">No orders yet</div>
      ) : (
        Array.from({ length: Math.min(rows, 12) }).map((_, i) => {
          const yes = yesBids[i]
          const no = noBids[i]
          return (
            <div key={i} className="grid grid-cols-[1fr_70px_70px_1fr] items-center relative">
              {/* YES depth bar */}
              {yes && (
                <div className="absolute left-0 top-0 bottom-0 pointer-events-none" style={{ width: '50%' }}>
                  <div className="absolute right-0 top-0 bottom-0 bg-[#00d4aa]/8 transition-all" style={{ width: `${Number(yes.cumulative * 100n / maxCum)}%` }} />
                </div>
              )}
              {/* NO depth bar */}
              {no && (
                <div className="absolute right-0 top-0 bottom-0 pointer-events-none" style={{ width: '50%' }}>
                  <div className="absolute left-0 top-0 bottom-0 bg-[#e01b24]/8 transition-all" style={{ width: `${Number(no.cumulative * 100n / maxCum)}%` }} />
                </div>
              )}

              {/* YES side */}
              <div
                className={`relative px-4 py-1.5 text-left font-mono text-xs transition-colors ${yes ? 'cursor-default hover:bg-[#00d4aa]/10' : ''} ${hovered === `y${i}` ? 'bg-[#00d4aa]/10' : ''}`}
                onMouseEnter={() => yes && setHovered(`y${i}`)}
                onMouseLeave={() => setHovered(null)}
              >
                {yes ? <span className="text-[#00d4aa]/40">{fmt(yes.cumulative)}</span> : null}
              </div>
              <div
                className={`relative px-2 py-1.5 text-right font-mono text-xs ${hovered === `y${i}` ? 'bg-[#00d4aa]/10' : ''}`}
                onMouseEnter={() => yes && setHovered(`y${i}`)}
                onMouseLeave={() => setHovered(null)}
              >
                {yes && (
                  <>
                    <span className="text-[#00d4aa] font-bold">{fmt(yes.amount)}</span>
                    <div className="text-[10px] text-[#00d4aa]/50">{(yes.price * 100).toFixed(1)}¢</div>
                  </>
                )}
              </div>

              {/* NO side */}
              <div
                className={`relative px-2 py-1.5 pl-3 text-left font-mono text-xs ${hovered === `n${i}` ? 'bg-[#e01b24]/10' : ''}`}
                onMouseEnter={() => no && setHovered(`n${i}`)}
                onMouseLeave={() => setHovered(null)}
              >
                {no && (
                  <>
                    <span className="text-[#e01b24] font-bold">{fmt(no.amount)}</span>
                    <div className="text-[10px] text-[#e01b24]/50">{(no.price * 100).toFixed(1)}¢</div>
                  </>
                )}
              </div>
              <div
                className={`relative px-4 py-1.5 text-right font-mono text-xs ${hovered === `n${i}` ? 'bg-[#e01b24]/10' : ''}`}
                onMouseEnter={() => no && setHovered(`n${i}`)}
                onMouseLeave={() => setHovered(null)}
              >
                {no ? <span className="text-[#e01b24]/40">{fmt(no.cumulative)}</span> : null}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

function Row({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[#888]">{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#00d4aa] font-mono flex items-center gap-1 hover:underline">
          {value} <ExternalLink className="w-3 h-3" />
        </a>
      ) : (
        <span className="text-white font-mono">{value}</span>
      )}
    </div>
  )
}

function short(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}
