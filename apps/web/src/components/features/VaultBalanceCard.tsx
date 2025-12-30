/**
 * VaultBalanceCard - Displays Vault Balance vs Wallet Balance
 *
 * V9 Architecture: Users have balances in both:
 * - Wallet: Self-custody USDC in their wallet
 * - Vault: USDC deposited in TickBookVault (available + reserved)
 */
import { Wallet, Database, Lock, Zap } from 'lucide-react';
import { formatUnits } from 'viem';
import { useAccount, useReadContract } from 'wagmi';
import { Card } from '../ui/Card';
import { useDeployments } from '../../hooks/useDeployments';
import { useTickBookVault } from '../../hooks';
import { ERC20_ABI } from '../../config/abis';
import { cn } from '../../lib/utils';

type Address = `0x${string}`;

interface VaultBalanceCardProps {
  marketAddress?: Address;
  className?: string;
  compact?: boolean;
}

export const VaultBalanceCard = ({
  marketAddress,
  className,
  compact = false,
}: VaultBalanceCardProps) => {
  const { address: userAddress, isConnected } = useAccount();
  const deployments = useDeployments();
  const usdcAddress = deployments?.contracts?.MockUSDC as Address | undefined;

  // Wallet balance
  const { data: walletBalance } = useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [userAddress!],
    query: {
      enabled: !!userAddress && !!usdcAddress,
      refetchInterval: 15000,
    },
  });

  const { data: decimals } = useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: 'decimals',
    query: {
      enabled: !!usdcAddress,
      staleTime: Infinity,
    },
  });

  // Vault balance
  const { vault, isLoading: isLoadingVault } = useTickBookVault(
    userAddress,
    marketAddress
  );

  if (!isConnected) {
    return null;
  }

  const usdcDecimals = Number(decimals ?? 18);
  const walletUsdc = (walletBalance as bigint | undefined) ?? 0n;
  const walletFormatted = Number(formatUnits(walletUsdc, usdcDecimals)).toFixed(2);

  const availableWad = vault?.availableUsdcWad ?? 0n;
  const reservedWad = vault?.reservedUsdcWad ?? 0n;
  const totalVault = availableWad + reservedWad;
  const vaultFormatted = Number(formatUnits(totalVault, 18)).toFixed(2);
  const availableFormatted = Number(formatUnits(availableWad, 18)).toFixed(2);
  const reservedFormatted = Number(formatUnits(reservedWad, 18)).toFixed(2);

  // Total buying power = wallet + vault available
  const totalPower = Number(walletFormatted) + Number(availableFormatted);

  if (compact) {
    return (
      <div className={cn('flex items-center gap-4 text-xs', className)}>
        <div className="flex items-center gap-1.5">
          <Wallet size={12} className="text-amber-400" />
          <span className="text-slate-500">Wallet:</span>
          <span className="font-mono text-white">${walletFormatted}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Database size={12} className="text-indigo-400" />
          <span className="text-slate-500">Vault:</span>
          <span className="font-mono text-white">${vaultFormatted}</span>
        </div>
      </div>
    );
  }

  return (
    <Card className={cn('p-4 bg-slate-950/50 border-slate-800', className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-amber-400" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Trading Power
          </span>
        </div>
        <span className="text-lg font-mono font-bold text-amber-400">
          ${totalPower.toFixed(2)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Wallet Balance */}
        <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800/50">
          <div className="flex items-center gap-1.5 mb-1">
            <Wallet size={12} className="text-amber-400" />
            <span className="text-[9px] text-slate-500 font-bold uppercase">
              Wallet
            </span>
          </div>
          <div className="text-sm font-mono font-bold text-white">
            ${walletFormatted}
          </div>
        </div>

        {/* Vault Available */}
        <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800/50">
          <div className="flex items-center gap-1.5 mb-1">
            <Database size={12} className="text-indigo-400" />
            <span className="text-[9px] text-slate-500 font-bold uppercase">
              Vault Available
            </span>
          </div>
          <div className="text-sm font-mono font-bold text-white">
            ${availableFormatted}
          </div>
        </div>
      </div>

      {/* Reserved Margin (if any) */}
      {reservedWad > 0n && (
        <div className="mt-3 p-2 rounded-lg bg-indigo-950/20 border border-indigo-500/10">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <Lock size={10} className="text-indigo-400" />
              <span className="text-slate-500">Reserved in Orders</span>
            </div>
            <span className="font-mono text-indigo-300">${reservedFormatted}</span>
          </div>
        </div>
      )}

      {/* Market-specific internal shares */}
      {marketAddress && vault && (vault.yesInternal > 0n || vault.noInternal > 0n) && (
        <div className="mt-3 pt-3 border-t border-slate-800/50">
          <div className="text-[9px] text-slate-500 font-bold uppercase mb-2">
            Internal Shares (This Market)
          </div>
          <div className="flex gap-2">
            {vault.yesInternal > 0n && (
              <div className="flex-1 flex justify-between items-center bg-emerald-950/10 rounded px-2 py-1 border border-emerald-900/20">
                <span className="text-[10px] font-mono text-emerald-500">YES</span>
                <span className="text-[10px] font-mono font-bold text-white">
                  {Number(formatUnits(vault.yesInternal, 18)).toFixed(1)}
                </span>
              </div>
            )}
            {vault.noInternal > 0n && (
              <div className="flex-1 flex justify-between items-center bg-rose-950/10 rounded px-2 py-1 border border-rose-900/20">
                <span className="text-[10px] font-mono text-rose-500">NO</span>
                <span className="text-[10px] font-mono font-bold text-white">
                  {Number(formatUnits(vault.noInternal, 18)).toFixed(1)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
};
