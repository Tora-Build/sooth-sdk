/**
 * SettlementPanel - Adjudicator controls for settling market outcome per V8_OPERATOR_CONSOLE_SPEC.md
 */
import { useState } from 'react';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { Scale, TrendingUp, TrendingDown, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useTruthMarketDirect, useAmmMarketDirect } from '../../../hooks/v8';

interface SettlementPanelProps {
  address: `0x${string}`;
}

type Outcome = 'yes' | 'no' | 'invalid' | null;

export const SettlementPanel = ({ address }: SettlementPanelProps) => {
  const { address: userAddress } = useAccount();
  const { market: truthMarket, isLoading: truthLoading } = useTruthMarketDirect(address);
  const { amm } = useAmmMarketDirect(address);
  
  const [selectedOutcome, setSelectedOutcome] = useState<Outcome>(null);
  const [tStar, setTStar] = useState<string>('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSettling, setIsSettling] = useState(false);

  const isAdjudicator = userAddress?.toLowerCase() === truthMarket?.adjudicator?.toLowerCase();
  const isSettled = truthMarket?.isSettled ?? false;
  const isLive = truthMarket?.isLive ?? true;
  const deadline = truthMarket?.deadline;
  
  // Calculate settlement impact
  const qYes = Number(amm?.qYes ?? 0n) / 1e18;
  const qNo = Number(amm?.qNo ?? 0n) / 1e18;
  const yesTotalPayout = qYes; // $1 per share
  const noTotalPayout = qNo;

  // Don't show if not adjudicator or already settled
  if (!isAdjudicator || isSettled) {
    return null;
  }

  const handleSettle = async () => {
    if (!selectedOutcome) return;
    setIsSettling(true);
    
    // TODO: Implement TruthMarket.settle(outcome, tStar)
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulated delay
    
    setIsSettling(false);
    setShowConfirmation(false);
  };

  if (truthLoading) {
    return (
      <Card>
        <div className="p-4 animate-pulse space-y-3">
          <div className="h-5 bg-slate-700 rounded w-1/3" />
          <div className="h-12 bg-slate-700 rounded" />
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-blue-500/30 bg-blue-500/5">
        <div className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold text-white">Settle Market</h3>
            <Badge variant="default" className="text-blue-400 bg-blue-500/20">
              Adjudicator
            </Badge>
          </div>

          {/* Deadline Check */}
          {deadline && (
            <div className="bg-slate-800/50 rounded-lg p-3 flex items-center gap-3">
              <Clock className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-slate-400 text-sm">Market Deadline</p>
                <p className="text-white">
                  {new Date(Number(deadline) * 1000).toLocaleString()}
                </p>
              </div>
            </div>
          )}

          {/* Outcome Selection */}
          <div className="space-y-2">
            <label className="text-sm text-slate-400">Select Outcome</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setSelectedOutcome('yes')}
                className={`p-3 rounded-lg border-2 text-center transition-all ${
                  selectedOutcome === 'yes'
                    ? 'border-emerald-500 bg-emerald-500/20'
                    : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                }`}
              >
                <TrendingUp className={`w-5 h-5 mx-auto mb-1 ${
                  selectedOutcome === 'yes' ? 'text-emerald-400' : 'text-slate-500'
                }`} />
                <span className={`font-bold ${
                  selectedOutcome === 'yes' ? 'text-emerald-400' : 'text-slate-400'
                }`}>YES</span>
              </button>
              
              <button
                onClick={() => setSelectedOutcome('no')}
                className={`p-3 rounded-lg border-2 text-center transition-all ${
                  selectedOutcome === 'no'
                    ? 'border-rose-500 bg-rose-500/20'
                    : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                }`}
              >
                <TrendingDown className={`w-5 h-5 mx-auto mb-1 ${
                  selectedOutcome === 'no' ? 'text-rose-400' : 'text-slate-500'
                }`} />
                <span className={`font-bold ${
                  selectedOutcome === 'no' ? 'text-rose-400' : 'text-slate-400'
                }`}>NO</span>
              </button>
              
              <button
                onClick={() => setSelectedOutcome('invalid')}
                className={`p-3 rounded-lg border-2 text-center transition-all ${
                  selectedOutcome === 'invalid'
                    ? 'border-amber-500 bg-amber-500/20'
                    : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                }`}
              >
                <AlertTriangle className={`w-5 h-5 mx-auto mb-1 ${
                  selectedOutcome === 'invalid' ? 'text-amber-400' : 'text-slate-500'
                }`} />
                <span className={`font-bold ${
                  selectedOutcome === 'invalid' ? 'text-amber-400' : 'text-slate-400'
                }`}>INVALID</span>
              </button>
            </div>
          </div>

          {/* T* Input (Optional) */}
          <div className="space-y-2">
            <label className="text-sm text-slate-400 flex items-center gap-1">
              T* (Retroactive Truth-Time)
              <span className="text-xs text-slate-500">(Optional)</span>
            </label>
            <input
              type="datetime-local"
              value={tStar}
              onChange={(e) => setTStar(e.target.value)}
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Settlement Impact Preview */}
          {selectedOutcome && (
            <div className="bg-slate-800/50 rounded-lg p-3 space-y-2">
              <p className="text-sm text-slate-400">Settlement Impact Preview</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-500">YES holders receive:</p>
                  <p className={selectedOutcome === 'yes' ? 'text-emerald-400 font-bold' : 'text-slate-500 line-through'}>
                    ${selectedOutcome === 'yes' ? '1.00' : '0.00'} per token
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">NO holders receive:</p>
                  <p className={selectedOutcome === 'no' ? 'text-emerald-400 font-bold' : 'text-slate-500 line-through'}>
                    ${selectedOutcome === 'no' ? '1.00' : '0.00'} per token
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-700">
                <p className="text-slate-500 text-sm">Total Payout:</p>
                <p className="text-white font-mono">
                  ${selectedOutcome === 'yes' ? yesTotalPayout.toFixed(2) : 
                    selectedOutcome === 'no' ? noTotalPayout.toFixed(2) : '0.00'}
                </p>
              </div>
            </div>
          )}

          {/* Warning */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-200">
              <p className="font-medium">Warning</p>
              <p className="text-amber-200/70 text-xs mt-0.5">
                This action is irreversible unless vetoed by the guardian. Ensure the outcome is correct.
              </p>
            </div>
          </div>

          {/* Settle Button */}
          <Button 
            variant="primary"
            className="w-full bg-blue-600 hover:bg-blue-500"
            onClick={() => setShowConfirmation(true)}
            disabled={!selectedOutcome}
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Settle Market
          </Button>
        </div>
      </Card>

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <Card className="max-w-md w-full border-amber-500/30">
            <div className="p-6 space-y-4">
              <div className="text-center">
                <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
                <h3 className="text-xl font-bold text-white">Confirm Settlement</h3>
              </div>

              <div className="bg-slate-800/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Outcome:</span>
                  <span className={`font-bold ${
                    selectedOutcome === 'yes' ? 'text-emerald-400' :
                    selectedOutcome === 'no' ? 'text-rose-400' : 'text-amber-400'
                  }`}>
                    {selectedOutcome?.toUpperCase()}
                  </span>
                </div>
                {tStar && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">T*:</span>
                    <span className="text-white">{new Date(tStar).toLocaleString()}</span>
                  </div>
                )}
              </div>

              <p className="text-sm text-slate-400 text-center">
                This action cannot be undone except by guardian veto.
              </p>

              <div className="flex gap-3">
                <Button 
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setShowConfirmation(false)}
                >
                  Cancel
                </Button>
                <Button 
                  variant="primary"
                  className="flex-1 bg-blue-600 hover:bg-blue-500"
                  onClick={handleSettle}
                  disabled={isSettling}
                >
                  {isSettling ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Settling...
                    </span>
                  ) : (
                    'Confirm Settlement'
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
};

