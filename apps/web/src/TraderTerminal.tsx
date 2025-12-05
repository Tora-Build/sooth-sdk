import React, { useMemo, useState } from 'react';
import type { Market } from './types';

interface TraderTerminalProps {
  markets: Market[];
  selectedMarketId: string;
  onSelectMarket: (id: string) => void;
  onSimulateTrade: (opts: {
    marketId: string;
    side: 'YES' | 'NO';
    direction: 'buy' | 'sell';
    shares: number;
  }) => void;
}

const cardStyle: React.CSSProperties = {
  borderRadius: 16,
  border: '1px solid rgba(31,41,55,0.9)',
  background:
    'radial-gradient(circle at top left, rgba(15,23,42,1), rgba(15,23,42,0.96))',
  padding: 12,
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: '#6B7280',
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  backgroundColor: '#020617',
  borderRadius: 10,
  border: '1px solid rgba(55,65,81,0.9)',
  padding: '8px 10px',
  fontSize: 13,
  color: '#E5E7EB',
  width: '100%',
};

const pillStyle: React.CSSProperties = {
  borderRadius: 999,
  padding: '4px 8px',
  fontSize: 11,
  border: '1px solid rgba(55,65,81,0.9)',
  background: 'rgba(15,23,42,0.9)',
};

const priceBox: React.CSSProperties = {
  borderRadius: 12,
  padding: '8px 10px',
  border: '1px solid rgba(31,41,55,0.9)',
  background: 'rgba(15,23,42,0.9)',
  fontSize: 13,
};

export const TraderTerminal: React.FC<TraderTerminalProps> = ({
  markets,
  selectedMarketId,
  onSelectMarket,
  onSimulateTrade,
}) => {
  const [side, setSide] = useState<'YES' | 'NO'>('YES');
  const [direction, setDirection] = useState<'buy' | 'sell'>('buy');
  const [sharesInput, setSharesInput] = useState<string>('10');

  const selected = useMemo(
    () => markets.find((m) => m.id === selectedMarketId) ?? markets[0],
    [markets, selectedMarketId],
  );

  const statusColorMap: Record<Market['status'], string> = {
    trading: '#22C55E',
    cooldown: '#F97316',
    settling: '#A855F7',
    clearing: '#38BDF8',
    settled: '#9CA3AF',
  };

  const statusLabelMap: Record<Market['status'], string> = {
    trading: 'Trading',
    cooldown: 'Cooldown',
    settling: 'Settling',
    clearing: 'Clearing',
    settled: 'Settled',
  };

  const shares = useMemo(() => {
    const v = parseFloat(sharesInput);
    return Number.isFinite(v) && v > 0 ? v : 0;
  }, [sharesInput]);

  const activePrice = side === 'YES' ? selected.priceYes : selected.priceNo;
  const estNotional = shares * activePrice;

  const userExposure = useMemo(() => {
    const yesValue = selected.userYesShares * selected.priceYes;
    const noValue = selected.userNoShares * selected.priceNo;
    return yesValue + noValue;
  }, [selected]);

  const impliedProbability = (selected.priceYes * 100).toFixed(1);

  const hasInventory =
    side === 'YES' ? selected.userYesShares > 0 : selected.userNoShares > 0;
  const canSubmit =
    shares > 0 && (direction !== 'sell' || hasInventory) && selected.status === 'trading';

  const bearishCombo =
    (direction === 'sell' && side === 'YES') ||
    (direction === 'buy' && side === 'NO');

  const actionColors = bearishCombo
    ? {
        bg: 'linear-gradient(135deg, rgba(248,113,113,0.9), rgba(239,68,68,0.9))',
        text: '#0B1120',
      }
    : {
        bg: 'linear-gradient(135deg, rgba(34,197,94,0.8), rgba(16,185,129,0.85))',
        text: '#0B1120',
      };

  const handleSubmit = () => {
    if (!shares) return;
    onSimulateTrade({
      marketId: selected.id,
      side,
      direction,
      shares,
    });
  };

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          marginBottom: 10,
        }}
      >
        <div>
          <div style={labelStyle}>Market</div>
          <select
            value={selected.id}
            onChange={(e) => onSelectMarket(e.target.value)}
            style={{
              ...inputStyle,
              maxWidth: 420,
            }}
          >
            {markets.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <div
            style={{
              marginTop: 4,
              fontSize: 11,
              color: '#9CA3AF',
              maxWidth: 420,
            }}
          >
            {selected.question}
          </div>
        </div>
        <div
          style={{
            minWidth: 160,
            textAlign: 'right',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            alignItems: 'flex-end',
          }}
        >
          <div style={pillStyle}>{selected.adjudicatorLabel}</div>
          <div style={{ fontSize: 11, color: '#9CA3AF' }}>
            Status:{' '}
            <span
              style={{
                borderRadius: 999,
                border: `1px solid ${statusColorMap[selected.status]}`,
                padding: '2px 8px',
                color: statusColorMap[selected.status],
                fontWeight: 600,
              }}
            >
              {statusLabelMap[selected.status]}
            </span>
          </div>
          <div style={{ fontSize: 11, color: '#9CA3AF' }}>
            Implied YES: {impliedProbability}%
          </div>
          <div style={{ fontSize: 11, color: '#9CA3AF' }}>
            Pooled YES value: {((selected.userYesShares + selected.virtualYesStake) * selected.priceYes).toFixed(2)}
          </div>
          <div style={{ fontSize: 11, color: '#9CA3AF' }}>
            Pooled NO value: {((selected.userNoShares + selected.virtualNoStake) * selected.priceNo).toFixed(2)}
          </div>
          <div style={{ fontSize: 11, color: '#9CA3AF' }}>
            Contract: {selected.contractAddress.slice(0, 8)}…
            {selected.contractAddress.slice(-4)}
          </div>
        </div>
      </div>

      {/* Price strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.3fr 1fr',
          gap: 10,
          marginTop: 6,
          marginBottom: 10,
        }}
      >
        <div
          style={{
            borderRadius: 14,
            border: '1px solid rgba(31,41,55,0.9)',
            padding: '8px 10px',
            background:
              'linear-gradient(90deg, rgba(34,197,94,0.25), rgba(248,113,113,0.15))',
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: '#9CA3AF',
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 4,
            }}
          >
            <span>YES / NO prices</span>
            <span>USDC per share</span>
          </div>
          <div
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <div style={{ ...priceBox, flex: 1 }}>
              <div style={{ fontSize: 11, color: '#A7F3D0' }}>YES</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>
                {selected.priceYes.toFixed(3)}
              </div>
            </div>
            <div style={{ ...priceBox, flex: 1 }}>
              <div style={{ fontSize: 11, color: '#FECACA' }}>NO</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>
                {selected.priceNo.toFixed(3)}
              </div>
            </div>
          </div>
          {/* Simple probability bar */}
          <div
            style={{
              marginTop: 8,
              height: 6,
              borderRadius: 999,
              background: 'rgba(15,23,42,0.9)',
              overflow: 'hidden',
              display: 'flex',
            }}
          >
            <div
              style={{
                width: `${selected.priceYes * 100}%`,
                background:
                  'linear-gradient(90deg, rgba(34,197,94,0.9), rgba(16,185,129,0.9))',
              }}
            />
            <div
              style={{
                flex: 1,
                background:
                  'linear-gradient(90deg, rgba(248,113,113,0.9), rgba(239,68,68,0.9))',
              }}
            />
          </div>
        </div>

        {/* Position summary */}
        <div
          style={{
            borderRadius: 14,
            border: '1px solid rgba(31,41,55,0.9)',
            padding: '8px 10px',
            background: 'rgba(15,23,42,0.9)',
          }}
        >
          <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>
            Your simulated exposure
          </div>
          <div style={{ fontSize: 12, color: '#E5E7EB' }}>
            YES: {selected.userYesShares.toFixed(2)} · NO:{' '}
            {selected.userNoShares.toFixed(2)}
          </div>
          <div
            style={{
              fontSize: 11,
              color: '#9CA3AF',
              marginTop: 4,
            }}
          >
            Notional at current prices: {userExposure.toFixed(2)} USDC
          </div>
        </div>
      </div>

      {/* Order ticket */}
      <div
        style={{
          marginTop: 4,
          borderRadius: 14,
          border: '1px solid rgba(31,41,55,0.9)',
          padding: 10,
          background:
            'linear-gradient(135deg, rgba(15,23,42,0.98), rgba(15,23,42,0.94))',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 10,
          }}
        >
          <div>
            <label style={labelStyle}>Shares</label>
            <input
              style={inputStyle}
              value={sharesInput}
              onChange={(e) => setSharesInput(e.target.value)}
              placeholder="10.0"
            />
          </div>
          <div>
            <label style={labelStyle}>Outcome</label>
            <div
              style={{
                display: 'flex',
                gap: 6,
                backgroundColor: '#020617',
                borderRadius: 999,
                padding: 3,
                border: '1px solid rgba(55,65,81,1)',
              }}
            >
              {(['YES', 'NO'] as const).map((o) => {
                const active = side === o;
                return (
                  <button
                    key={o}
                    onClick={() => setSide(o)}
                    style={{
                      flex: 1,
                      borderRadius: 999,
                      border: 'none',
                      padding: '6px 0',
                      fontSize: 12,
                      cursor: 'pointer',
                      background: active ? actionColors.bg : 'transparent',
                      color: active ? actionColors.text : '#9CA3AF',
                      fontWeight: 500,
                    }}
                  >
                    {o}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Direction</label>
            <div
              style={{
                display: 'flex',
                gap: 6,
                backgroundColor: '#020617',
                borderRadius: 999,
                padding: 3,
                border: '1px solid rgba(55,65,81,1)',
              }}
            >
              {(['buy', 'sell'] as const).map((d) => {
                const active = direction === d;
                return (
                  <button
                    key={d}
                    onClick={() => setDirection(d)}
                    style={{
                      flex: 1,
                      borderRadius: 999,
                      border: 'none',
                      padding: '6px 0',
                      fontSize: 12,
                      cursor: 'pointer',
                      background: active ? actionColors.bg : 'transparent',
                      color: active ? actionColors.text : '#9CA3AF',
                      fontWeight: 500,
                    }}
                  >
                    {d.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Summary row */}
        <div
          style={{
            marginTop: 10,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ fontSize: 12, color: '#9CA3AF' }}>
            Est. notional:{' '}
            <span style={{ color: '#E5E7EB' }}>
              {estNotional.toFixed(2)} USDC
            </span>
            <span style={{ marginLeft: 8, opacity: 0.7 }}>
              @ {activePrice.toFixed(3)} USDC
            </span>
          </div>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              borderRadius: 999,
              border: 'none',
              padding: '8px 16px',
              fontSize: 13,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              background: canSubmit ? actionColors.bg : 'rgba(55,65,81,0.8)',
              color: canSubmit ? actionColors.text : '#9CA3AF',
              fontWeight: 600,
              opacity: canSubmit ? 1 : 0.6,
            }}
          >
            {direction.toUpperCase()} {side}
          </button>
        </div>
      </div>
    </div>
  );
};
