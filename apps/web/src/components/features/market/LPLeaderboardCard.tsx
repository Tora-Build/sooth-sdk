// LPLeaderboardCard.tsx - Shows LP leaderboard with all LP holders
import React, { useState, useMemo } from 'react';
import { Coins, HelpCircle } from 'lucide-react';
import { Card } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { formatUnits } from 'viem';
import { formatCurrency } from '../../../utils/format';
import { useLPHolders } from '../../../hooks/v5/useLPHolders';
import uiContent from '../../../config/ui-content.json';

interface LPHolder {
  address: `0x${string}`;
  balance: bigint;
}

interface LPLeaderboardCardProps {
  marketAddress?: `0x${string}`;
  userAddress?: `0x${string}`;
  userLpBalance?: bigint;
  userLpNetValue: bigint;
  userLpCeilingValue: bigint;
  userSharePercent: number;
  isLive?: boolean;
  redeemLP: (amount: bigint) => void;
  isRedeemLPPending: boolean;
  creatorAddress?: `0x${string}`;
  creatorLpBalance?: bigint;
  totalSupply?: bigint;
  totalAssets?: bigint;
  totalNetAssets?: bigint;
  totalLockedProceeds?: bigint;
  ammCashProp?: bigint;
  pureFloorProp?: bigint;
  pureCeilingProp?: bigint;
  decimals?: number;
}

export const LPLeaderboardCard: React.FC<LPLeaderboardCardProps> = ({
  marketAddress,
  userAddress,
  userLpBalance,
  userLpNetValue,
  userLpCeilingValue,
  userSharePercent,
  isLive,
  redeemLP,
  isRedeemLPPending,
  creatorAddress,
  creatorLpBalance,
  totalSupply,
  totalAssets,
  totalNetAssets,
  totalLockedProceeds,
  ammCashProp,
  pureFloorProp,
  pureCeilingProp,
  decimals,
}) => {
  const [showHelp, setShowHelp] = useState(false);
  const t = uiContent.lp;
  
  const { holders, isLoading: isLoadingHolders } = useLPHolders(marketAddress, creatorAddress);
  
  const hasUserPosition = userAddress && userLpBalance !== undefined && userLpBalance > 0n;
  const isUserCreator = userAddress && creatorAddress && userAddress.toLowerCase() === creatorAddress.toLowerCase();

  const ASSET_DECIMALS = decimals || 18;
  const WAD_DECIMALS = 18;
  const LP_TOKEN_DECIMALS = 18;

  const calcNetValue = (balance: bigint) => {
    if (!totalSupply || totalSupply === 0n || !pureFloorProp) return 0n;
    return (balance * pureFloorProp) / totalSupply;
  };
  const calcCeilingValue = (balance: bigint) => {
    if (!totalSupply || totalSupply === 0n || !pureCeilingProp) return 0n;
    return (balance * pureCeilingProp) / totalSupply;
  };
  const calcShare = (balance: bigint) => {
    if (!totalSupply || totalSupply === 0n) return 0;
    return Number((balance * 10000n) / totalSupply) / 100;
  };
  
  const allHolders = useMemo(() => {
    const holderMap = new Map<string, bigint>();
    holders.forEach(h => {
      holderMap.set(h.address.toLowerCase(), h.balance);
    });
    if (creatorAddress && creatorLpBalance !== undefined) {
      holderMap.set(creatorAddress.toLowerCase(), creatorLpBalance);
    }
    return Array.from(holderMap.entries())
      .map(([address, balance]) => ({
        address: address as `0x${string}`,
        balance,
      }))
      .filter(h => h.balance > 0n)
      .sort((a, b) => (b.balance > a.balance ? 1 : -1));
  }, [holders, creatorAddress, creatorLpBalance]);

  const LeaderboardRow = ({ address, balance, isCreatorRow, isYou }: { address: string; balance: bigint; isCreatorRow?: boolean; isYou?: boolean; }) => {
    const share = calcShare(balance);
    const netVal = calcNetValue(balance);
    const ceilingVal = calcCeilingValue(balance);
    return (
      <div className={`flex items-center justify-between py-2.5 px-3 rounded-lg border transition-colors ${isYou ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-800/30 border-slate-700/30'}`}>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-slate-300 truncate font-medium">{address.slice(0, 6)}...{address.slice(-4)}</span>
            {isCreatorRow && <Badge className="text-[8px] bg-amber-500/20 text-amber-400 border-amber-500/50 py-0 px-1.5 h-4">Creator</Badge>}
            {isYou && <Badge className="text-[8px] bg-emerald-500/20 text-emerald-400 border-emerald-500/50 py-0 px-1.5 h-4">You</Badge>}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
            <span className="text-slate-400">{parseFloat(formatUnits(balance, LP_TOKEN_DECIMALS)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} LP</span>
            <span className="opacity-30">•</span>
            <span className="text-emerald-500/70 font-bold">{share.toFixed(1)}%</span>
          </div>
        </div>
        <div className="flex flex-col items-end text-right min-w-[100px]">
          <div className="text-[11px] font-mono font-bold text-emerald-400">{formatCurrency(parseFloat(formatUnits(netVal, ASSET_DECIMALS)))}</div>
          <div className="text-[9px] font-mono text-slate-500 mt-0.5">{formatCurrency(parseFloat(formatUnits(ceilingVal, ASSET_DECIMALS)))}</div>
        </div>
      </div>
    );
  };

  return (
    <Card className="p-4 border-emerald-500/20 bg-slate-900/40">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-white flex items-center gap-2 text-sm">
          <Coins className="w-4 h-4 text-emerald-400" />
          {t.holders || 'LP Holders'}
        </h3>
        <div className="flex items-center gap-2">
          {hasUserPosition && !isLive && <Badge className="text-[10px] bg-emerald-500/20 text-emerald-400 border-emerald-500/50">Redeemable</Badge>}
          <button onClick={() => setShowHelp(!showHelp)} className={`p-1 rounded transition-colors ${showHelp ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-500 hover:text-emerald-400'}`}><HelpCircle className="w-4 h-4" /></button>
        </div>
      </div>

      {showHelp && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 mb-3 text-xs text-slate-300 space-y-1">
          <p>• <strong>{t.floor}</strong>: {t.floorDescription}</p>
          <p>• <strong>{t.ceiling}</strong>: {t.ceilingDescription}</p>
          <p>• <strong>Fair Minting</strong>: {t.fairMintingDescription}</p>
        </div>
      )}

      <div className="flex items-center justify-between px-3 pb-2 mb-1 text-[10px] text-slate-500 font-bold uppercase tracking-widest border-b border-slate-800/50">
        <span>LP Holder / Share</span>
        <div className="text-right"><span>{t.floor} / {t.ceiling}</span></div>
      </div>

      <div className="space-y-1 mb-3 max-h-48 overflow-y-auto">
        {isLoadingHolders ? (
          <div className="text-center py-4 text-xs text-slate-500 font-mono">{uiContent.common.loadingHolders}</div>
        ) : allHolders.length > 0 ? (
          allHolders.map((holder) => (
            <LeaderboardRow
              key={holder.address}
              address={holder.address}
              balance={holder.balance}
              isCreatorRow={creatorAddress?.toLowerCase() === holder.address.toLowerCase()}
              isYou={userAddress?.toLowerCase() === holder.address.toLowerCase()}
            />
          ))
        ) : (
          <div className="text-center py-4 text-xs text-slate-500 font-mono">{uiContent.common.noHolders}</div>
        )}
      </div>

      {hasUserPosition && (
        <div className="pt-4 border-t border-slate-800 space-y-4">
          <div className="bg-emerald-500/5 rounded-xl p-3 border border-emerald-500/10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex flex-col">
                <span className="text-[10px] text-emerald-500/70 font-black uppercase tracking-widest leading-none mb-1.5">{isUserCreator ? t.creatorFloor : t.yourFloor}</span>
                <span className="font-mono font-bold text-emerald-400 text-xl leading-none">{formatCurrency(parseFloat(formatUnits(userLpNetValue, ASSET_DECIMALS)))}</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none mb-1.5">{t.ceilingValue}</span>
                <span className="font-mono font-bold text-slate-300 text-base leading-none">{formatCurrency(parseFloat(formatUnits(userLpCeilingValue, ASSET_DECIMALS)))}</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-2 border-t border-slate-800/50">
              <span>Position: {parseFloat(formatUnits(userLpBalance || 0n, LP_TOKEN_DECIMALS)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} LP</span>
              <span className="text-emerald-500/50 font-bold">{userSharePercent.toFixed(1)}% Share</span>
            </div>
          </div>
          {!isLive && (
            <Button onClick={() => redeemLP(userLpBalance!)} disabled={isRedeemLPPending} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest text-[10px] py-2.5 shadow-lg shadow-emerald-900/20">
              {isRedeemLPPending ? 'Redeeming...' : `Redeem LP ${t.floor}`}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
};
