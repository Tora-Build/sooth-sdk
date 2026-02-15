import { useState, useCallback, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { parseUnits, formatUnits, type Address, erc20Abi } from 'viem';
import { Loader2, ArrowUpDown, Layers, ArrowRightLeft } from 'lucide-react';
import { SOOTHBOOK_ADDRESS, SOOTHBOOK_ABI } from '../hooks/useSoothBook';

type Tab = 'buy' | 'mint' | 'merge';
type Side = 'yes' | 'no';

interface SoothBookTradePanelProps {
  marketKey: `0x${string}`;
  collateral: Address;
  yesToken: Address;
  noToken: Address;
  selectedSide?: Side;
  selectedTick?: number;
  onSuccess?: () => void;
}

export function SoothBookTradePanel({
  marketKey,
  collateral,
  yesToken,
  noToken,
  selectedSide = 'yes',
  selectedTick,
  onSuccess,
}: SoothBookTradePanelProps) {
  const { address, isConnected } = useAccount();
  const { open: openWallet } = useAppKit();

  const [tab, setTab] = useState<Tab>('buy');
  const [side, setSide] = useState<Side>(selectedSide);
  const [tick, setTick] = useState<string>(selectedTick?.toString() || '500');
  const [amount, setAmount] = useState<string>('100');
  const [escrow, setEscrow] = useState(false);

  // Sync external selections
  useEffect(() => {
    if (selectedTick) setTick(selectedTick.toString());
  }, [selectedTick]);
  useEffect(() => {
    setSide(selectedSide);
  }, [selectedSide]);

  // Balances
  const { data: usdcBal } = useReadContract({
    address: collateral,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: yesBal } = useReadContract({
    address: yesToken,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: noBal } = useReadContract({
    address: noToken,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Allowance
  const { data: allowance } = useReadContract({
    address: collateral,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address ? [address, SOOTHBOOK_ADDRESS] : undefined,
    query: { enabled: !!address },
  });

  const { writeContract, data: txHash, isPending, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isSuccess) {
      onSuccess?.();
      setTimeout(reset, 2000);
    }
  }, [isSuccess, onSuccess, reset]);

  const parsedAmount = parseUnits(amount || '0', 18);
  const tickNum = Math.min(999, Math.max(1, parseInt(tick || '500')));
  const price = tickNum / 1000;
  const cost = (Number(amount || 0) * price);
  const needsApproval = tab === 'buy' && allowance !== undefined && allowance < parsedAmount;

  const handleApprove = useCallback(() => {
    writeContract({
      address: collateral,
      abi: erc20Abi,
      functionName: 'approve',
      args: [SOOTHBOOK_ADDRESS, parsedAmount * 2n],
    });
  }, [writeContract, collateral, parsedAmount]);

  const handleSubmit = useCallback(() => {
    if (!isConnected) { openWallet(); return; }

    if (tab === 'buy') {
      const fn = side === 'yes' ? 'buyYes' : 'buyNo';
      writeContract({
        address: SOOTHBOOK_ADDRESS,
        abi: SOOTHBOOK_ABI,
        functionName: fn,
        args: [marketKey, tickNum, BigInt(parsedAmount), escrow, parsedAmount], // maxCollateral = amount for simplicity
      });
    } else if (tab === 'mint') {
      writeContract({
        address: SOOTHBOOK_ADDRESS,
        abi: SOOTHBOOK_ABI,
        functionName: 'mint',
        args: [marketKey, parsedAmount],
      });
    } else if (tab === 'merge') {
      writeContract({
        address: SOOTHBOOK_ADDRESS,
        abi: SOOTHBOOK_ABI,
        functionName: 'merge',
        args: [marketKey, parsedAmount],
      });
    }
  }, [isConnected, openWallet, tab, side, writeContract, marketKey, tickNum, parsedAmount, escrow]);

  const isLoading = isPending || isConfirming;

  return (
    <div className="bg-[#111113] rounded-2xl border border-[#2a2a2d] overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-[#2a2a2d]">
        {([
          { id: 'buy' as Tab, label: 'Limit Order', icon: ArrowUpDown },
          { id: 'mint' as Tab, label: 'Mint', icon: Layers },
          { id: 'merge' as Tab, label: 'Merge', icon: ArrowRightLeft },
        ]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${
              tab === id
                ? 'text-white border-b-2 border-[#00d4aa] bg-[#00d4aa]/5'
                : 'text-[#555] hover:text-[#888]'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-4">
        {/* Balances */}
        {isConnected && (
          <div className="flex gap-3 text-[10px] font-mono text-[#555]">
            <span>USDC: {usdcBal ? formatUnits(usdcBal, 18) : '0'}</span>
            <span className="text-[#00d4aa]">YES: {yesBal ? fmtBal(yesBal) : '0'}</span>
            <span className="text-[#e01b24]">NO: {noBal ? fmtBal(noBal) : '0'}</span>
          </div>
        )}

        {tab === 'buy' && (
          <>
            {/* Side selector */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSide('yes')}
                className={`py-2.5 rounded-xl font-bold text-sm transition-all ${
                  side === 'yes'
                    ? 'bg-[#00d4aa]/20 text-[#00d4aa] border-2 border-[#00d4aa]'
                    : 'bg-[#1a1a1d] text-[#666] border-2 border-[#2a2a2d] hover:border-[#00d4aa]/50'
                }`}
              >
                Buy YES
              </button>
              <button
                onClick={() => setSide('no')}
                className={`py-2.5 rounded-xl font-bold text-sm transition-all ${
                  side === 'no'
                    ? 'bg-[#e01b24]/20 text-[#e01b24] border-2 border-[#e01b24]'
                    : 'bg-[#1a1a1d] text-[#666] border-2 border-[#2a2a2d] hover:border-[#e01b24]/50'
                }`}
              >
                Buy NO
              </button>
            </div>

            {/* Price (tick) */}
            <div>
              <label className="text-[10px] font-bold text-[#555] uppercase tracking-wider">
                Price (tick {tickNum} = {(price * 100).toFixed(1)}¢)
              </label>
              <input
                type="range"
                min={1}
                max={999}
                value={tickNum}
                onChange={(e) => setTick(e.target.value)}
                className="w-full h-2 mt-2 rounded-full appearance-none cursor-pointer accent-[#00d4aa] bg-[#2a2a2d]"
              />
              <div className="flex justify-between text-[10px] text-[#444] font-mono mt-1">
                <span>0.1¢</span>
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={tick}
                  onChange={(e) => setTick(e.target.value)}
                  className="w-16 bg-[#1a1a1d] border border-[#2a2a2d] rounded px-2 py-0.5 text-center text-white text-xs font-mono focus:outline-none focus:border-[#00d4aa]"
                />
                <span>99.9¢</span>
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="text-[10px] font-bold text-[#555] uppercase tracking-wider">
                Shares
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100"
                className="w-full mt-1 px-4 py-3 bg-[#1a1a1d] border border-[#2a2a2d] rounded-xl text-white text-lg font-mono font-bold focus:outline-none focus:border-[#00d4aa] placeholder:text-[#333]"
              />
            </div>

            {/* Escrow toggle */}
            {side === 'no' && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={escrow}
                  onChange={(e) => setEscrow(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#00d4aa]"
                />
                <span className="text-xs text-[#888]">
                  Escrow (burn YES tokens to cover)
                </span>
              </label>
            )}

            {/* Cost estimate */}
            <div className="bg-[#0d0d0f] rounded-xl p-3 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-[#666]">Max Cost</span>
                <span className="text-white font-mono font-bold">{cost.toFixed(2)} USDC</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#666]">If correct</span>
                <span className="text-[#00d4aa] font-mono font-bold">
                  +{(Number(amount || 0) - cost).toFixed(2)} USDC
                </span>
              </div>
            </div>
          </>
        )}

        {tab === 'mint' && (
          <div className="space-y-3">
            <p className="text-xs text-[#888]">
              Deposit USDC to mint equal YES + NO tokens. Always costs 1 USDC per pair.
            </p>
            <div>
              <label className="text-[10px] font-bold text-[#555] uppercase tracking-wider">Amount</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100"
                className="w-full mt-1 px-4 py-3 bg-[#1a1a1d] border border-[#2a2a2d] rounded-xl text-white text-lg font-mono font-bold focus:outline-none focus:border-[#00d4aa] placeholder:text-[#333]"
              />
            </div>
            <div className="bg-[#0d0d0f] rounded-xl p-3 text-xs text-[#888]">
              You'll receive <span className="text-[#00d4aa] font-bold">{amount || '0'} YES</span> + <span className="text-[#e01b24] font-bold">{amount || '0'} NO</span> tokens
            </div>
          </div>
        )}

        {tab === 'merge' && (
          <div className="space-y-3">
            <p className="text-xs text-[#888]">
              Burn equal YES + NO tokens to redeem USDC. Reverse of minting.
            </p>
            <div>
              <label className="text-[10px] font-bold text-[#555] uppercase tracking-wider">Amount</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100"
                className="w-full mt-1 px-4 py-3 bg-[#1a1a1d] border border-[#2a2a2d] rounded-xl text-white text-lg font-mono font-bold focus:outline-none focus:border-[#00d4aa] placeholder:text-[#333]"
              />
            </div>
            <div className="bg-[#0d0d0f] rounded-xl p-3 text-xs text-[#888]">
              Burns <span className="text-[#00d4aa] font-bold">{amount || '0'} YES</span> + <span className="text-[#e01b24] font-bold">{amount || '0'} NO</span> → receive <span className="text-white font-bold">{amount || '0'} USDC</span>
            </div>
          </div>
        )}

        {/* Action button */}
        <button
          onClick={needsApproval ? handleApprove : handleSubmit}
          disabled={isLoading || !amount || Number(amount) <= 0}
          className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
            isSuccess
              ? 'bg-[#00d4aa] text-black'
              : side === 'yes' || tab !== 'buy'
                ? 'bg-[#00d4aa] text-black hover:bg-[#00e5bb] active:scale-[0.98]'
                : 'bg-[#e01b24] text-white hover:bg-[#f02b34] active:scale-[0.98]'
          } disabled:opacity-40 disabled:hover:scale-100`}
        >
          {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          {isSuccess
            ? '✓ Confirmed'
            : !isConnected
              ? 'Connect Wallet'
              : needsApproval
                ? 'Approve USDC'
                : tab === 'buy'
                  ? `Place ${side.toUpperCase()} Order`
                  : tab === 'mint'
                    ? 'Mint Tokens'
                    : 'Merge Tokens'
          }
        </button>
      </div>
    </div>
  );
}

function fmtBal(val: bigint): string {
  const n = Number(formatUnits(val, 18));
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  if (n >= 1) return n.toFixed(0);
  return n.toFixed(2);
}
