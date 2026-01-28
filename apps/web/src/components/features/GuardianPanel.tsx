/**
 * GuardianPanel - Guardian veto and finalize controls per V8_OPERATOR_CONSOLE_SPEC.md
 */
import { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Shield, AlertTriangle, XCircle, CheckCircle, Clock, TrendingUp, TrendingDown } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useTruthMarketDirect } from '../../hooks';

interface GuardianPanelProps {
  address: `0x${string}`;
}

export const GuardianPanel = ({ address }: GuardianPanelProps) => {
  const { address: userAddress } = useAccount();
  const { market: truthMarket, isLoading } = useTruthMarketDirect(address);
  
  const [showVetoConfirmation, setShowVetoConfirmation] = useState(false);
  const [showFinalizeConfirmation, setShowFinalizeConfirmation] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const isGuardian = userAddress?.toLowerCase() === truthMarket?.guardian?.toLowerCase();
  const isSettled = truthMarket?.isSettled ?? false;
  const winningOutcome = truthMarket?.winningOutcome ?? 0;
  const adjudicator = truthMarket?.adjudicator;

  // Don't show if not guardian
  if (!isGuardian) {
    return null;
  }

  const handleVeto = async () => {
    setIsProcessing(true);
    // TODO: Implement TruthMarket.veto()
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsProcessing(false);
    setShowVetoConfirmation(false);
  };

  const handleFinalize = async () => {
    setIsProcessing(true);
    // TODO: Implement TruthMarket.finalize()
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsProcessing(false);
    setShowFinalizeConfirmation(false);
  };

  if (isLoading) {
    return (
      <Card>
        <div className="p-4 animate-pulse space-y-3">
          <div className="h-5 bg-slate-700 rounded w-1/3" />
          <div className="h-12 bg-slate-700 rounded" />
        </div>
      </Card>
    );
  }

  // If market is settled, show veto/finalize options
  if (isSettled) {
    return (
      <>
        <Card className="border-red-500/30 bg-red-500/5">
          <div className="p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-red-400" />
              <h3 className="font-semibold text-white">Guardian Controls</h3>
              <Badge variant="danger" className="text-red-400 bg-red-500/20">
                Guardian
              </Badge>
            </div>

            {/* Current Settlement Display */}
            <div className="bg-slate-800/50 rounded-lg p-4 space-y-3">
              <p className="text-sm text-slate-400">Current Settlement</p>
              <div className="flex items-center gap-3">
                {winningOutcome === 1 ? (
                  <>
                    <div className="p-2 rounded-lg bg-emerald-500/20">
                      <TrendingUp className="w-5 h-5 text-emerald-400" />
                    </div>
                    <span className="text-xl font-bold text-emerald-400">YES</span>
                  </>
                ) : winningOutcome === 2 ? (
                  <>
                    <div className="p-2 rounded-lg bg-rose-500/20">
                      <TrendingDown className="w-5 h-5 text-rose-400" />
                    </div>
                    <span className="text-xl font-bold text-rose-400">NO</span>
                  </>
                ) : (
                  <>
                    <div className="p-2 rounded-lg bg-slate-500/20">
                      <AlertTriangle className="w-5 h-5 text-slate-400" />
                    </div>
                    <span className="text-xl font-bold text-slate-400">INVALID</span>
                  </>
                )}
              </div>
              
              <div className="pt-2 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Settled by:</span>
                  <span className="font-mono text-slate-300 text-xs">
                    {adjudicator?.slice(0, 6)}...{adjudicator?.slice(-4)}
                  </span>
                </div>
              </div>
            </div>

            {/* Veto Section */}
            <div className="bg-slate-500/10 border border-slate-500/30 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-slate-200">Emergency Veto</p>
                  <p className="text-slate-200/70 text-xs mt-1">
                    Only use if the settlement is provably incorrect. This will revert the market 
                    to SETTLING state and allow the adjudicator to re-settle.
                  </p>
                </div>
              </div>
              
              <Button 
                variant="secondary"
                className="w-full border-red-500/50 text-red-400 hover:bg-red-500/20"
                onClick={() => setShowVetoConfirmation(true)}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Veto Settlement
              </Button>
            </div>

            {/* Finalize Section */}
            <div className="bg-slate-800/50 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-slate-300">Finalize Settlement</p>
                  <p className="text-slate-500 text-xs mt-1">
                    Finalization makes the settlement permanent and prevents any future veto.
                  </p>
                </div>
              </div>
              
              <Button 
                variant="primary"
                className="w-full"
                onClick={() => setShowFinalizeConfirmation(true)}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Finalize Settlement
              </Button>
            </div>
          </div>
        </Card>

        {/* Veto Confirmation Modal */}
        {showVetoConfirmation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
            <Card className="max-w-md w-full border-red-500/30">
              <div className="p-6 space-y-4">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-3">
                    <XCircle className="w-8 h-8 text-red-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white">⚠️ EMERGENCY VETO</h3>
                </div>

                <p className="text-center text-slate-400">
                  Are you absolutely sure the settlement is incorrect?
                </p>
                
                <p className="text-center text-sm text-slate-400 bg-slate-500/10 p-3 rounded-lg">
                  This will revert the market to SETTLING state and allow the adjudicator to re-settle.
                </p>

                <div className="flex gap-3">
                  <Button 
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setShowVetoConfirmation(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    variant="primary"
                    className="flex-1 bg-red-600 hover:bg-red-500"
                    onClick={handleVeto}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Processing...
                      </span>
                    ) : (
                      'Confirm Veto'
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Finalize Confirmation Modal */}
        {showFinalizeConfirmation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
            <Card className="max-w-md w-full border-emerald-500/30">
              <div className="p-6 space-y-4">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle className="w-8 h-8 text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Finalize Settlement</h3>
                </div>

                <p className="text-center text-slate-400">
                  This will make the settlement permanent and prevent any future veto.
                </p>
                
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Final Outcome:</span>
                    <span className={`font-bold ${
                      winningOutcome === 1 ? 'text-emerald-400' :
                      winningOutcome === 2 ? 'text-rose-400' : 'text-slate-400'
                    }`}>
                      {winningOutcome === 1 ? 'YES' : winningOutcome === 2 ? 'NO' : 'INVALID'}
                    </span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button 
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setShowFinalizeConfirmation(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    variant="primary"
                    className="flex-1"
                    onClick={handleFinalize}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Processing...
                      </span>
                    ) : (
                      'Confirm Finalize'
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </>
    );
  }

  // Market not yet settled - show waiting state
  return (
    <Card className="border-slate-700">
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-red-400" />
          <h3 className="font-semibold text-white">Guardian Controls</h3>
          <Badge variant="danger" className="text-red-400 bg-red-500/20">
            Guardian
          </Badge>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-4 flex items-center gap-3">
          <Clock className="w-6 h-6 text-slate-500" />
          <div>
            <p className="text-slate-400">Awaiting Settlement</p>
            <p className="text-slate-500 text-sm">
              Guardian controls will be available after the adjudicator settles the market.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
};

