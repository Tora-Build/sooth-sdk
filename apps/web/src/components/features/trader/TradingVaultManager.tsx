import React, { useState } from 'react';
import { Card } from '../../ui/Card';
import { Wallet, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { useTraderVault } from '../../../hooks/useTraderVault';
import { formatUnits } from 'viem';
import { useMarketStore } from '../../../store/useMarketStore';

/**
 * Trading Vault Management Component
 * Allows users to deposit/withdraw USDC to/from TraderVaultV3
 */
export const TradingVaultManager: React.FC = () => {
  const { mode } = useMarketStore();
  const { 
    deposit, 
    withdraw, 
    availableBalance, 
    pendingBalance,
    userUsdcBalance,
    isPending,
    decimals
  } = useTraderVault();

  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  const available = parseFloat(formatUnits(availableBalance, decimals));
  const pending = parseFloat(formatUnits(pendingBalance, decimals));
  const walletBalance = parseFloat(formatUnits(userUsdcBalance, decimals));

  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) return;
    await deposit(depositAmount);
    setDepositAmount('');
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) return;
    await withdraw(withdrawAmount);
    setWithdrawAmount('');
  };

  return (
    <Card className="border-slate-800/60 bg-slate-900/40">
      <h3 className="font-heading font-medium text-slate-300 mb-4">Trading Account</h3>

      {/* Balance Display */}
      <div className="space-y-3 mb-6">
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-500">Wallet Balance</span>
          <span className="font-mono text-white">
            ${walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-500">Available (Trading)</span>
          <span className="font-mono text-emerald-400">
            ${available.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        {pending > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-500">Pending (48h lock)</span>
            <span className="font-mono text-amber-400">
              ${pending.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        )}
      </div>

      {/* Deposit Section */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <ArrowDownToLine size={14} />
          <span>Deposit to Vault</span>
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            placeholder="Amount"
            className="flex-1 px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            disabled={isPending || mode === 'demo'}
          />
          <button
            onClick={() => setDepositAmount(walletBalance.toString())}
            className="px-3 py-2 text-xs bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-700 transition-colors"
            disabled={isPending}
          >
            Max
          </button>
          <button
            onClick={handleDeposit}
            disabled={isPending || !depositAmount || parseFloat(depositAmount) <= 0}
            className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Wallet size={14} />
            {isPending ? 'Processing...' : 'Deposit'}
          </button>
        </div>
      </div>

      {/* Withdraw Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <ArrowUpFromLine size={14} />
          <span>Withdraw from Vault</span>
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            placeholder="Amount"
            className="flex-1 px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            disabled={isPending || mode === 'demo'}
          />
          <button
            onClick={() => setWithdrawAmount(available.toString())}
            className="px-3 py-2 text-xs bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-700 transition-colors"
            disabled={isPending}
          >
            Max
          </button>
          <button
            onClick={handleWithdraw}
            disabled={isPending || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
            className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Wallet size={14} />
            {isPending ? 'Processing...' : 'Withdraw'}
          </button>
        </div>
      </div>

      {mode === 'demo' && (
        <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <p className="text-xs text-amber-400">
            💡 Demo Mode: Switch to Test mode and connect wallet to use Trading Vault
          </p>
        </div>
      )}
    </Card>
  );
};
