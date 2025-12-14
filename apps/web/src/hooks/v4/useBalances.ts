// useBalances.ts - Fetch all user balances (USDC, AMM positions, ERC1155 tokens)
import { useReadContract, useChainId } from 'wagmi'
import { useAccount } from 'wagmi'
import { formatUnits } from 'viem'
import { V4_ABIS } from '../../config/abis/v4-abis'
import { useDeployments } from '../useDeployments'

export function useBalances(marketAddress?: `0x${string}`, outcomeTokenAddress?: `0x${string}`) {
    const { address } = useAccount()
    const chainId = useChainId()
    const deployments = useDeployments()
    const traderVault = deployments.SoothTraderVault as `0x${string}` | undefined

    // USDC balances in TraderVault
    const { data: accountsData, refetch: refetchAccounts } = useReadContract({
        address: traderVault,
        abi: V4_ABIS.TraderVaultV4,
        functionName: 'accounts',
        args: address ? [address] : undefined,
        chainId,
        query: {
            enabled: !!address && !!traderVault,
        },
    })

    // AMM position (locked shares)
    const { data: ammPositionData, refetch: refetchAMM } = useReadContract({
        address: traderVault,
        abi: V4_ABIS.TraderVaultV4,
        functionName: 'ammPositions',
        args: address && marketAddress ? [address, marketAddress] : undefined,
        chainId,
        query: {
            enabled: !!address && !!marketAddress && !!traderVault,
        },
    })

    // ERC1155 YES tokens (id=1)
    const { data: yesTokenBalance } = useReadContract({
        address: outcomeTokenAddress,
        abi: V4_ABIS.OutcomeToken,
        functionName: 'balanceOf',
        args: address ? [address, BigInt(1)] : undefined,
        chainId,
        query: {
            enabled: !!address && !!outcomeTokenAddress,
        },
    })

    // ERC1155 NO tokens (id=0)
    const { data: noTokenBalance } = useReadContract({
        address: outcomeTokenAddress,
        abi: V4_ABIS.OutcomeToken,
        functionName: 'balanceOf',
        args: address ? [address, BigInt(0)] : undefined,
        chainId,
        query: {
            enabled: !!address && !!outcomeTokenAddress,
        },
    })

    // Parse accounts data
    const accounts = accountsData as [bigint, bigint] | undefined
    const available = accounts ? formatUnits(accounts[0], 18) : '0'
    const pending = accounts ? formatUnits(accounts[1], 18) : '0'

    // Parse AMM position - V4.6: only 2 fields (yesShares, noShares) - no unlockTime
    const ammPosition = ammPositionData as [bigint, bigint] | undefined
    const yesShares = ammPosition ? formatUnits(ammPosition[0], 18) : '0'
    const noShares = ammPosition ? formatUnits(ammPosition[1], 18) : '0'
    const unlockTime = 0  // V4.6 Lock-on-Sell: always 0
    // V4.6 Lock-on-Sell: shares are NEVER locked (only proceeds are locked)
    const isLocked = false; // unlockTime is now 0 for all positions

    // Parse ERC1155 balances
    const yesTokens = yesTokenBalance ? formatUnits(yesTokenBalance as bigint, 18) : '0'
    const noTokens = noTokenBalance ? formatUnits(noTokenBalance as bigint, 18) : '0'

    return {
        // USDC
        available,
        pending,
        availableRaw: accounts?.[0],
        pendingRaw: accounts?.[1],

        // AMM (locked positions)
        yesShares,
        noShares,
        yesSharesRaw: ammPosition?.[0],
        noSharesRaw: ammPosition?.[1],
        unlockTime,
        isLocked,

        // Orderbook (ERC1155)
        yesTokens,
        noTokens,
        yesTokensRaw: yesTokenBalance,
        noTokensRaw: noTokenBalance,

        refetch: () => {
            refetchAccounts()
            refetchAMM()
        },
    }
}
