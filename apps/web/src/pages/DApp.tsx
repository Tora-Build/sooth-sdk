import React, { useState } from 'react';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { TabsRoot, TabsListImpl, TabsTriggerImpl, TabsContent } from '../components/ui/Tabs';
import { TraderTerminal } from '../components/features/TraderTerminal';
import { LPDashboard } from '../components/features/liquidity/LPDashboard';
import { OperatorConsole } from '../components/features/OperatorConsole';
import { ActivityLog } from '../components/features/ActivityLog';

import { GlobalStats } from '../components/features/GlobalStats';
import { PortfolioSummary } from '../components/features/PortfolioSummary';
import { TradingAccountCard } from '../components/features/TradingAccountCard';

interface DAppProps {
  onBack?: () => void;
}

export const DApp: React.FC<DAppProps> = () => {
  const [activeTab, setActiveTab] = useState('trader');

  return (
    <div className="min-h-screen flex flex-col bg-background text-slate-300 font-sans selection:bg-indigo-500/30">
      <Navbar />

      <main className="flex-1 container mx-auto max-w-7xl px-4 py-8">
        <GlobalStats />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <PortfolioSummary />
          <TradingAccountCard />
        </div>

        <TabsRoot value={activeTab} onValueChange={setActiveTab} className="space-y-8">

          {/* Feature Navigation */}
          <div className="flex justify-center w-full">
            <TabsListImpl className="inline-flex">
              <TabsTriggerImpl value="trader">Trader Terminal</TabsTriggerImpl>
              <TabsTriggerImpl value="lp">LP Dashboard</TabsTriggerImpl>
              <TabsTriggerImpl value="operator">Operator Console</TabsTriggerImpl>
              <TabsTriggerImpl value="activity">Activity Log</TabsTriggerImpl>
            </TabsListImpl>
          </div>

          {/* Feature Views */}
          <TabsContent value="trader" className="animate-slide-up">
            <TraderTerminal />
          </TabsContent>

          <TabsContent value="lp" className="animate-slide-up">
            <LPDashboard />
          </TabsContent>

          <TabsContent value="operator" className="animate-slide-up">
            <OperatorConsole />
          </TabsContent>

          <TabsContent value="activity" className="animate-slide-up">
            <div className="h-[600px]">
              <ActivityLog />
            </div>
          </TabsContent>

        </TabsRoot>
      </main>

      <Footer />
    </div>
  );
};
