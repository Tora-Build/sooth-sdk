import { useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { LAUNCHPAD_MARKET_ABI, TRADER_VAULT_V4_ABI, LAUNCHPAD_OUTCOME_TOKEN_ABI } from '../../config/abis';
import { useAccount } from 'wagmi';
import { useCallback, useEffect, useMemo } from 'react';
import { useChainStore } from '../../store/useChainStore';
import { getDeployments } from '../useDeployments';
import { formatUnits } from 'viem';

export function useLaunchpadMarket(marketAddress?: `0x${string}`) {
    const { address: userAddress } = useAccount();
    const { selectedChainId } = useChainStore();
    const deployments = getDeployments(Number(selectedChainId));
    const traderVaultAddr = deployments?.SoothTraderVault as `0x${string}` | undefined;

    // Writes
    const { writeContract: graduateWrite, data: graduateTxHash, isPending: isGraduatePending } = useWriteContract();
    const { writeContract: expireWrite, data: expireTxHash, isPending: isExpirePending } = useWriteContract();
    const { writeContract: refundWrite, data: refundTxHash, isPending: isRefundPending } = useWriteContract();
    const { writeContract: redeemLPWrite, data: redeemLPTxHash, isPending: isRedeemLPPending } = useWriteContract();

    // Wait for transactions
    const { isLoading: isGraduateConfirming, isSuccess: isGraduateSuccess } = useWaitForTransactionReceipt({ hash: graduateTxHash });
    const { isLoading: isRedeemLPConfirming, isSuccess: isRedeemLPSuccess } = useWaitForTransactionReceipt({ hash: redeemLPTxHash });

    // Reads - Phase 1: Market Core Data
    const { data: marketData, refetch } = useReadContracts({
        contracts: [
            { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'isGraduated', chainId: Number(selectedChainId) },
            { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'graduationThreshold', chainId: Number(selectedChainId) },
            { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'bBase', chainId: Number(selectedChainId) },
            { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'deadline', chainId: Number(selectedChainId) },
            { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'creator', chainId: Number(selectedChainId) },
            { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'isLive', chainId: Number(selectedChainId) },
            { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'feesAccrued', chainId: Number(selectedChainId) },
            { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'outcomeToken', chainId: Number(selectedChainId) },
            { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'totalCreatorDeposit', chainId: Number(selectedChainId) },
            { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'totalLockedProceeds', chainId: Number(selectedChainId) },
            { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'totalSupply', chainId: Number(selectedChainId) },
            { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'totalAssets', chainId: Number(selectedChainId) },
            { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'totalNetAssets', chainId: Number(selectedChainId) },
            { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'ammAssets', chainId: Number(selectedChainId) },
            { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'pureCeilingAssets', chainId: Number(selectedChainId) },
            { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'b', chainId: Number(selectedChainId) },
            { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'reserve', chainId: Number(selectedChainId) },
            { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'qYes', chainId: Number(selectedChainId) },
            { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'qNo', chainId: Number(selectedChainId) },
            { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'isUnderwater', chainId: Number(selectedChainId) },
            { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'isSettled', chainId: Number(selectedChainId) },
            { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'feeLMSR', chainId: Number(selectedChainId) },
            // User-specific reads (LP related only)
            ...(userAddress && traderVaultAddr ? [
                { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'lockedProceeds', args: [userAddress], chainId: Number(selectedChainId) },
                { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'balanceOf', args: [userAddress], chainId: Number(selectedChainId) },
                // Vault liquid balances
                { address: traderVaultAddr, abi: TRADER_VAULT_V4_ABI, functionName: 'shareBalances', args: [userAddress, marketAddress, 0], chainId: Number(selectedChainId) },
                { address: traderVaultAddr, abi: TRADER_VAULT_V4_ABI, functionName: 'shareBalances', args: [userAddress, marketAddress, 1], chainId: Number(selectedChainId) },
                // Vault locked balances
                { address: traderVaultAddr, abi: TRADER_VAULT_V4_ABI, functionName: 'ammPositions', args: [userAddress, marketAddress], chainId: Number(selectedChainId) },
            ] : userAddress ? [
                { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'lockedProceeds', args: [userAddress], chainId: Number(selectedChainId) },
                { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'balanceOf', args: [userAddress], chainId: Number(selectedChainId) },
            ] : []),
        ],
        query: {
            enabled: !!marketAddress,
            refetchInterval: 5000 
        }
    });

    const [
        isGraduated, graduationThreshold, bBase, deadline, creator,
        isLive, feesAccrued, outcomeToken, totalCreatorDeposit,
        totalLockedProceeds, totalSupply, totalAssets, totalNetAssets,
        ammCash, pureCeiling, bEffective, ammReserve, qYes, qNo,
        isUnderwater, isSettled, feeData, lockedProceeds, userLpBalance,
        // New: Vault Positions
        liqYes, liqNo, ammPos
    ] = marketData?.map(r => r.result) || [];

    // Extract AMM position (TraderVault - legacy locked positions)
    const ammPosTyped = ammPos as [bigint, bigint] | undefined;
    const lockYes = ammPosTyped?.[0] || 0n;
    const lockNo = ammPosTyped?.[1] || 0n;
    
    // Extract Orderbook balances (TraderVault - liquid positions)
    const liquidYes = (liqYes as bigint) || 0n;
    const liquidNo = (liqNo as bigint) || 0n;

    // Phase 2: Fetch Wallet positions (AMM IS WALLET ONLY)
    const outcomeTokenAddress = outcomeToken as `0x${string}` | undefined;
    const { data: userData } = useReadContracts({
        contracts: outcomeTokenAddress && userAddress ? [
            // Wallet Balances
            { address: outcomeTokenAddress, abi: LAUNCHPAD_OUTCOME_TOKEN_ABI, functionName: 'balanceOf', args: [userAddress, 0n], chainId: Number(selectedChainId) }, // YES
            { address: outcomeTokenAddress, abi: LAUNCHPAD_OUTCOME_TOKEN_ABI, functionName: 'balanceOf', args: [userAddress, 1n], chainId: Number(selectedChainId) }, // NO
            // Outcome Token Supply
            { address: outcomeTokenAddress, abi: LAUNCHPAD_OUTCOME_TOKEN_ABI, functionName: 'totalSupply', args: [0n], chainId: Number(selectedChainId) },
            { address: outcomeTokenAddress, abi: LAUNCHPAD_OUTCOME_TOKEN_ABI, functionName: 'totalSupply', args: [1n], chainId: Number(selectedChainId) },
            // Creator balance if needed
            ...(creator ? [{ address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'balanceOf', args: [creator as `0x${string}`], chainId: Number(selectedChainId) }] : [])
        ] : [],
        query: {
            enabled: !!outcomeTokenAddress,
            refetchInterval: 5000 
        }
    });

    const userYesWallet = userData?.[0]?.result as bigint | undefined;
    const userNoWallet = userData?.[1]?.result as bigint | undefined;
    const totalSupplyYes = userData?.[2]?.result as bigint | undefined;
    const totalSupplyNo = userData?.[3]?.result as bigint | undefined;
    const creatorLpBalance = (creator ? userData?.[4]?.result as bigint | undefined : undefined);

    // Pure AMM Ledger values
    const pureAmmData = useMemo(() => {
        const supply = totalSupply as bigint | undefined;
        const balance = userLpBalance as bigint | undefined;
        const floorTVL = totalNetAssets as bigint | undefined;
        const ceilingTVL = pureCeiling as bigint | undefined;

        if (!supply || supply === 0n || floorTVL === undefined || ceilingTVL === undefined) {
            return { userLpNetValue: 0n, userLpCeilingValue: 0n };
        }

        const userLpNetValue = balance ? (balance * floorTVL) / supply : 0n;
        const userLpCeilingValue = balance ? (balance * ceilingTVL) / supply : 0n;

        return { userLpNetValue, userLpCeilingValue };
    }, [totalSupply, totalNetAssets, pureCeiling, userLpBalance]);

    const { userLpNetValue, userLpCeilingValue } = pureAmmData;

    // Prices
    const prices = useMemo(() => {
        const qY = qYes ? Number(formatUnits(qYes as bigint, 18)) : 0;
        const qN = qNo ? Number(formatUnits(qNo as bigint, 18)) : 0;
        const b = bEffective ? Number(formatUnits(bEffective as bigint, 18)) : 1000;

        let priceYes = 0.5;
        if (b > 0) {
            const maxQ = Math.max(qY, qN);
            const expY = Math.exp((qY - maxQ) / b);
            const expN = Math.exp((qN - maxQ) / b);
            priceYes = expY / (expY + expN);
        }
        return { priceYes, priceNo: 1 - priceYes };
    }, [qYes, qNo, bEffective]);

    const userSharePercent = useMemo(() => {
        const balance = userLpBalance as bigint | undefined;
        const supply = totalSupply as bigint | undefined;
        if (!balance || !supply || supply === 0n) return 0;
        return Number((balance * 10000n) / supply) / 100;
    }, [userLpBalance, totalSupply]);

    useEffect(() => {
        if (isGraduateSuccess || isRedeemLPSuccess) {
            refetch();
        }
    }, [isGraduateSuccess, isRedeemLPSuccess, refetch]);

    const graduate = useCallback(() => {
        if (!marketAddress) return;
        graduateWrite({ address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'graduate' });
    }, [marketAddress, graduateWrite]);

    const expire = useCallback(() => {
        if (!marketAddress) return;
        expireWrite({ address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'expire' });
    }, [marketAddress, expireWrite]);

    const claimRefund = useCallback(() => {
        if (!marketAddress) return;
        refundWrite({ address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'claimCreatorRefund' });
    }, [marketAddress, refundWrite]);

    const redeemLP = useCallback((amount: bigint) => {
        if (!marketAddress) return;
        redeemLPWrite({ address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'redeemLP', args: [amount] });
    }, [marketAddress, redeemLPWrite]);

    return {
        isGraduated: !!isGraduated,
        graduationThreshold: graduationThreshold as bigint | undefined,
        bBase: bBase as bigint | undefined,
        deadline: deadline ? Number(deadline) : undefined,
        creator: creator as `0x${string}` | undefined,
        isLive: !!isLive,
        feesAccrued: feesAccrued as bigint | undefined,
        outcomeToken: outcomeToken as `0x${string}` | undefined,
        totalCreatorDeposit: totalCreatorDeposit as bigint | undefined,
        priceYes: prices.priceYes,
        priceNo: prices.priceNo,
        totalLockedProceeds: totalLockedProceeds as bigint | undefined,
        lockedProceeds: lockedProceeds as bigint | undefined,
        totalSupply: totalSupply as bigint | undefined,
        totalAssets: totalAssets as bigint | undefined,
        totalNetAssets: totalNetAssets as bigint | undefined,
        ammReserve: ammReserve as bigint | undefined,
        qYes: qYes as bigint | undefined,
        qNo: qNo as bigint | undefined,
        totalSupplyYes: totalSupplyYes as bigint | undefined,
        totalSupplyNo: totalSupplyNo as bigint | undefined,
        isUnderwater: !!isUnderwater,
        isSettled: !!isSettled,
        fee: feeData ? Number(feeData) / 10000 : (isGraduated ? 0.01 : 0.05),
        userLpBalance: userLpBalance as bigint | undefined,
        userLpNetValue,
        userLpCeilingValue,
        ammCash: ammCash as bigint | undefined,
        pureFloor: totalNetAssets as bigint | undefined,
        pureCeiling: pureCeiling as bigint | undefined,
        userSharePercent,
        // AMM IS WALLET ONLY
        userYesWallet: userYesWallet || 0n,
        userNoWallet: userNoWallet || 0n,
        // OB IS TRADING ACCOUNT ONLY
        userYesShares: liquidYes,
        userNoShares: liquidNo,
        // Legacy Locked
        userYesLocked: lockYes,
        userNoLocked: lockNo,
        creatorLpBalance,
        graduate, expire, claimCreatorRefund: claimRefund, redeemLP,
        isGraduatePending: isGraduatePending || isGraduateConfirming,
        isRedeemLPPending: isRedeemLPPending || isRedeemLPConfirming,
        refetch
    };
}
