import { useAccount } from "wagmi";
import { Card } from "../components/ui/Card";
import { useActivePositions, useLPPositions } from "../hooks";

export const Portfolio = () => {
  const { isConnected } = useAccount();
  const { positions: activePositions = [], isLoading: loadingPositions } = useActivePositions();
  const { positions: lpPositions = [], isLoading: loadingLp } = useLPPositions();

  if (!isConnected) {
    return (
      <Card className="p-8 text-center bg-slate-900/60 border-slate-800">
        <h2 className="text-lg font-semibold text-white mb-2">Connect Wallet</h2>
        <p className="text-sm text-slate-400">Connect your wallet to view your SoothBook and AMM positions.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-slate-900/60 border-slate-800">
        <h2 className="text-lg font-semibold text-white">Portfolio Overview</h2>
        <p className="text-sm text-slate-400 mt-1">Track your active market positions and LP exposure.</p>
      </Card>

      <Card className="p-6 bg-slate-900/60 border-slate-800">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">Active Positions</h3>
          <span className="text-xs font-mono text-slate-400">{loadingPositions ? "..." : activePositions.length}</span>
        </div>
      </Card>

      <Card className="p-6 bg-slate-900/60 border-slate-800">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">LP Positions</h3>
          <span className="text-xs font-mono text-slate-400">{loadingLp ? "..." : lpPositions.length}</span>
        </div>
      </Card>
    </div>
  );
};
