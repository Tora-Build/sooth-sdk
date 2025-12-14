// useMarketV4.ts - Fetch market data and probabilities
import { useReadContract, useChainId } from 'wagmi'
import { formatUnits } from 'viem'
import { V4_ABIS } from '../../config/abis/v4-abis'

export function useMarketV4(marketAddress: `0x${string}`) {
    const chainId = useChainId()

    // Price for YES (Probability)
    const { data: priceYes, refetch: refetchPrice } = useReadContract({
        address: marketAddress,
        abi: V4_ABIS.MarketV4,
        functionName: 'price',
        args: [0], // YES
        chainId,
    })

    // Effective liquidity (dynamic b)
    const { data: b } = useReadContract({
        address: marketAddress,
        abi: V4_ABIS.MarketV4,
        functionName: 'b',
        chainId,
    })

    // Base liquidity
    const { data: bBase } = useReadContract({
        address: marketAddress,
        abi: V4_ABIS.MarketV4,
        functionName: 'bBase',
        chainId,
    })

    // Watch for tick updates
    // TODO: Watch for Price updates (TradeAMM event)
    // useWatchContractEvent(...)

    // Calculate probability from price (WAD)
    const probability = priceYes ? Number(formatUnits(priceYes as bigint, 18)) : 0.5

    // Format liquidity
    // Format liquidity
    const liquidity = b ? formatUnits(b as bigint, 18) : '0'
    const baseLiquidity = bBase ? formatUnits(bBase as bigint, 18) : '0'

    return {
        priceYes: priceYes ? formatUnits(priceYes as bigint, 18) : null,
        probability,
        b: b as bigint,
        bBase: bBase as bigint,
        liquidity,
        baseLiquidity,
        refetch: refetchPrice,
    }
}
