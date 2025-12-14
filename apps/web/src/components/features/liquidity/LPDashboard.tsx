import React from 'react';
import { useNavigationStore } from '../../../store/useNavigationStore';
import { VaultStats } from './VaultStats';
import { VaultMarkets } from './VaultMarkets';
import { LiquidityModelInfo } from './LiquidityModelInfo';
import { LiquidityForm } from './LiquidityForm';

export const LPDashboard: React.FC = () => {
  const { setView } = useNavigationStore();

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">
          Liquidity Dashboard
        </h2>
        <button
          onClick={() => setView('create-market')}
          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded shadow-lg transition-transform active:scale-95"
        >
          + Create New Market
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Stats & Info */}
        <div className="lg:col-span-7 space-y-6">
          <VaultStats />

          <LiquidityModelInfo />
        </div>

        {/* Right Column: Action Form */}
        <div className="lg:col-span-5">
          <LiquidityForm />
        </div>
      </div>

      <VaultMarkets />
    </div>
  );
};
