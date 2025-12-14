// useAMMTrade.ts - Execute AMM trades (Lock-on-Sell deployment)
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseUnits } from 'viem'
import { V4_ABIS } from '../../config/abis/v4-abis'
import { useDeployments } from '../useDeployments'

export function useAMMTrade() {
    const { writeContract, data: hash, isPending, error } = useWriteContract()
    const { config } = useDeployments()
    const deployments = config.contracts
    const traderVault = deployments.SoothTraderVault as `0x${string}` | undefined

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
        if (!traderVault) {
            throw new Error('TraderVault address not found for current chain (check deployments.json)')
        }

        const sharesWad = parseUnits(shares, 18)
        const limitWad = parseUnits(limit, 18)
        const deltaShares = isBuy ? sharesWad : -sharesWad
        const signedLimit = isBuy ? limitWad : -limitWad

        writeContract({
            address: traderVault,
            abi: V4_ABIS.TraderVaultV4,
            functionName: 'tradeAMM',
            args: [
                marketAddress,
                outcome,
                deltaShares,
                signedLimit,
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
