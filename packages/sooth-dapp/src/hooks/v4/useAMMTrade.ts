// useAMMTrade.ts - Execute AMM trades with lock-on-buy
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseUnits } from 'viem'
import { V4_ABIS } from '../../config/abis/v4-abis'
import { V4_ADDRESSES } from '../../config/v4-addresses'

export function useAMMTrade() {
    const { writeContract, data: hash, isPending, error } = useWriteContract()

    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
        hash,
    })

    const executeTrade = async ({
        marketAddress,
        outcome,
        shares,
        limit,
        isBuy,
    }: {
        marketAddress: `0x${string}`
        outcome: 0 | 1 // 0=NO, 1=YES
        shares: string // in ETH units
        limit: string // maxCost or minProceeds in ETH units
        isBuy: boolean
    }) => {
        writeContract({
            address: V4_ADDRESSES.baseSepolia.traderVault as `0x${string}`,
            abi: V4_ABIS.TraderVaultV4,
            functionName: 'executeAMMTrade',
            args: [
                marketAddress,
                outcome,
                parseUnits(shares, 18),
                parseUnits(limit, 18),
                isBuy,
            ],
        })
    }

    return {
        executeTrade,
        isLoading: isPending || isConfirming,
        isSuccess,
        error,
        hash,
    }
}
