import { useState, useCallback } from 'react';
import {
  encodeFunctionData,
  erc20Abi,
  maxUint256,
  type Address,
  type WalletClient,
} from 'viem';
import { executePostAction } from '@lens-protocol/client/actions';
import { handleOperationWith } from '@lens-protocol/client/viem';
import { postId as lensPostId, evmAddress, type SessionClient } from '@lens-protocol/client';
import {
  PARAM_KEYS,
  ACTION,
  encodeUint256Param,
  encodeUint8Param,
  SOOTH_POST_ACTION_ADDRESS,
  WGHO_ADDRESS,
  ACTION_HUB_ADDRESS,
  ERC20_ABI,
  lensPublicClient,
} from '../lib/soothAction';

export type TradeAction = 'buy' | 'sell' | 'resolve' | 'redeem';
export type TradeStatus = 'idle' | 'approving' | 'executing' | 'success' | 'error';

export interface TradeParams {
  postIdStr: string;
  action: TradeAction;
  outcome?: number;
  shares?: bigint;
  maxCost?: bigint;
  sessionClient: SessionClient;
  lensAccount: string;
  walletClient: WalletClient;
}

export interface UseSoothTradeResult {
  status: TradeStatus;
  error: string | null;
  txHash: string | null;
  executeTrade: (params: TradeParams) => Promise<void>;
  reset: () => void;
}

const EXECUTE_TX_ABI = [
  {
    name: 'executeTransaction',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [],
  },
] as const;

export function useSoothTrade(): UseSoothTradeResult {
  const [status, setStatus] = useState<TradeStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setTxHash(null);
  }, []);

  const executeTrade = useCallback(async (params: TradeParams) => {
    const { postIdStr, action, outcome, shares, maxCost, sessionClient, lensAccount, walletClient } = params;

    setStatus('approving');
    setError(null);
    setTxHash(null);

    try {
      // Step 1: Check and handle WGHO approval (for buy/sell)
      if (action === 'buy' || action === 'sell') {
        const allowance = await lensPublicClient.readContract({
          address: WGHO_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [lensAccount as Address, ACTION_HUB_ADDRESS],
        }) as bigint;

        const needsApproval = action === 'buy'
          ? allowance < (maxCost ?? 0n)
          : allowance === 0n;

        if (needsApproval) {
          const approveData = encodeFunctionData({
            abi: erc20Abi,
            functionName: 'approve',
            args: [ACTION_HUB_ADDRESS, maxUint256],
          });

          await walletClient.writeContract({
            chain: walletClient.chain ?? null,
            account: walletClient.account!,
            address: lensAccount as Address,
            abi: EXECUTE_TX_ABI,
            functionName: 'executeTransaction',
            args: [WGHO_ADDRESS, 0n, approveData],
          });
        }
      }

      // Step 2: Build params for executePostAction
      setStatus('executing');

      type RawParam = { key: `0x${string}`; data: `0x${string}` };
      const actionParams: RawParam[] = [];

      if (action === 'buy') {
        actionParams.push({ key: PARAM_KEYS.ACTION, data: encodeUint8Param(ACTION.BUY) });
        actionParams.push({ key: PARAM_KEYS.OUTCOME, data: encodeUint8Param(outcome ?? 1) });
        actionParams.push({ key: PARAM_KEYS.AMOUNT, data: encodeUint256Param(shares ?? 0n) });
        actionParams.push({ key: PARAM_KEYS.MAX_COST, data: encodeUint256Param(maxCost ?? 0n) });
      } else if (action === 'sell') {
        actionParams.push({ key: PARAM_KEYS.ACTION, data: encodeUint8Param(ACTION.SELL) });
        actionParams.push({ key: PARAM_KEYS.OUTCOME, data: encodeUint8Param(outcome ?? 1) });
        actionParams.push({ key: PARAM_KEYS.AMOUNT, data: encodeUint256Param(shares ?? 0n) });
      } else if (action === 'resolve') {
        actionParams.push({ key: PARAM_KEYS.ACTION, data: encodeUint8Param(ACTION.RESOLVE) });
        actionParams.push({ key: PARAM_KEYS.OUTCOME, data: encodeUint8Param(outcome ?? 1) });
      } else {
        // redeem
        actionParams.push({ key: PARAM_KEYS.ACTION, data: encodeUint8Param(ACTION.REDEEM) });
      }

      // Step 3: Execute via Lens SDK
      const result = await executePostAction(sessionClient, {
        post: lensPostId(postIdStr),
        action: {
          unknown: {
            address: evmAddress(SOOTH_POST_ACTION_ADDRESS),
            params: actionParams,
          },
        },
      });

      const signAndSubmit = handleOperationWith(walletClient);
      type SignAndSubmitInput = Parameters<typeof signAndSubmit>[0];
      const txResult = await signAndSubmit(result as unknown as SignAndSubmitInput);

      if (txResult.isErr()) {
        throw new Error(txResult.error.message ?? 'Transaction failed');
      }

      setTxHash(txResult.value as string);
      setStatus('success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Trade failed';
      setError(message);
      setStatus('error');
    }
  }, []);

  return { status, error, txHash, executeTrade, reset };
}
