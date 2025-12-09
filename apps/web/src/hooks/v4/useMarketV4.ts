// useMarketV4.ts - Fetch market data and probabilities
import { useReadContract, useWatchContractEvent } from 'wagmi'
import { formatUnits } from 'viem'
import { V4_ABIS } from '../../config/abis/v4-abis'
import { baseSepolia } from 'wagmi/chains'

export function useMarketV4(marketAddress: `0x${string}`) {
    // Current tick (0-1000)
    const { data: tick, refetch: refetchTick } = useReadContract({
        address: marketAddress,
        abi: V4_ABIS.MarketV4,
        functionName: 'currentTick',
        chainId: baseSepolia.id,
    })

    // Effective liquidity (dynamic b)
    const { data: b } = useReadContract({
        address: marketAddress,
        abi: V4_ABIS.MarketV4,
        functionName: 'b',
        chainId: baseSepolia.id,
    })

    // Base liquidity
    const { data: bBase } = useReadContract({
        address: marketAddress,
        abi: V4_ABIS.MarketV4,
        functionName: 'bBase',
        chainId: baseSepolia.id,
    })

    // Watch for tick updates
    useWatchContractEvent({
        address: marketAddress,
        abi: V4_ABIS.MarketV4,
        eventName: 'TickUpdated',
        chainId: baseSepolia.id,
        onLogs() {
            refetchTick()
        },
    })

    // Calculate probability from tick
    const probability = tick ? Number(tick) / 1000 : 0.5

    // Format liquidity
    const liquidity = b ? formatUnits(b, 18) : '0'
    const baseLiquidity = bBase ? formatUnits(bBase, 18) : '0'

    return {
        tick: tick ? Number(tick) : null,
        probability,
        b,
        bBase,
        liquidity,
        baseLiquidity,
        refetch: refetchTick,
    }
}
