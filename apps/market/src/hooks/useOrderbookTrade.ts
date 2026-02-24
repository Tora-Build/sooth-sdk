import { useCallback, useState } from 'react';
import {
  useAccount,
  usePublicClient,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi';
import {
  type Address,
  encodePacked,
  isAddress,
  keccak256,
  maxUint256,
  parseUnits,
} from 'viem';
import toast from 'react-hot-toast';
import { SOOTH_BOOK_ABI, ERC20_ABI } from '../config/abis';
import { getDeployment } from '../config/deployments';

export interface TradeHookState {
  isPending: boolean;
  error: string | null;
  txHash: string | null;
}

const CHAIN_ID = 84532;

// USDC 6 decimals → WAD 18 decimals: multiply by 1e12
const toWad = (usdcAmount: string): bigint => {
  const usdcWei = parseUnits(usdcAmount, 6);
  return usdcWei * 1_000_000_000_000n;
};

function computeMarketKey(marketAddress: Address): `0x${string}` {
  return keccak256(encodePacked(['address'], [marketAddress]));
}

function normalizeError(error: unknown): string {
  if (!(error instanceof Error)) return 'Transaction failed';
  const msg = error.message;
  if (msg.includes('User rejected') || msg.includes('user denied')) {
    return 'Transaction rejected in wallet.';
  }
  const reasonMatch = msg.match(/reverted with the following reason:\s*([^\n]+)/i);
  if (reasonMatch?.[1]) return reasonMatch[1].trim();
  return msg.split('\n')[0]?.trim() || 'Transaction failed';
}

export function useOrderbookTrade(marketAddress?: string) {
  const { address: userAddress } = useAccount();
  const publicClient = usePublicClient();
  const deployment = getDeployment(CHAIN_ID);
  const soothBookAddress = deployment?.SoothBook as Address | undefined;
  const usdcAddress = deployment?.MockUSDC as Address | undefined;

  const { writeContractAsync, data: txHash, isPending: isWritePending } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  });

  const [state, setState] = useState<TradeHookState>({
    isPending: false,
    error: null,
    txHash: null,
  });

  const marketKey =
    marketAddress && isAddress(marketAddress as Address)
      ? computeMarketKey(marketAddress as Address)
      : undefined;

  const execWrite = useCallback(
    async (
      label: string,
      address: Address,
      abi: typeof SOOTH_BOOK_ABI | typeof ERC20_ABI,
      functionName: string,
      args: readonly unknown[],
    ): Promise<boolean> => {
      if (!userAddress || !publicClient) {
        toast.error('Connect wallet first');
        return false;
      }

      setState({ isPending: true, error: null, txHash: null });
      const toastId = toast.loading(label);

      try {
        const hash = await writeContractAsync({
          address,
          abi: abi as never,
          functionName: functionName as never,
          args: args as never,
        });

        await publicClient.waitForTransactionReceipt({ hash });
        setState({ isPending: false, error: null, txHash: hash });
        toast.success('Transaction confirmed', { id: toastId });
        return true;
      } catch (error: unknown) {
        const message = normalizeError(error);
        setState({ isPending: false, error: message, txHash: null });
        toast.error(message, { id: toastId });
        return false;
      }
    },
    [publicClient, userAddress, writeContractAsync],
  );

  const buyYes = useCallback(
    async (tick: number, amount: string, escrow: boolean, maxCost: string) => {
      if (!soothBookAddress || !marketKey) {
        toast.error('Market or SoothBook unavailable');
        return;
      }
      const wadAmount = toWad(amount);
      const maxCostWad = toWad(maxCost);
      await execWrite(
        'Placing YES order...',
        soothBookAddress,
        SOOTH_BOOK_ABI,
        'buyYes',
        [marketKey, tick, wadAmount, escrow, maxCostWad],
      );
    },
    [execWrite, marketKey, soothBookAddress],
  );

  const buyNo = useCallback(
    async (tick: number, amount: string, escrow: boolean, maxCost: string) => {
      if (!soothBookAddress || !marketKey) {
        toast.error('Market or SoothBook unavailable');
        return;
      }
      const wadAmount = toWad(amount);
      const maxCostWad = toWad(maxCost);
      await execWrite(
        'Placing NO order...',
        soothBookAddress,
        SOOTH_BOOK_ABI,
        'buyNo',
        [marketKey, tick, wadAmount, escrow, maxCostWad],
      );
    },
    [execWrite, marketKey, soothBookAddress],
  );

  const mint = useCallback(
    async (amount: string) => {
      if (!soothBookAddress || !marketKey) {
        toast.error('Market or SoothBook unavailable');
        return;
      }
      const wadAmount = toWad(amount);
      await execWrite(
        'Minting YES+NO tokens...',
        soothBookAddress,
        SOOTH_BOOK_ABI,
        'mint',
        [marketKey, wadAmount],
      );
    },
    [execWrite, marketKey, soothBookAddress],
  );

  const merge = useCallback(
    async (amount: string) => {
      if (!soothBookAddress || !marketKey) {
        toast.error('Market or SoothBook unavailable');
        return;
      }
      const wadAmount = toWad(amount);
      await execWrite(
        'Merging YES+NO tokens...',
        soothBookAddress,
        SOOTH_BOOK_ABI,
        'merge',
        [marketKey, wadAmount],
      );
    },
    [execWrite, marketKey, soothBookAddress],
  );

  const cancel = useCallback(
    async (side: 0 | 1, tick: number) => {
      if (!soothBookAddress || !marketKey) {
        toast.error('Market or SoothBook unavailable');
        return;
      }
      await execWrite(
        'Cancelling order...',
        soothBookAddress,
        SOOTH_BOOK_ABI,
        'cancel',
        [marketKey, side, tick],
      );
    },
    [execWrite, marketKey, soothBookAddress],
  );

  const redeem = useCallback(async () => {
    if (!soothBookAddress || !marketKey) {
      toast.error('Market or SoothBook unavailable');
      return;
    }
    await execWrite(
      'Redeeming payout...',
      soothBookAddress,
      SOOTH_BOOK_ABI,
      'redeem',
      [marketKey],
    );
  }, [execWrite, marketKey, soothBookAddress]);

  const approve = useCallback(
    async (amount: string) => {
      if (!usdcAddress || !soothBookAddress) {
        toast.error('USDC or SoothBook address unavailable');
        return;
      }
      const approveAmount = amount === 'max' ? maxUint256 : parseUnits(amount, 6);
      await execWrite(
        'Approving USDC...',
        usdcAddress,
        ERC20_ABI,
        'approve',
        [soothBookAddress, approveAmount],
      );
    },
    [execWrite, soothBookAddress, usdcAddress],
  );

  return {
    buyYes,
    buyNo,
    mint,
    merge,
    cancel,
    redeem,
    approve,
    state: {
      ...state,
      isPending: state.isPending || isWritePending || isConfirming,
    },
  };
}
