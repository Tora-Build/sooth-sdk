// useBalances.ts - Fetch all user balances (USDC, AMM positions, ERC1155 tokens)
import { useReadContract } from 'wagmi'
import { useAccount } from 'wagmi'
import { formatUnits } from 'viem'
import { V4_ABIS } from '../../config/abis/v4-abis'
import { V4_ADDRESSES } from '../../config/v4-addresses'
import { baseSepolia } from 'wagmi/chains'

export function useBalances(marketAddress?: `0x${string}`, outcomeTokenAddress?: `0x${string}`) {
    const { address } = useAccount()

    // USDC balances in TraderVault
    const { data: accounts, refetch: refetchAccounts } = useReadContract({
        address: V4_ADDRESSES.baseSepolia.traderVault as `0x${string}`,
        abi: V4_ABIS.TraderVaultV4,
        functionName: 'accounts',
        args: address ? [address] : undefined,
        chainId: baseSepolia.id,
        query: {
            enabled: !!address,
        },
    })

    // AMM position (locked shares)
    const { data: ammPosition, refetch: refetchAMM } = useReadContract({
        address: V4_ADDRESSES.baseSepolia.traderVault as `0x${string}`,
        abi: V4_ABIS.TraderVaultV4,
        functionName: 'ammPositions',
        args: address && marketAddress ? [address, marketAddress] : undefined,
        chainId: baseSepolia.id,
        query: {
            enabled: !!address && !!marketAddress,
        },
    })

    // ERC1155 YES tokens (id=1)
    const { data: yesTokenBalance } = useReadContract({
        address: outcomeTokenAddress,
        abi: V4_ABIS.OutcomeToken,
        functionName: 'balanceOf',
        args: address ? [address, BigInt(1)] : undefined,
        chainId: baseSepolia.id,
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
        chainId: baseSepolia.id,
        query: {
            enabled: !!address && !!outcomeTokenAddress,
        },
    })

    // Parse accounts data
    const available = accounts ? formatUnits(accounts[0], 18) : '0'
    const pending = accounts ? formatUnits(accounts[1], 18) : '0'

    // Parse AMM position
    const yesShares = ammPosition ? formatUnits(ammPosition[0], 18) : '0'
    const noShares = ammPosition ? formatUnits(ammPosition[1], 18) : '0'
    const unlockTime = ammPosition ? Number(ammPosition[2]) : 0
    const isLocked = unlockTime > Date.now() / 1000

    // Parse ERC1155 balances
    const yesTokens = yesTokenBalance ? formatUnits(yesTokenBalance, 18) : '0'
    const noTokens = noTokenBalance ? formatUnits(noTokenBalance, 18) : '0'

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
