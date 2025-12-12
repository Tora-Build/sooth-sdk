import React from 'react';
import { VaultStats } from './VaultStats';
import { VaultMarkets } from './VaultMarkets';
import { LiquidityModelInfo } from './LiquidityModelInfo';
import { LiquidityForm } from './LiquidityForm';
import { Card } from '../../ui/Card';

export const LPDashboard: React.FC = () => {
  return (
    <div className="space-y-8">
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
