import { useQuery } from '@tanstack/react-query';
import { checkIndexerHealth } from '../lib/indexer';

export function useIndexerHealth() {
    return useQuery({
        queryKey: ['indexerHealth'],
        queryFn: checkIndexerHealth,
        staleTime: 10_000,
        refetchInterval: 30_000,
    });
}
