import { useAccount, useWriteContract } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { maxUint256 } from 'viem';
import { Loader2, Check } from 'lucide-react';
import { useWGHOBalance } from '../hooks/useWGHOBalance';
import { WGHO_ADDRESS, SOOTH_POST_ACTION_ADDRESS, WETH9_ABI } from '../lib/soothAction';

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { isConnected, address } = useAccount();
  const { open } = useAppKit();
  const wgho = useWGHOBalance(address, SOOTH_POST_ACTION_ADDRESS);
  const { writeContract: wrapTx, isPending: isWrapping } = useWriteContract();
  const { writeContract: approveTx, isPending: isApproving } = useWriteContract();

  const step = !isConnected
    ? 1
    : wgho.isLoading
      ? 0
      : (wgho.data?.balance ?? 0n) === 0n
        ? 2
        : (wgho.data?.allowance ?? 0n) === 0n
          ? 3
          : 4;

  if (step === 4) return <>{children}</>;

  const steps = [
    { label: 'Connect Wallet', done: isConnected },
    { label: 'Get WGRASS', done: isConnected && (wgho.data?.balance ?? 0n) > 0n },
    { label: 'Approve WGRASS', done: isConnected && (wgho.data?.allowance ?? 0n) > 0n },
  ];

  return (
    <div className="rounded-2xl bg-[#1f1f20]/80 backdrop-blur-sm border border-[#2d2d2e] p-4 space-y-3">
      <p className="text-sm font-bold text-white tracking-wide">⚡ Setup Required</p>

      <div className="space-y-2">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                s.done
                  ? 'bg-[#00d4aa] text-[#1a1a1b]'
                  : step === i + 1
                    ? 'bg-[#00d4aa]/20 text-[#00d4aa] border border-[#00d4aa]'
                    : 'bg-[#2d2d2e] text-[#666]'
              }`}
            >
              {s.done ? <Check className="w-3 h-3" /> : i + 1}
            </div>
            <span
              className={`text-xs ${
                s.done ? 'text-[#888] line-through' : step === i + 1 ? 'text-white' : 'text-[#666]'
              }`}
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="flex justify-center py-2">
          <Loader2 className="w-5 h-5 text-[#00d4aa] animate-spin" />
        </div>
      )}

      {step === 1 && (
        <button
          onClick={() => open()}
          className="w-full py-2.5 rounded-xl bg-[#00d4aa] text-[#1a1a1b] text-sm font-bold active:scale-95 transition-transform"
        >
          Connect Wallet
        </button>
      )}

      {step === 2 && (
        <div className="space-y-2">
          <a
            href="https://testnet.lens.xyz"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-xs text-[#00d4aa] underline underline-offset-2"
          >
            Get testnet GRASS from faucet →
          </a>
          <button
            onClick={() =>
              wrapTx({
                address: WGHO_ADDRESS,
                abi: WETH9_ABI,
                functionName: 'deposit',
                value: 100000000000000000n,
              })
            }
            disabled={isWrapping}
            className="w-full py-2.5 rounded-xl bg-[#00d4aa] text-[#1a1a1b] text-sm font-bold active:scale-95 transition-transform disabled:opacity-50"
          >
            {isWrapping ? (
              <Loader2 className="w-4 h-4 animate-spin mx-auto" />
            ) : (
              'Wrap 0.1 GRASS'
            )}
          </button>
        </div>
      )}

      {step === 3 && (
        <button
          onClick={() =>
            approveTx({
              address: WGHO_ADDRESS,
              abi: WETH9_ABI,
              functionName: 'approve',
              args: [SOOTH_POST_ACTION_ADDRESS, maxUint256],
            })
          }
          disabled={isApproving}
          className="w-full py-2.5 rounded-xl bg-[#00d4aa] text-[#1a1a1b] text-sm font-bold active:scale-95 transition-transform disabled:opacity-50"
        >
          {isApproving ? (
            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
          ) : (
            'Approve WGRASS'
          )}
        </button>
      )}
    </div>
  );
}