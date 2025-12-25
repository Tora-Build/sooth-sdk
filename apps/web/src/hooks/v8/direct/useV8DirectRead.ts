import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import type { Abi } from "viem";

type Address = `0x${string}`;

export function useV8DirectRead<TData>(params: {
  queryKey: readonly unknown[];
  enabled: boolean;
  chainId: number | undefined;
  read: (client: NonNullable<ReturnType<typeof usePublicClient>>) => Promise<TData>;
}) {
  const { queryKey, enabled, chainId, read } = params;
  const client = usePublicClient({ chainId });

  return useQuery({
    queryKey,
    enabled: enabled && !!client,
    queryFn: async () => {
      return await read(client as NonNullable<typeof client>);
    },
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}

export async function readContractSafe<T>(client: any, req: {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
}): Promise<T> {
  return (await client.readContract(req)) as T;
}
