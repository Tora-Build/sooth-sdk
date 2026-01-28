
import React, { useState } from 'react';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { Input } from '../../ui/Input';
import { RefreshCw, Wallet, ArrowDownLeft, ArrowUpRight, Coins, Lock, Clock, TrendingUp, Scissors, GitMerge } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useAccount } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { useTraderVault } from '../../../hooks/useTraderVault';
import { useActivePositions } from '../../../hooks/useActivePositions';
import { useLockedFunds } from '../../../hooks/useLockedFunds';
import { PositionActionsModal } from './PositionActionsModal';

export const TradingAccountCard: React.FC = () => {
  const { isConnected } = useAccount();

  // Trading Account data
  const { 
    availableBalance, 
    reservedBalance, 
    totalBalance, 
    userUsdcBalance, 
    decimals, 
    allowance, 
    approveUSDC, 
    isPending,
    deposit,
    withdraw
  } = useTraderVault();
  const { vaultValue, refetch: refetchPositions } = useActivePositions();
  const { refetch: refetchLocked } = useLockedFunds();

  // Dialog State
  const [depositAmount, setDepositAmount] = useState<string | bigint>('');
  const [withdrawAmount, setWithdrawAmount] = useState<string | bigint>('');
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'merge' | 'split' | null>(null);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(val);

  // Vault stores balances in USDC decimals (6 for real USDC)
  // Use the decimals read from the contract
  const DISPLAY_DECIMALS = decimals || 6;
  const available = parseFloat(formatUnits(availableBalance, DISPLAY_DECIMALS));
  const reserved = parseFloat(formatUnits(reservedBalance, DISPLAY_DECIMALS));
  const cashValue = parseFloat(formatUnits(totalBalance, DISPLAY_DECIMALS));
  const totalAccountValue = cashValue + vaultValue;
  const walletAvailable = parseFloat(formatUnits(userUsdcBalance || 0n, DISPLAY_DECIMALS));

  // Checking Allowance for Deposit
  const depositAmountBig = typeof depositAmount === 'string' 
    ? (depositAmount ? parseUnits(depositAmount, decimals || 18) : 0n)
    : depositAmount;
  const needsApproval = (allowance || 0n) < depositAmountBig;

  const handleRefresh = () => {
    refetchPositions();
    refetchLocked();
  };

  const onDeposit = async () => {
    if (!depositAmount || (typeof depositAmount === 'string' && !parseFloat(depositAmount))) return;
    try {
      if (needsApproval) {
        await approveUSDC(typeof depositAmount === 'string' ? depositAmount : formatUnits(depositAmount, DISPLAY_DECIMALS));
      } else {
        // await deposit(depositAmount); // Handled by hook/store
        setDepositAmount('');
        setIsDepositOpen(false);
      }
    } catch (e) {
      // Error handled in hook
    }
  };

  const onWithdraw = () => {
    if (!withdrawAmount || (typeof withdrawAmount === 'string' && !parseFloat(withdrawAmount))) return;
    // withdraw(withdrawAmount);
    setWithdrawAmount('');
    setIsWithdrawOpen(false);
  };


  if (!isConnected) {
    return (
      <Card className="h-full border-slate-800 bg-slate-900/50 p-6 flex flex-col items-center justify-center text-center backdrop-blur-sm">
        <Wallet className="w-10 h-10 text-slate-600 mb-3" />
        <h3 className="text-sm font-medium text-slate-400">Connect Wallet</h3>
        <p className="text-xs text-slate-500 mt-1">Access your trading account</p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col border-cyan-500/20 bg-cyan-950/30 backdrop-blur-xl shadow-2xl overflow-visible relative">
      {/* Ambient Glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl -translate-y-4 translate-x-4 pointer-events-none" />

      <div className="p-4 flex flex-col space-y-4 relative z-10">

        {/* Header: Overview */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <div className="text-xs text-cyan-400/80 uppercase tracking-widest font-bold flex items-center gap-1.5">
              Trading Account
              <button
                onClick={handleRefresh}
                className="text-slate-600 hover:text-cyan-400 transition-colors"
                title="Refresh Balance"
              >
                <RefreshCw size={10} />
              </button>
            </div>
            <div className="text-xs text-slate-500 font-medium flex items-center gap-1" title="Wallet USDC Balance">
              <Wallet size={9} className="text-slate-600" />
              {formatCurrency(walletAvailable)}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {/* Total Balance Big Number */}
            <div className="text-3xl font-bold text-white font-mono tracking-tighter drop-shadow-lg leading-none">
              {formatCurrency(totalAccountValue)}
            </div>

            {/* Action Buttons Grid */}
            <div className="flex flex-col gap-2">
              <div className="text-xs text-cyan-400/50 font-bold uppercase tracking-widest flex items-center gap-1">
                Unified Collateral • Professional Execution
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setIsWithdrawOpen(true)}
                  className="group py-2 text-xs font-black uppercase tracking-widest border border-slate-700 hover:border-slate-600 bg-slate-800/80 hover:bg-slate-700"
                >
                  <ArrowUpRight size={12} className="mr-1 opacity-70 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" /> Withdraw
                </Button>

                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => setIsDepositOpen(true)}
                  className="group py-2 text-xs font-black uppercase tracking-widest bg-cyan-600 hover:bg-cyan-500 border-none text-white"
                >
                  <ArrowDownLeft size={12} className="mr-1 opacity-70 group-hover:-translate-x-0.5 group-hover:translate-y-0.5 transition-transform" /> Deposit
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Breakdown */}
        <div className="grid grid-cols-2 gap-1.5">

          {/* Liquid Cash */}
          <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10 backdrop-blur-md">
            <div className="text-xs text-emerald-400/60 uppercase tracking-widest font-bold mb-0.5 flex items-center gap-1">
              <Coins size={9} /> Liquid
            </div>
            <div className="text-base font-mono font-bold text-emerald-400 leading-none">
              {formatCurrency(available)}
            </div>
          </div>

          {/* Reserved (Collateral) */}
          <div 
            className="p-2.5 rounded-lg bg-slate-500/5 border border-slate-500/10 backdrop-blur-md"
            title="On-chain reserved collateral for open orders or short positions. May differ from visible orders if orders were placed in a previous session."
          >
            <div className="text-xs text-slate-400/60 uppercase tracking-widest font-bold mb-0.5 flex items-center gap-1">
              <Lock size={9} /> Reserved
            </div>
            <div className="text-base font-mono font-bold text-slate-400 leading-none">
              {formatCurrency(reserved)}
            </div>
          </div>

          {/* Position Value */}
          <div className="p-2.5 rounded-lg bg-cyan-500/5 border border-cyan-500/10 backdrop-blur-md flex justify-between items-center">
            <div className="text-xs text-cyan-400/60 uppercase tracking-widest font-bold flex items-center gap-1">
              <TrendingUp size={9} /> Vault Positions
            </div>
            <div className="text-base font-mono font-bold text-cyan-400 leading-none">
              {formatCurrency(vaultValue)}
            </div>
          </div>

        </div>

      </div>

      {/* Dialogs */}
      <Dialog isOpen={isWithdrawOpen} onClose={() => setIsWithdrawOpen(false)} title="Withdraw USDC">
        <div className="space-y-4 pt-4">
          <div className="relative">
            <Input
              placeholder="Amount to withdraw"
              value={typeof withdrawAmount === 'bigint' ? formatUnits(withdrawAmount, DISPLAY_DECIMALS) : withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              type="number"
            />
            <button
              onClick={() => setWithdrawAmount(availableBalance)}
              className="absolute right-2 top-2 px-2 py-1 bg-slate-800 text-xs text-emerald-400 rounded hover:bg-slate-700 font-bold"
            >
              MAX
            </button>
          </div>
          <div className="text-xs text-slate-500 text-right">Available to withdraw: {formatCurrency(available)}</div>
          <Button onClick={() => withdraw(withdrawAmount)} className="w-full py-2 text-sm font-bold">
            Confirm Withdraw
          </Button>
        </div>
      </Dialog>

      <Dialog isOpen={isDepositOpen} onClose={() => setIsDepositOpen(false)} title="Deposit USDC">
        <div className="space-y-4 pt-4">
          <div className="relative">
            <Input
              placeholder="Amount to deposit"
              value={typeof depositAmount === 'bigint' ? formatUnits(depositAmount, DISPLAY_DECIMALS) : depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              type="number"
            />
            <button
              onClick={() => setDepositAmount(userUsdcBalance || 0n)}
              className="absolute right-2 top-2 px-2 py-1 bg-slate-800 text-xs text-cyan-400 rounded hover:bg-slate-700 font-bold transition-colors"
            >
              MAX
            </button>
          </div>
          <div className="text-xs text-slate-500 text-right">Available to deposit: {formatCurrency(walletAvailable)}</div>

          <Button onClick={() => deposit(depositAmount)} disabled={isPending || !depositAmount} className="w-full py-2 text-sm font-bold">
            {isPending ? 'Processing...' : (needsApproval ? 'Approve USDC' : 'Confirm Deposit')}
          </Button>
        </div>
      </Dialog>

      <PositionActionsModal
        isOpen={modalMode !== null}
        onClose={() => setModalMode(null)}
        mode={modalMode || 'merge'}
        refetch={() => {
          refetchPositions();
          refetchLocked();
        }}
      />
    </Card>
  );
};
