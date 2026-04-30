/**
 * MegaETH Realtime API helpers.
 * Browser-safe, framework-agnostic (viem only).
 * Used by both CLI (Mode B) and Geek mode.
 */

import {
  encodeFunctionData,
  type Abi,
  type Hash,
  type PublicClient,
  type TransactionReceipt,
} from 'viem';

export const MEGAETH_CHAIN_IDS = [4326, 6343] as const;

const MEGAETH_NATIVE_RPC: Record<number, string> = {
  4326: 'https://mainnet.megaeth.com/rpc',
  6343: 'https://carrot.megaeth.com/rpc',
};

export function isMegaethChain(chainId?: number): boolean {
  return chainId === 4326 || chainId === 6343;
}

export function getMegaethNativeRpcUrl(chainId: number): string | undefined {
  return MEGAETH_NATIVE_RPC[chainId];
}

/**
 * Send a signed tx via `realtime_sendRawTransaction`.
 * Returns the receipt in one call — no polling.
 */
export async function realtimeSendRawTransaction(args: {
  rpcUrl: string;
  signedTransaction: `0x${string}`;
}): Promise<TransactionReceipt> {
  const res = await fetch(args.rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'realtime_sendRawTransaction',
      params: [args.signedTransaction],
    }),
  });
  const json = (await res.json()) as {
    result?: any;
    error?: { code: number; message: string };
  };
  if (json.error) {
    throw new Error(`realtime_sendRawTransaction: ${json.error.message}`);
  }
  const r = json.result;
  return {
    transactionHash: r.transactionHash as Hash,
    blockNumber: BigInt(r.blockNumber),
    from: r.from,
    to: r.to ?? null,
    gasUsed: BigInt(r.gasUsed),
    status: r.status === '0x1' ? 'success' : 'reverted',
    logs: r.logs ?? [],
    contractAddress: r.contractAddress ?? null,
    blockHash: '0x' as Hash,
    transactionIndex: 0,
    logsBloom: '0x' as `0x${string}`,
    cumulativeGasUsed: BigInt(r.gasUsed),
    effectiveGasPrice: 0n,
    type: 'eip1559',
  } as TransactionReceipt;
}

export interface WriteContractRealtimeArgs {
  rpcUrl: string;
  publicClient: PublicClient;
  account: {
    address: `0x${string}`;
    signTransaction: (tx: any) => Promise<`0x${string}`>;
  };
  chainId: number;
  request: {
    address: `0x${string}`;
    abi: Abi;
    functionName: string;
    args?: readonly unknown[];
  };
  gas?: bigint;
}

/**
 * Mode B: encode calldata locally, get nonce, sign, send via realtime API.
 * Returns { receipt, sendMs, prepareMs }.
 */
export async function writeContractRealtime(
  args: WriteContractRealtimeArgs,
): Promise<{ receipt: TransactionReceipt; sendMs: number; prepareMs: number }> {
  const prepareStart = performance.now();

  const data = encodeFunctionData({
    abi: args.request.abi,
    functionName: args.request.functionName,
    args: args.request.args as any,
  });

  const nonce = await args.publicClient.getTransactionCount({
    address: args.account.address,
    blockTag: 'pending',
  });

  const signedTx = await args.account.signTransaction({
    to: args.request.address,
    data,
    nonce,
    gas: args.gas ?? 1_500_000n,
    maxFeePerGas: 1_500_000n,
    maxPriorityFeePerGas: 0n,
    chainId: args.chainId,
    type: 'eip1559' as const,
  });

  const prepareMs = Number((performance.now() - prepareStart).toFixed(1));

  const start = performance.now();
  const receipt = await realtimeSendRawTransaction({
    rpcUrl: args.rpcUrl,
    signedTransaction: signedTx,
  });
  const sendMs = Number((performance.now() - start).toFixed(1));

  if (receipt.status === 'reverted') {
    throw new Error(`Transaction reverted: ${receipt.transactionHash.slice(0, 18)}...`);
  }

  return { receipt, sendMs, prepareMs };
}
