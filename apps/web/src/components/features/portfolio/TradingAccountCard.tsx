
import React, { useState } from 'react';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { Input } from '../../ui/Input';
import { TrendingUp, Copy, ExternalLink, RefreshCw, Wallet, ArrowDownLeft, ArrowUpRight, Coins, Lock } from 'lucide-react';
import { useAccount, useReadContract, useWriteContract, usePublicClient } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { ERC20_ABI, MOCK_ERC20_ABI } from '../../../config/abis';
import { useDeployments } from '../../../hooks/useDeployments';
import { useTraderVault } from '../../../hooks/useTraderVault';
import { useActivePositions } from '../../../hooks/useActivePositions';
import { useChainStore } from '../../../store/useChainStore';
import { getChainById } from '../../../lib/chains';
import toast from 'react-hot-toast';

export const TradingAccountCard: React.FC = () => {
  const { address, isConnected } = useAccount();
  const deployments = useDeployments();
  const { selectedChainId } = useChainStore();

  // Trading Account data
  const { availableBalance, pendingBalance, totalBalance, deposit, withdraw, isPending, refetch, userUsdcBalance, decimals, allowance, approveUSDC, traderVaultAddress } = useTraderVault();
  const { totalPositionValue, refetch: refetchPositions } = useActivePositions();

  // Dialog State
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);

  // Faucet Logic
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const [isMinting, setIsMinting] = useState(false);
  const { data: contractDecimals } = useReadContract({
    address: deployments.MockUSDC as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'decimals',
  });

  const chain = getChainById(selectedChainId);
  const explorerUrl = chain?.explorerUrl || 'https://sepolia.basescan.org';

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(val);

  // Vault stores USDC in 18 decimals (WAD), regardless of orderbook share decimals
  const USDC_DECIMALS = 18;
  const available = parseFloat(formatUnits(availableBalance, USDC_DECIMALS));
  const reserved = parseFloat(formatUnits(pendingBalance, USDC_DECIMALS));
  const cashValue = parseFloat(formatUnits(totalBalance, USDC_DECIMALS));
  const totalAccountValue = cashValue + totalPositionValue;
  const walletAvailable = parseFloat(formatUnits(userUsdcBalance || 0n, USDC_DECIMALS));

  // Checking Allowance for Deposit
  const depositAmountBig = depositAmount ? parseUnits(depositAmount, decimals || 18) : 0n;
  const needsApproval = (allowance || 0n) < depositAmountBig;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Address copied');
  };

  const handleRefresh = () => {
    refetch();
    refetchPositions();
  };

  const handleMint = async () => {
    if (!address) { toast.error('Connect wallet first'); return; }
    setIsMinting(true);
    try {
      const tokenDecimals = contractDecimals || 18;
      const mintAmount = parseUnits('100000', Number(tokenDecimals));
      const hash = await writeContractAsync({
        address: deployments.MockUSDC as `0x${string}`,
        abi: MOCK_ERC20_ABI,
        functionName: 'mint',
        args: [address, mintAmount],
      });
      const toastId = toast.loading('Fauceting 100,000 USDC...');
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
        toast.success('Received 100,000 USDC!', { id: toastId });
        refetch();
      } else {
        toast.success('Transaction sent', { id: toastId });
      }
    } catch (err: any) {
      toast.error('Faucet failed');
    } finally { setIsMinting(false); }
  };

  const onDeposit = async () => {
    if (!depositAmount) return;
    try {
      if (needsApproval) {
        await approveUSDC(depositAmount);
      } else {
        await deposit(depositAmount); // await to prevent closing on error
        setDepositAmount('');
        setIsDepositOpen(false);
      }
    } catch (e) {
      // Error handled in hook
    }
  };

  const onWithdraw = () => {
    if (!withdrawAmount) return;
    withdraw(withdrawAmount);
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
    <Card className="h-full flex flex-col border-slate-700/50 bg-slate-900/60 backdrop-blur-xl shadow-2xl overflow-visible relative">
      {/* Ambient Glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -translate-y-12 translate-x-12 pointer-events-none" />

      <div className="p-5 flex-1 flex flex-col space-y-6 relative z-10">

        {/* Header: Overview */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <div className="text-[11px] text-slate-400 uppercase tracking-widest font-bold flex items-center gap-2">
              Trading Account
              <button
                onClick={handleRefresh}
                className="text-slate-600 hover:text-indigo-400 transition-colors"
                title="Refresh Balance"
              >
                <RefreshCw size={12} />
              </button>
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </div>
          </div>

          <div className="flex flex-col gap-5">
            {/* Total Balance Big Number */}
            <div className="text-4xl font-bold text-white font-mono tracking-tighter drop-shadow-lg">
              {formatCurrency(totalAccountValue)}
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setIsWithdrawOpen(true)}
                disabled={isPending}
                className="h-9 text-xs font-semibold border-slate-700 hover:border-slate-600 bg-slate-800/80 hover:bg-slate-700 shadow-lg shadow-black/20"
              >
                <ArrowUpRight size={14} className="mr-1.5 opacity-70" /> Withdraw
              </Button>

              <Button
                size="sm"
                variant="primary"
                onClick={() => setIsDepositOpen(true)}
                disabled={isPending}
                className="h-9 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 border-none shadow-lg shadow-indigo-900/20"
              >
                <ArrowDownLeft size={14} className="mr-1.5 opacity-70" /> Deposit
              </Button>
            </div>
          </div>
        </div>

        {/* Detailed Breakdown */}
        <div className="grid grid-cols-2 gap-2">

          {/* Liquid Cash */}
          <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 backdrop-blur-md">
            <div className="text-[10px] text-emerald-400/60 uppercase tracking-widest font-bold mb-1 flex items-center gap-1">
              <Coins size={10} /> Liquid
            </div>
            <div className="text-lg font-mono font-bold text-emerald-400 leading-none">
              {formatCurrency(available)}
            </div>
            <div className="text-[10px] text-emerald-500/40 mt-1 font-medium">Available to Withdraw</div>
          </div>

          {/* Reserved (Open Orders) */}
          <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 backdrop-blur-md">
            <div className="text-[10px] text-amber-400/60 uppercase tracking-widest font-bold mb-1 flex items-center gap-1">
              <Lock size={10} /> In Orders
            </div>
            <div className="text-lg font-mono font-bold text-amber-400 leading-none">
              {formatCurrency(reserved)}
            </div>
            <div className="text-[10px] text-amber-500/40 mt-1 font-medium">Reserved Collateral</div>
          </div>

          {/* Position Value */}
          <div className="col-span-2 p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/10 backdrop-blur-md flex justify-between items-center">
            <div>
              <div className="text-[10px] text-indigo-400/60 uppercase tracking-widest font-bold mb-0.5 flex items-center gap-1">
                <TrendingUp size={10} /> Active Positions
              </div>
              <div className="text-[10px] text-indigo-400/40 font-medium">Market Exposure</div>
            </div>
            <div className="text-lg font-mono font-bold text-indigo-400 leading-none">
              {formatCurrency(totalPositionValue)}
            </div>
          </div>
        </div>

        {/* Footer: Protocol Hover & Faucet */}
        <div className="mt-auto pt-4 border-t border-slate-800/30 flex items-center justify-between">
          {/* Protocol Contracts Hover */}
          <div className="group relative">
            <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500 cursor-help hover:text-slate-300 transition-colors flex items-center gap-1">
              Contracts <ExternalLink size={8} />
            </span>

            {/* Tooltip Content */}
            <div className="absolute bottom-full left-0 mb-2 w-56 p-3 rounded-lg bg-slate-950 border border-slate-800 shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none group-hover:pointer-events-auto overflow-hidden z-50">
              <div className="space-y-3">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-400 font-medium">Vault (V4)</span>
                  <button onClick={() => copyToClipboard(traderVaultAddress!)} className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1" title="Copy Address">
                    <span className="font-mono">{traderVaultAddress?.slice(0, 6)}...</span>
                    <Copy size={10} />
                  </button>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-400 font-medium">Governor</span>
                  <button onClick={() => copyToClipboard(deployments.SoothGovernorVault!)} className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1" title="Copy Address">
                    <span className="font-mono">{deployments.SoothGovernorVault?.slice(0, 6)}...</span>
                    <Copy size={10} />
                  </button>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-400 font-medium">Fee Controller</span>
                  <button onClick={() => copyToClipboard(deployments.SoothFeeController!)} className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1" title="Copy Address">
                    <span className="font-mono">{deployments.SoothFeeController?.slice(0, 6)}...</span>
                    <Copy size={10} />
                  </button>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-400 font-medium">USDC Token</span>
                  <button onClick={() => copyToClipboard(deployments.MockUSDC!)} className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1" title="Copy Address">
                    <span className="font-mono">{deployments.MockUSDC?.slice(0, 6)}...</span>
                    <Copy size={10} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Faucet Button */}
          <button
            onClick={handleMint}
            disabled={isMinting}
            className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-2 py-1 rounded transition-colors flex items-center gap-1.5"
          >
            {isMinting ? <RefreshCw size={10} className="animate-spin" /> : <TrendingUp size={10} />}
            USDC Faucet
          </button>
        </div>

      </div>

      {/* Dialogs */}
      <Dialog isOpen={isWithdrawOpen} onClose={() => setIsWithdrawOpen(false)} title="Withdraw USDC">
        <div className="space-y-4 pt-4">
          <div className="relative">
            <Input
              placeholder="Amount to withdraw"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              type="number"
            />
            <button
              onClick={() => setWithdrawAmount(available.toString())}
              className="absolute right-2 top-2 px-2 py-1 bg-slate-800 text-xs text-emerald-400 rounded hover:bg-slate-700 font-bold"
            >
              MAX
            </button>
          </div>
          <div className="text-xs text-slate-500 text-right">Available to withdraw: {formatCurrency(available)}</div>
          <Button onClick={onWithdraw} disabled={isPending || !withdrawAmount} className="w-full">
            {isPending ? 'Processing...' : 'Confirm Withdraw'}
          </Button>
        </div>
      </Dialog>

      <Dialog isOpen={isDepositOpen} onClose={() => setIsDepositOpen(false)} title="Deposit USDC">
        <div className="space-y-4 pt-4">
          <div className="relative">
            <Input
              placeholder="Amount to deposit"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              type="number"
            />
            <button
              onClick={() => setDepositAmount(walletAvailable.toString())}
              className="absolute right-2 top-2 px-2 py-1 bg-slate-800 text-xs text-indigo-400 rounded hover:bg-slate-700 font-bold"
            >
              MAX
            </button>
          </div>
          <div className="text-xs text-slate-500 text-right">Available to deposit: {formatCurrency(walletAvailable)}</div>



          <Button onClick={onDeposit} disabled={isPending || !depositAmount} className="w-full">
            {isPending ? 'Processing...' : (needsApproval ? 'Approve USDC' : 'Confirm Deposit')}
          </Button>
        </div>
      </Dialog>
    </Card>
  );
};

