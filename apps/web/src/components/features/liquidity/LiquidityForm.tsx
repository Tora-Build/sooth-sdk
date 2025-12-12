import React, { useState } from 'react';
import { useVault } from '../../../hooks/useVault';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { TabsRoot, TabsListImpl, TabsTriggerImpl } from '../../ui/Tabs';
import { formatUnits } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';

export const LiquidityForm: React.FC = () => {
  const { deposit, withdraw, lpBalance, userUsdcBalance, maxDeposit, sharePrice, isPending, isLoading } = useVault();
  const [amount, setAmount] = useState('');
  const [activeTab, setActiveTab] = useState('deposit');

  const handleAction = () => {
    if (!amount) return;
    if (activeTab === 'deposit') {
      deposit(amount);
    } else {
      withdraw(amount);
    }
    setAmount('');
  };

  const userBalanceVal = parseFloat(formatUnits(userUsdcBalance, 18));
  const maxDepositVal = parseFloat(formatUnits(maxDeposit, 18));
  const lpBalanceVal = parseFloat(formatUnits(lpBalance, 18));

  const maxAvailable = activeTab === 'deposit' 
    ? Math.min(userBalanceVal, maxDepositVal)
    : lpBalanceVal;

  const isDepositPaused = activeTab === 'deposit' && maxDepositVal === 0;

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  return (
    <Card className="flex flex-col overflow-hidden h-fit" variant="premium">
      <div className="p-4 border-b border-slate-800 flex justify-between items-center">
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
          Liquidity Provider
        </h3>
      </div>

      <TabsRoot 
        value={activeTab} 
        onValueChange={(val) => {
          setActiveTab(val);
          setAmount('');
        }} 
        className="flex flex-col p-4 space-y-4"
      >
        <TabsListImpl className="w-full grid grid-cols-2">
          <TabsTriggerImpl value="deposit">Deposit</TabsTriggerImpl>
          <TabsTriggerImpl value="withdraw">Withdraw</TabsTriggerImpl>
        </TabsListImpl>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="space-y-4"
          >
            {/* Info Rows */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center bg-slate-900/40 p-3 rounded-lg border border-slate-800/50">
                <span className="text-slate-500">Wallet Balance</span>
                <span className="font-mono text-white font-medium">
                  {isLoading ? '...' : formatCurrency(userBalanceVal)}
                </span>
              </div>
              
              <div className="flex justify-between items-center bg-slate-900/40 p-3 rounded-lg border border-slate-800/50">
                <span className="text-slate-500">Available to Deposit</span>
                <span className={`font-mono font-medium ${activeTab === 'deposit' ? 'text-emerald-400' : 'text-slate-300'}`}>
                  {isLoading ? '...' : formatCurrency(maxAvailable)}
                </span>
              </div>
            </div>

            {isDepositPaused ? (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-center">
                <div className="text-amber-400 text-xs font-medium">
                  Deposits are currently paused
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-slate-500 px-1">
                  <span>Amount</span>
                  <span>Max: {formatCurrency(maxAvailable)}</span>
                </div>
                
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pr-16 text-right font-mono text-lg bg-slate-950/50 border-slate-800 focus:border-indigo-500/50 transition-colors"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500 pointer-events-none">
                    {activeTab === 'deposit' ? 'USDC' : 'LP'}
                  </div>
                  <button 
                    onClick={() => setAmount(maxAvailable.toString())}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] uppercase font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-2 py-1 rounded transition-colors"
                  >
                    Max
                  </button>
                </div>
              </div>
            )}

            <Button
              onClick={handleAction}
              disabled={!amount || parseFloat(amount) <= 0 || parseFloat(amount) > maxAvailable || isPending || isDepositPaused}
              isLoading={isPending}
              className={`w-full py-5 text-sm font-bold shadow-lg transition-all hover:scale-[1.01] active:scale-[0.99] ${
                activeTab === 'deposit' 
                  ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20' 
                  : 'bg-slate-700 hover:bg-slate-600'
              }`}
            >
              {activeTab === 'deposit' ? 'Confirm Deposit' : 'Confirm Withdraw'}
            </Button>

          </motion.div>
        </AnimatePresence>
      </TabsRoot>
    </Card>
  );
};
