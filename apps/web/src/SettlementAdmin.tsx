import React, { useMemo } from 'react';
import type { Market } from './types';

interface SettlementAdminProps {
  markets: Market[];
  selectedMarketId: string;
  onSelectMarket: (id: string) => void;
  onBeginCooldown: (marketId: string) => void;
  onClearance: (marketId: string) => void;
}

const cardStyle: React.CSSProperties = {
  borderRadius: 16,
  border: '1px solid rgba(31,41,55,0.9)',
  background:
    'linear-gradient(135deg, rgba(15,23,42,1), rgba(15,23,42,0.98))',
  padding: 12,
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: '#6B7280',
  marginBottom: 4,
};

export const SettlementAdmin: React.FC<SettlementAdminProps> = ({
  markets,
  selectedMarketId,
  onSelectMarket,
  onBeginCooldown,
  onClearance,
}) => {
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

  const statusColor = statusColorMap[selected.status];
  const canCooldown = selected.status === 'trading';
  const canClear = selected.status === 'clearing' && selected.adjudicatorProofUploaded;

  const handleCooldown = () => onBeginCooldown(selected.id);
  const handleClear = () => onClearance(selected.id);

  return (
    <div style={cardStyle}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 8,
        }}
      >
        <div>
          <div style={labelStyle}>Guardian console</div>
          <select
            value={selected.id}
            onChange={(e) => onSelectMarket(e.target.value)}
            style={{
              backgroundColor: '#020617',
              borderRadius: 10,
              border: '1px solid rgba(55,65,81,0.9)',
              padding: '6px 9px',
              fontSize: 13,
              color: '#E5E7EB',
              minWidth: 220,
            }}
          >
            {markets.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div
          style={{
            minWidth: 200,
            textAlign: 'right',
            fontSize: 11,
            color: '#9CA3AF',
          }}
        >
          <div>
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
              {selected.status.toUpperCase()}
            </span>
          </div>
          <div style={{ marginTop: 4 }}>
            Adjudicator ID: {selected.adjudicatorId.slice(0, 10)}…
            {selected.adjudicatorId.slice(-4)}
          </div>
          <div>
            Event ID: {selected.eventId.slice(0, 10)}…
            {selected.eventId.slice(-4)}
          </div>
        </div>
      </div>

      {/* Settlement controls */}
      <div
        style={{
          marginTop: 12,
          borderRadius: 14,
          border: '1px solid rgba(55,65,81,0.7)',
          padding: 10,
          background: 'rgba(10,16,32,0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ fontSize: 11, color: '#9CA3AF', maxWidth: 520 }}>
          Cooldown locks the market. Adjudicator posts retroactive finality, then guardian opens settlement. Adjudicator uploads PnL, and clearance burns YES/NO and releases liquidity.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={handleCooldown}
            style={{
              borderRadius: 999,
              border: 'none',
              padding: '7px 18px',
              fontSize: 12,
              cursor: canCooldown ? 'pointer' : 'not-allowed',
              background: canCooldown ? '#22C55E' : 'rgba(55,65,81,0.7)',
              color: '#0B1120',
              fontWeight: 600,
              opacity: canCooldown ? 1 : 0.6,
            }}
            disabled={!canCooldown}
          >
            Begin cooldown
          </button>
          <button
            onClick={handleClear}
            style={{
              borderRadius: 999,
              border: 'none',
              padding: '7px 18px',
              fontSize: 12,
              cursor: canClear ? 'pointer' : 'not-allowed',
              background: canClear ? '#3B82F6' : 'rgba(55,65,81,0.8)',
              color: canClear ? '#0B1120' : '#9CA3AF',
              fontWeight: 600,
              opacity: canClear ? 1 : 0.6,
            }}
            disabled={!canClear}
          >
            Clearance
          </button>
        </div>
      </div>
    </div>
  );
};
