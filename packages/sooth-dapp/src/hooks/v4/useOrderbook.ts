// useOrderbook.ts - Place and cancel orderbook limit orders
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseUnits } from 'viem'
import { V4_ABIS } from '../../config/abis/v4-abis'
import { V4_ADDRESSES } from '../../config/v4-addresses'

export function useOrderbook() {
    const { writeContract, data: hash, isPending, error } = useWriteContract()

    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
        hash,
    })

    const placeOrder = async ({
        marketAddress,
        outcome,
        price,
        amount,
    }: {
        marketAddress: `0x${string}`
        outcome: 0 | 1
        price: string // e.g., "0.6" for 60%
        amount: string // in ETH units
    }) => {
        writeContract({
            address: V4_ADDRESSES.baseSepolia.traderVault as `0x${string}`,
            abi: V4_ABIS.TraderVaultV4,
            functionName: 'placeOrder',
            args: [
                marketAddress,
                outcome,
                parseUnits(price, 18),
                parseUnits(amount, 18),
            ],
        })
    }

    const cancelOrder = async ({
        marketAddress,
        orderId,
    }: {
        marketAddress: `0x${string}`
        orderId: bigint
    }) => {
        writeContract({
            address: V4_ADDRESSES.baseSepolia.traderVault as `0x${string}`,
            abi: V4_ABIS.TraderVaultV4,
            function Name: 'cancelOrder',
            args: [marketAddress, orderId],
        })
    }

    return {
        placeOrder,
        cancelOrder,
        isLoading: isPending || isConfirming,
        isSuccess,
        error,
        hash,
    }
}
