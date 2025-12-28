import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import type { Abi } from "viem";
import { useCallback } from "react";

type Address = `0x${string}`;

// Faster refresh for better UX - data feels more "live"
const DEFAULT_REFETCH_INTERVAL = 8_000; // 8 seconds
const DEFAULT_STALE_TIME = 3_000; // 3 seconds

export function useV8DirectRead<TData>(params: {
  queryKey: readonly unknown[];
  enabled: boolean;
  chainId: number | undefined;
  read: (client: NonNullable<ReturnType<typeof usePublicClient>>) => Promise<TData>;
  refetchInterval?: number;
  staleTime?: number;
}) {
  const { queryKey, enabled, chainId, read, refetchInterval, staleTime } = params;
  const client = usePublicClient({ chainId });

  return useQuery({
    queryKey,
    enabled: enabled && !!client,
    queryFn: async () => {
      return await read(client as NonNullable<typeof client>);
    },
    refetchInterval: refetchInterval ?? DEFAULT_REFETCH_INTERVAL,
    staleTime: staleTime ?? DEFAULT_STALE_TIME,
  });
}

/**
 * Hook to invalidate all V8 queries - call after any transaction
 */
export function useInvalidateV8Queries() {
  const queryClient = useQueryClient();
  
  return useCallback(() => {
    // Invalidate all queries that start with 'v8'
    queryClient.invalidateQueries({ queryKey: ['v8'] });
  }, [queryClient]);
}

export async function readContractSafe<T>(client: any, req: {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
}): Promise<T> {
  return (await client.readContract(req)) as T;
}
