import React, { useMemo } from 'react';
import type { Market, Pool } from './types';

interface LPDashboardProps {
  pools: Pool[];
  markets: Market[];
  selectedPoolId: string;
  onSelectPool: (id: string) => void;
  lpAmountInput: string;
  setLpAmountInput: (val: string) => void;
  onSimulateDeposit: (opts: { poolId: string; amount: number }) => void;
  onSimulateWithdraw: (opts: { poolId: string; amount: number }) => void;
}

const cardStyle: React.CSSProperties = {
  borderRadius: 16,
  border: '1px solid rgba(31,41,55,0.9)',
  background: 'linear-gradient(135deg, #020617, #020617)',
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

export const LPDashboard: React.FC<LPDashboardProps> = ({
  pools,
  markets,
  selectedPoolId,
  onSelectPool,
  lpAmountInput,
  setLpAmountInput,
  onSimulateDeposit,
  onSimulateWithdraw,
}) => {
  const selected = useMemo(
    () => pools.find((p) => p.id === selectedPoolId) ?? pools[0],
    [pools, selectedPoolId],
  );

  const amount = useMemo(() => {
    const v = parseFloat(lpAmountInput);
    return Number.isFinite(v) && v > 0 ? v : 0;
  }, [lpAmountInput]);

  const canWithdraw = selected.userLpBalance > 0 && amount > 0;

  const utilization = selected.tvl
    ? Math.min(100, Math.round((selected.locked / selected.tvl) * 100))
    : 0;
  const activeMarkets = useMemo(
    () =>
      markets.filter(
        (m) => m.adjudicatorKind === selected.adjudicatorKind && m.status !== 'settled',
      ).length,
    [markets, selected.adjudicatorKind],
  );

  const handleDeposit = () => {
    if (!amount) return;
    onSimulateDeposit({ poolId: selected.id, amount });
  };

  const handleWithdraw = () => {
    if (!amount) return;
    onSimulateWithdraw({ poolId: selected.id, amount });
  };

  return (
    <div style={cardStyle}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 10,
        }}
      >
        <div>
          <div style={labelStyle}>Liquidity pool</div>
          <select
            value={selected.id}
            onChange={(e) => onSelectPool(e.target.value)}
            style={{ ...inputStyle, maxWidth: 260 }}
          >
            {pools.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <div
            style={{
              marginTop: 4,
              fontSize: 11,
              color: '#9CA3AF',
              maxWidth: 260,
            }}
          >
            Token: {selected.token} · Adjudicator: {selected.label.replace(/\s*Pool$/i, '')}
          </div>
        </div>
        <div
          style={{
            minWidth: 180,
            fontSize: 11,
            color: '#9CA3AF',
            textAlign: 'right',
          }}
        >
          <div>
            Pool contract: {selected.contractAddress.slice(0, 10)}…
            {selected.contractAddress.slice(-4)}
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0,1fr))',
          gap: 10,
          marginTop: 4,
        }}
      >
        <div
          style={{
            borderRadius: 12,
            border: '1px solid rgba(31,41,55,0.9)',
            padding: '8px 10px',
            background: 'rgba(15,23,42,0.95)',
          }}
        >
          <div style={{ fontSize: 11, color: '#9CA3AF' }}>LP balance (user)</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>
            {selected.userLpBalance.toLocaleString()} {selected.token}
          </div>
          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
            Withdrawals disabled until balance &gt; 0
          </div>
        </div>
        <div
          style={{
            borderRadius: 12,
            border: '1px solid rgba(31,41,55,0.9)',
            padding: '8px 10px',
            background: 'rgba(15,23,42,0.95)',
          }}
        >
          <div style={{ fontSize: 11, color: '#9CA3AF' }}>Pool overview</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            TVL {selected.tvl.toLocaleString()} {selected.token}
          </div>
          <div style={{ fontSize: 12, color: '#E5E7EB', marginTop: 2 }}>
            Locked {selected.locked.toLocaleString()} {selected.token}
          </div>
          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
            Utilization: {utilization}% · Across {activeMarkets} markets
          </div>
          <div
            style={{
              marginTop: 6,
              height: 6,
              borderRadius: 999,
              background: 'rgba(15,23,42,1)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${utilization}%`,
                height: '100%',
                background: 'rgba(148,163,184,0.8)',
              }}
            />
          </div>
        </div>
        <div
          style={{
            borderRadius: 12,
            border: '1px solid rgba(31,41,55,0.9)',
            padding: '8px 10px',
            background: 'rgba(15,23,42,0.95)',
          }}
        >
          <div style={{ fontSize: 11, color: '#9CA3AF' }}>Indicative APY</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>
            {selected.apy.toFixed(1)}%
          </div>
          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
            Simulated fees + vault yield
          </div>
        </div>
      </div>

      {/* Controls */}
      <div
        style={{
          marginTop: 12,
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
            gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)',
            gap: 10,
            alignItems: 'center',
          }}
        >
          <div>
            <label style={labelStyle}>Amount ({selected.token})</label>
            <input
              style={inputStyle}
              value={lpAmountInput}
              onChange={(e) => setLpAmountInput(e.target.value)}
              placeholder="1000"
            />
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>
              This is a local simulation only. No real vault or token transfers.
            </div>
          </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
            <button
              onClick={handleDeposit}
              style={{
                borderRadius: 999,
                border: 'none',
                padding: '7px 12px',
                fontSize: 13,
                cursor: 'pointer',
                background:
                  'linear-gradient(135deg, rgba(34,197,94,0.85), rgba(16,185,129,0.85))',
                color: '#0B1120',
                fontWeight: 600,
              }}
            >
              Deposit
            </button>
            <button
              onClick={handleWithdraw}
              style={{
                borderRadius: 999,
                border: '1px solid rgba(75,85,99,1)',
                padding: '7px 12px',
                fontSize: 13,
                cursor: canWithdraw ? 'pointer' : 'not-allowed',
                background: canWithdraw ? 'transparent' : 'rgba(55,65,81,0.6)',
                color: canWithdraw ? '#E5E7EB' : '#9CA3AF',
                borderColor: canWithdraw ? 'rgba(75,85,99,1)' : 'rgba(75,85,99,0.2)',
                fontWeight: 500,
              }}
              disabled={!canWithdraw}
            >
              Withdraw
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
