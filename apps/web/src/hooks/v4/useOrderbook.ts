// useOrderbook.ts - Place and cancel orderbook limit orders
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseUnits } from 'viem'
import { V4_ABIS } from '../../config/abis/v4-abis'
import { useDeployments } from '../useDeployments'

export function useOrderbook() {
    const { writeContract, data: hash, isPending, error } = useWriteContract()
    const { config } = useDeployments()
    const deployments = config.contracts
    const traderVault = deployments.SoothTraderVault as `0x${string}` | undefined

    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
        hash,
    })

    const placeOrder = async ({
        marketAddress,
        outcome,
        price,
        amount,
        isBuy,
    }: {
        marketAddress: `0x${string}`
        outcome: 0 | 1
        price: string // e.g., "0.6" for 60%
        amount: string // in ETH units
        isBuy: boolean
    }) => {
        if (!traderVault) {
            throw new Error('TraderVault address not found for current chain (check deployments.json)')
        }

        writeContract({
            address: traderVault,
            abi: V4_ABIS.TraderVaultV4,
            functionName: 'placeOrder',
            args: [
                marketAddress,
                outcome,
                parseUnits(price, 18),
                parseUnits(amount, 18),
                isBuy,
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
        if (!traderVault) {
            throw new Error('TraderVault address not found for current chain (check deployments.json)')
        }

        writeContract({
            address: traderVault,
            abi: V4_ABIS.TraderVaultV4,
            functionName: 'cancelOrder',
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
