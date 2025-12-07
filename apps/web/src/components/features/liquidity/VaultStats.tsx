import React from 'react';
import { Card } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { useVault } from '../../../hooks/useVault';
import { useMarketStore } from '../../../store/useMarketStore';
import { useChainStore } from '../../../store/useChainStore';
import { allowedChains } from '../../../lib/chains';
import { formatUnits } from 'viem';

const VAULT_TYPES = {
  A: {
    key: 'A',
    title: 'Optimistic (UMA / Reality-style)',
    description: 'Dispute-based resolution system.',
  },
  B: {
    key: 'B',
    title: 'ZK Rule (pure on-chain logic)',
    description: 'Fully on-chain verification using zero-knowledge proofs.',
  },
  C: {
    key: 'C',
    title: 'Oracle + ZK enhancement',
    description: 'Oracle data enhanced with ZK proofs for additional security.',
  },
  D: {
    key: 'D',
    title: 'Attestation-based',
    description: 'Trust-based verification system.',
  },
} as const;

export const VaultStats: React.FC = () => {
  const { totalAssets, totalLocked, sharePrice, apy, isLoading } = useVault();
  const { mode } = useMarketStore();
  const { selectedChainId } = useChainStore();

  const chainLabel = allowedChains.find((c) => c.id === selectedChainId)?.displayName || 'Unknown network';

  const vaultType = (() => {
    if (mode === 'demo') {
      return {
        ...VAULT_TYPES.B,
        networkLabel: 'Demo environment',
        mapping: 'B -> Demo',
      };
    }
    if (selectedChainId === 10143) {
      return {
        ...VAULT_TYPES.D,
        networkLabel: 'Speed',
        mapping: 'D -> Speed',
      };
    }
    if (selectedChainId === 84532) {
      return {
        ...VAULT_TYPES.C,
        networkLabel: 'Based',
        mapping: 'C -> Based',
      };
    }
    return {
      ...VAULT_TYPES.A,
      networkLabel: chainLabel,
      mapping: 'A -> Optimistic (fallback)',
    };
  })();

  const formatCurrency = (val: bigint) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(parseFloat(formatUnits(val, 18)));

  return (
    <Card variant="premium" className="bg-gradient-to-br from-indigo-900/20 to-slate-900/50 border-indigo-500/20">
      <div className="flex items-start justify-between mb-6">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="font-heading font-bold text-2xl text-white">Vault Type {vaultType.key}: {vaultType.title}</h3>
          </div>
          <p className="text-slate-400 text-sm">
            {vaultType.description}
          </p>
        </div>
        <Badge variant="live" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 px-3 py-1">
          APY: {apy}%
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-indigo-500/30 transition-all duration-200 group">
          <div className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-1 group-hover:text-indigo-400 transition-colors">TVL</div>
          <div className="text-xl font-mono font-medium text-white">
            {isLoading ? '...' : formatCurrency(totalAssets)}
          </div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-indigo-500/30 transition-all duration-200 group">
          <div className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-1 group-hover:text-indigo-400 transition-colors">Share Price</div>
          <div className="text-xl font-mono font-medium text-white">
            {isLoading ? '...' : sharePrice.toFixed(4)} USDC
          </div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-indigo-500/30 transition-all duration-200 group">
          <div className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-1 group-hover:text-indigo-400 transition-colors">Idle Liquidity</div>
          <div className="text-xl font-mono font-medium text-blue-400">
            {isLoading ? '...' : formatCurrency(totalAssets - (totalLocked || 0n))}
          </div>
        </div>
      </div>
    </Card>
  );
};
