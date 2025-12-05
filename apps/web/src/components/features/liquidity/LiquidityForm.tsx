import React, { useState } from 'react';
import { useVault } from '../../../hooks/useVault';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { TabsRoot, TabsListImpl, TabsTriggerImpl } from '../../ui/Tabs';
import { formatUnits } from 'viem';

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

  const previewAmount = activeTab === 'deposit'
    ? (parseFloat(amount || '0') / sharePrice).toFixed(4)
    : (parseFloat(amount || '0') * sharePrice).toFixed(4);

  return (
    <Card className="h-full flex flex-col">
      <TabsRoot 
        value={activeTab} 
        onValueChange={(val) => {
          setActiveTab(val);
          setAmount(''); // Clear amount on tab switch
        }} 
        className="h-full flex flex-col"
      >
        <TabsListImpl className="w-full grid grid-cols-2 mb-6">
          <TabsTriggerImpl value="deposit">Deposit</TabsTriggerImpl>
          <TabsTriggerImpl value="withdraw">Withdraw</TabsTriggerImpl>
        </TabsListImpl>

        <div className="flex-1 flex flex-col justify-center space-y-6">
          <div className="text-center">
            <div className="text-sm text-slate-400 mb-2">
              {activeTab === 'deposit' ? 'Add liquidity to earn yield' : 'Remove liquidity from vault'}
            </div>
            <div className="text-4xl font-bold text-white font-mono">
              {amount || '0.00'} <span className="text-lg text-slate-500">{activeTab === 'deposit' ? 'USDC' : 'LP'}</span>
            </div>
            <div className="text-xs text-slate-500 mt-2">
              Available: {isLoading ? '...' : maxAvailable.toFixed(4)} {activeTab === 'deposit' ? 'USDC' : 'LP'}
              {activeTab === 'deposit' && maxDepositVal > 0 && (
                <span className="block text-[10px] text-slate-600 mt-1">
                  Vault Cap: {maxDepositVal > 1e12 ? '> 1,000,000,000,000' : maxDepositVal.toLocaleString()} USDC
                </span>
              )}
            </div>
            <div className="mt-3 p-2 bg-slate-900/30 rounded-lg border border-slate-800/50">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Exchange Rate</div>
              <div className="text-sm font-mono text-slate-300">
                1 LP Token = {sharePrice.toFixed(4)} USDC
              </div>
            </div>
          </div>

          {isDepositPaused ? (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg text-center">
              <div className="text-amber-400 font-medium mb-1">Deposits Paused</div>
              <p className="text-xs text-amber-500/80">
                The vault is currently not accepting new deposits.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="text-center text-lg h-14 pr-16"
                />
                <button 
                  onClick={() => setAmount(maxAvailable.toString())}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs bg-slate-800 hover:bg-slate-700 text-indigo-400 px-2 py-1 rounded transition-colors"
                >
                  MAX
                </button>
              </div>
              
              <div className="grid grid-cols-4 gap-2">
                {[25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => setAmount((maxAvailable * pct / 100).toFixed(4))}
                    className="py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                  >
                    {pct}%
                  </button>
                ))}
              </div>

              {amount && parseFloat(amount) > 0 && (
                <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800 text-center">
                  <div className="text-xs text-slate-500 mb-1">
                    You will receive approximately
                  </div>
                  <div className="text-sm font-mono text-white">
                    {previewAmount} {activeTab === 'deposit' ? 'LP Tokens' : 'USDC'}
                  </div>
                </div>
              )}
            </div>
          )}

          <Button
            onClick={handleAction}
            disabled={!amount || parseFloat(amount) <= 0 || parseFloat(amount) > maxAvailable || isPending || isDepositPaused}
            isLoading={isPending}
            className="w-full py-4 text-lg"
            variant={activeTab === 'deposit' ? 'primary' : 'secondary'}
          >
            {activeTab === 'deposit' ? 'Deposit USDC' : 'Withdraw Liquidity'}
          </Button>
        </div>
      </TabsRoot>
    </Card>
  );
};
