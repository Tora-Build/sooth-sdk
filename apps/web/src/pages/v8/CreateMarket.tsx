import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Zap, DollarSign, Clock, AlertTriangle, Loader2, CheckCircle, Shield, Check } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useLaunchpadMarket } from "../../hooks/v8";
import { useAccount } from 'wagmi';
import { parseUnits } from 'viem';

const LIQUIDITY_TIERS = [
  { index: 0, label: '$100', deposit: 69, bValue: 100 },
  { index: 1, label: '$1,000', deposit: 693, bValue: 1000 },
  { index: 2, label: '$10,000', deposit: 6931, bValue: 10000 },
  { index: 3, label: '$100,000', deposit: 69315, bValue: 100000 },
];

// Adjudicator options for market resolution
const ADJUDICATORS = [
  { id: 'manual', label: 'Manual Resolution', description: 'Market creator resolves the outcome', icon: '👤', disabled: false },
  { id: 'chainlink', label: 'Chainlink Oracle', description: 'Automated price feed resolution', icon: '🔗', disabled: true },
  { id: 'uma', label: 'UMA Optimistic', description: 'Community-verified truth', icon: '⚖️', disabled: true },
  { id: 'api3', label: 'API3 dAPI', description: 'First-party oracle data', icon: '📡', disabled: true },
  { id: 'pyth', label: 'Pyth Network', description: 'High-frequency price feeds', icon: '🐍', disabled: true },
];

export const CreateMarket = () => {
  const { isConnected } = useAccount();
  const { 
    createMarket, 
    approveUSDC, 
    allowance, 
    usdcBalance,
    isPending, 
    isApprovePending,
    deployedMarketAddress,
    isConfirmed,
    writeError
  } = useLaunchpadMarket();

  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTier, setSelectedTier] = useState(0);
  const [isOpenEnd, setIsOpenEnd] = useState(false);
  const [duration, setDuration] = useState(7);
  const [adjudicator, setAdjudicator] = useState('manual');

  const selectedTierData = LIQUIDITY_TIERS[selectedTier];
  const requiredDeposit = selectedTierData.deposit;
  const requiredDepositWei = parseUnits(String(requiredDeposit), 18);
  const isApproved = allowance !== undefined && allowance >= requiredDepositWei;
  const hasBalance = usdcBalance !== undefined && usdcBalance >= requiredDepositWei;

  const handleApprove = () => {
    approveUSDC();
  };

  const handleCreate = () => {
    if (!name || !symbol) return;
    const durationSeconds = isOpenEnd ? 0 : duration * 24 * 60 * 60;
    createMarket(name, symbol, description, selectedTier, isOpenEnd, durationSeconds);
  };

  // Not connected state
  if (!isConnected) {
    return (
      <div className="text-center py-20" role="region" aria-label="Connect wallet prompt">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-slate-900/50 border border-slate-700 flex items-center justify-center">
          <Zap className="w-8 h-8 text-slate-600" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Connect Your Wallet</h1>
        <p className="text-slate-400 mb-6">
          Connect a wallet to create a prediction market.
        </p>
      </div>
    );
  }

  // Success state
  if (isConfirmed && deployedMarketAddress) {
    return (
      <div className="max-w-xl mx-auto text-center py-20" role="region" aria-label="Market created success">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-emerald-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Market Created! 🎉</h1>
        <p className="text-slate-400 mb-6">
          Your prediction market is now live on the bonding curve.
        </p>
        <div className="p-4 bg-slate-900 rounded-lg border border-slate-700 mb-6 font-mono text-sm text-cyan-400 break-all">
          {deployedMarketAddress}
        </div>
        <div className="flex gap-4 justify-center">
          <Link
            to={`/market/${deployedMarketAddress}`}
            className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg transition-all"
          >
            View Market
          </Link>
          <Link
            to="/markets"
            className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg transition-all border border-slate-700"
          >
            Browse Markets
          </Link>
        </div>
      </div>
    );
  }

  // Main form
  return (
    <div className="max-w-2xl mx-auto space-y-6" role="main" aria-label="Create market form">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/markets"
          className="p-2 rounded-lg border border-slate-700 hover:border-cyan-500/50 hover:bg-slate-800/50 transition-all"
          aria-label="Back to markets"
        >
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Create Market</h1>
          <p className="text-slate-400 text-sm">Launch a new prediction market</p>
        </div>
      </div>

      {/* Form */}
      <Card className="p-6 space-y-6">
        {/* Market Details */}
        <div className="space-y-4">
          <h2 className="font-bold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-cyan-400" />
            Market Details
          </h2>

          <div>
            <label htmlFor="name" className="text-sm text-slate-400 mb-2 block">Market Question</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Will Bitcoin reach $100k by 2025?"
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="symbol" className="text-sm text-slate-400 mb-2 block">Symbol</label>
            <input
              id="symbol"
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase().slice(0, 10))}
              placeholder="BTC100K"
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-cyan-500 transition-colors uppercase"
            />
          </div>

          <div>
            <label htmlFor="description" className="text-sm text-slate-400 mb-2 block">Description (optional)</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional context about the market resolution..."
              rows={3}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-cyan-500 transition-colors resize-none"
            />
          </div>
        </div>

        {/* Liquidity Tier */}
        <div className="space-y-4">
          <h2 className="font-bold text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            Liquidity Tier
          </h2>
          <p className="text-sm text-slate-400">
            Higher tiers provide deeper liquidity but require larger deposits.
          </p>

          <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Select liquidity tier">
            {LIQUIDITY_TIERS.map((tier) => (
              <button
                key={tier.index}
                onClick={() => setSelectedTier(tier.index)}
                role="radio"
                aria-checked={selectedTier === tier.index}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  selectedTier === tier.index
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : 'border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className="text-xl font-bold text-white">{tier.label}</div>
                <div className="text-sm text-slate-400">
                  Deposit: ${tier.deposit.toLocaleString()}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Duration */}
        <div className="space-y-4">
          <h2 className="font-bold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" />
            Market Duration
          </h2>

          <div className="flex items-center gap-4" role="radiogroup" aria-label="Select duration type">
            <button
              onClick={() => setIsOpenEnd(false)}
              role="radio"
              aria-checked={!isOpenEnd}
              className={`flex-1 p-4 rounded-xl border-2 text-center transition-all ${
                !isOpenEnd
                  ? 'border-cyan-500 bg-cyan-500/10'
                  : 'border-slate-700 hover:border-slate-600'
              }`}
            >
              <div className="font-bold text-white">Fixed Duration</div>
              <div className="text-sm text-slate-400">Expires after set time</div>
            </button>
            <button
              onClick={() => setIsOpenEnd(true)}
              role="radio"
              aria-checked={isOpenEnd}
              className={`flex-1 p-4 rounded-xl border-2 text-center transition-all ${
                isOpenEnd
                  ? 'border-cyan-500 bg-cyan-500/10'
                  : 'border-slate-700 hover:border-slate-600'
              }`}
            >
              <div className="font-bold text-white">Open End</div>
              <div className="text-sm text-slate-400">No expiry date</div>
            </button>
          </div>

          {!isOpenEnd && (
            <div>
              <label htmlFor="duration" className="text-sm text-slate-400 mb-2 block">Duration (days)</label>
              <input
                id="duration"
                type="number"
                value={duration}
                onChange={(e) => setDuration(Math.max(1, parseInt(e.target.value) || 7))}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-cyan-500 transition-colors"
                min={1}
                max={365}
              />
            </div>
          )}
        </div>

        {/* Adjudicator Selection */}
        <div className="space-y-4">
          <h2 className="font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-400" />
            Resolution Method
          </h2>
          <p className="text-sm text-slate-400">
            How will the market outcome be determined?
          </p>

          <div className="space-y-2">
            {ADJUDICATORS.map((adj) => (
              <button
                key={adj.id}
                onClick={() => !adj.disabled && setAdjudicator(adj.id)}
                disabled={adj.disabled}
                className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                  adjudicator === adj.id
                    ? 'border-purple-500 bg-purple-500/10'
                    : adj.disabled
                    ? 'border-slate-800 bg-slate-900/50 opacity-50 cursor-not-allowed'
                    : 'border-slate-700 hover:border-slate-600'
                }`}
              >
                <span className="text-2xl">{adj.icon}</span>
                <div className="flex-1">
                  <div className="font-bold text-white flex items-center gap-2">
                    {adj.label}
                    {adj.disabled && (
                      <span className="text-xs text-slate-500 font-normal">(Coming Soon)</span>
                    )}
                  </div>
                  <div className="text-sm text-slate-400">{adj.description}</div>
                </div>
                {adjudicator === adj.id && (
                  <Check className="w-5 h-5 text-purple-400" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Balance Info */}
        <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Your USDC Balance</span>
            <span className="font-mono text-white">
              ${usdcBalance ? (Number(usdcBalance) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0.00'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Required Deposit</span>
            <span className="font-mono text-cyan-400">${requiredDeposit.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Allowance</span>
            <span className={`font-mono ${isApproved ? 'text-emerald-400' : 'text-amber-400'}`}>
              {isApproved ? '✓ Approved' : 'Not approved'}
            </span>
          </div>
        </div>

        {/* Warning */}
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-3" role="alert">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-200">
            <strong>Important:</strong> Your deposit of ${requiredDeposit.toLocaleString()} USDC will be locked until the market graduates or expires. 
            If the market fails to graduate, you can claim a full refund.
          </div>
        </div>

        {/* Error Display */}
        {writeError && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400" role="alert">
            Error: {writeError.message}
          </div>
        )}

        {/* Submit - Two-step: Approve then Create */}
        {!isApproved ? (
          <Button
            onClick={handleApprove}
            disabled={isApprovePending || !hasBalance}
            className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold"
          >
            {isApprovePending ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Approving USDC...
              </span>
            ) : !hasBalance ? (
              `Insufficient USDC (need $${requiredDeposit})`
            ) : (
              `Step 1: Approve USDC`
            )}
          </Button>
        ) : (
          <Button
            onClick={handleCreate}
            disabled={!name || !symbol || isPending}
            className="w-full py-4 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-black font-bold"
          >
            {isPending ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Creating Market...
              </span>
            ) : (
              `Step 2: Create Market ($${requiredDeposit} deposit)`
            )}
          </Button>
        )}
      </Card>
    </div>
  );
};
