import { useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { LAUNCHPAD_MARKET_ABI, TRADER_VAULT_V4_ABI, LAUNCHPAD_OUTCOME_TOKEN_ABI, ERC20_ABI } from '../config/abis';
import { useAccount } from 'wagmi';
import { useCallback, useEffect, useMemo } from 'react';
import { useChainStore } from '../store/useChainStore';
import { getDeployments } from './useDeployments';
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

    // Phase 1: Market Core Data (Always Runs)
    const marketContracts = [
        { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'isGraduated' }, // 0
        { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'graduationThreshold' }, // 1
        { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'bBase' }, // 2
        { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'deadline' }, // 3
        { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'creator' }, // 4
        { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'isLive' }, // 5
        { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'feesAccrued' }, // 6
        { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'outcomeToken' }, // 7
        { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'totalCreatorDeposit' }, // 8
        { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'totalLockedProceeds' }, // 9
        { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'totalSupply' }, // 10
        { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'totalAssets' }, // 11
        { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'totalNetAssets' }, // 12
        { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'ammAssets' }, // 13
        { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'pureCeilingAssets' }, // 14
        { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'b' }, // 15
        { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'reserve' }, // 16
        { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'qYes' }, // 17
        { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'qNo' }, // 18
        { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'isUnderwater' }, // 19
        { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'isSettled' }, // 20
        { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'feeLMSR' }, // 21
        { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'asset' }, // 22
        { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'adjudicator' }, // 23
        { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'tStar' }, // 24
        { address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'winningOutcome' } // 25
    ].map(c => ({ ...c, chainId: Number(selectedChainId) }));

    const userSpecificIdx = marketContracts.length;
    if (userAddress) {
        marketContracts.push({ address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'lockedProceeds', args: [userAddress], chainId: Number(selectedChainId) } as any); // 26
        marketContracts.push({ address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'balanceOf', args: [userAddress], chainId: Number(selectedChainId) } as any); // 27
        
        if (traderVaultAddr) {
            marketContracts.push({ address: traderVaultAddr, abi: TRADER_VAULT_V4_ABI, functionName: 'shareBalances', args: [userAddress, marketAddress, 0], chainId: Number(selectedChainId) } as any); // 28
            marketContracts.push({ address: traderVaultAddr, abi: TRADER_VAULT_V4_ABI, functionName: 'shareBalances', args: [userAddress, marketAddress, 1], chainId: Number(selectedChainId) } as any); // 29
            marketContracts.push({ address: traderVaultAddr, abi: TRADER_VAULT_V4_ABI, functionName: 'ammPositions', args: [userAddress, marketAddress], chainId: Number(selectedChainId) } as any); // 30
        }
    }

    const { data: marketData, refetch } = useReadContracts({
        contracts: marketContracts as any,
        query: {
            enabled: !!marketAddress,
            refetchInterval: 5000 
        }
    });

    const results = marketData?.map(r => r.result) || [];
    
    // Core results
    const isGraduated = results[0] as boolean;
    const graduationThreshold = results[1] as bigint;
    const bBase = results[2] as bigint;
    const deadline = results[3] as bigint;
    const creator = results[4] as `0x${string}`;
    const isLive = results[5] as boolean;
    const feesAccrued = results[6] as bigint;
    const outcomeToken = results[7] as `0x${string}`;
    const totalCreatorDeposit = results[8] as bigint;
    const totalLockedProceeds = results[9] as bigint;
    const totalSupply = results[10] as bigint;
    const totalAssets = results[11] as bigint;
    const totalNetAssets = results[12] as bigint;
    const rawAmmAssets = results[13] as bigint;
    const rawPureCeiling = results[14] as bigint;
    const bEffective = results[15] as bigint;
    const reserve = results[16] as bigint;
    const qYes = results[17] as bigint;
    const qNo = results[18] as bigint;
    const isUnderwater = results[19] as boolean;
    const isSettled = results[20] as boolean;
    const feeData = results[21] as bigint;
    const assetAddress = results[22] as `0x${string}`;
    const adjudicator = results[23] as `0x${string}`;
    const tStar = results[24] as bigint;
    const winningOutcome = results[25] as bigint;

    // User Specific
    const userLockedProceeds = userAddress ? results[userSpecificIdx] as bigint : 0n;
    const userLpBalance = userAddress ? results[userSpecificIdx + 1] as bigint : 0n;
    const liqYes = (userAddress && traderVaultAddr) ? results[userSpecificIdx + 2] as bigint : 0n;
    const liqNo = (userAddress && traderVaultAddr) ? results[userSpecificIdx + 3] as bigint : 0n;
    const ammPos = (userAddress && traderVaultAddr) ? results[userSpecificIdx + 4] as [bigint, bigint] : [0n, 0n];

    // Dependent Query: Asset Decimals
    const { data: assetDecimalsData } = useReadContract({
        address: assetAddress,
        abi: ERC20_ABI,
        functionName: 'decimals',
        chainId: Number(selectedChainId),
        query: { enabled: !!assetAddress }
    });
    const decimals = Number(assetDecimalsData || 18);

    // Dependent Query: Creator Balance (ALWAYS PUBLIC)
    const { data: creatorBalData } = useReadContract({
        address: marketAddress,
        abi: LAUNCHPAD_MARKET_ABI,
        functionName: 'balanceOf',
        args: [creator || '0x0000000000000000000000000000000000000000'],
        chainId: Number(selectedChainId),
        query: { enabled: !!marketAddress && !!creator && creator !== '0x0000000000000000000000000000000000000000' }
    });
    const finalCreatorLpBalance = creatorBalData as bigint | undefined;

    // Dependent Query: Outcome Tokens
    const outcomeTokenAddress = outcomeToken as `0x${string}` | undefined;
    const { data: tokenData } = useReadContracts({
        contracts: [
            { address: outcomeTokenAddress, abi: LAUNCHPAD_OUTCOME_TOKEN_ABI, functionName: 'balanceOf', args: [userAddress || '0x0000000000000000000000000000000000000000', 0n] },
            { address: outcomeTokenAddress, abi: LAUNCHPAD_OUTCOME_TOKEN_ABI, functionName: 'balanceOf', args: [userAddress || '0x0000000000000000000000000000000000000000', 1n] },
            { address: outcomeTokenAddress, abi: LAUNCHPAD_OUTCOME_TOKEN_ABI, functionName: 'totalSupply', args: [0n] },
            { address: outcomeTokenAddress, abi: LAUNCHPAD_OUTCOME_TOKEN_ABI, functionName: 'totalSupply', args: [1n] },
        ].map(c => ({ ...c, chainId: Number(selectedChainId) })),
        query: { enabled: !!outcomeTokenAddress }
    });

    const [userYesWalletRes, userNoWalletRes, supplyYesRes, supplyNoRes] = tokenData?.map(r => r.result) || [];
    
    const userYesWallet = userAddress ? (userYesWalletRes as bigint || 0n) : 0n;
    const userNoWallet = userAddress ? (userNoWalletRes as bigint || 0n) : 0n;
    const totalSupplyYes = supplyYesRes as bigint || 0n;
    const totalSupplyNo = supplyNoRes as bigint || 0n;

    // Derived Data
    const pureAmmValues = useMemo(() => {
        if (!totalSupply || totalSupply === 0n || totalNetAssets === undefined || rawPureCeiling === undefined) {
            return { userLpNetValue: 0n, userLpCeilingValue: 0n };
        }
        return {
            userLpNetValue: userLpBalance ? (userLpBalance * totalNetAssets) / totalSupply : 0n,
            userLpCeilingValue: userLpBalance ? (userLpBalance * rawPureCeiling) / totalSupply : 0n
        };
    }, [totalSupply, totalNetAssets, rawPureCeiling, userLpBalance]);

    const prices = useMemo(() => {
        const qY = qYes ? Number(formatUnits(qYes as bigint, 18)) : 0;
        const qN = qNo ? Number(formatUnits(qNo as bigint, 18)) : 0;
        const b = bEffective ? Number(formatUnits(bEffective as bigint, 18)) : 1000;
        let pY = 0.5;
        if (b > 0) {
            const maxQ = Math.max(qY, qN);
            const eY = Math.exp((qY - maxQ) / b);
            const eN = Math.exp((qN - maxQ) / b);
            pY = eY / (eY + eN);
        }
        return { priceYes: pY, priceNo: 1 - pY };
    }, [qYes, qNo, bEffective]);

    const userSharePercent = totalSupply && totalSupply > 0n ? Number((userLpBalance * 10000n) / totalSupply) / 100 : 0;

    useEffect(() => {
        if (isGraduateSuccess || isRedeemLPSuccess) refetch();
    }, [isGraduateSuccess, isRedeemLPSuccess, refetch]);

    const graduate = useCallback(() => {
        if (marketAddress) graduateWrite({ address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'graduate', chainId: Number(selectedChainId) });
    }, [marketAddress, graduateWrite, selectedChainId]);

    const expire = useCallback(() => {
        if (marketAddress) expireWrite({ address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'expire', chainId: Number(selectedChainId) });
    }, [marketAddress, expireWrite, selectedChainId]);

    const claimRefund = useCallback(() => {
        if (marketAddress) refundWrite({ address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'claimLiquidationRefund', args: [userAddress!], chainId: Number(selectedChainId) });
    }, [marketAddress, refundWrite, selectedChainId]);

    const redeemLP = useCallback((amount: bigint) => {
        if (marketAddress) redeemLPWrite({ address: marketAddress, abi: LAUNCHPAD_MARKET_ABI, functionName: 'redeemLP', args: [amount], chainId: Number(selectedChainId) });
    }, [marketAddress, redeemLPWrite, selectedChainId]);

    return {
        isGraduated: !!isGraduated,
        graduationThreshold,
        bBase,
        bEffective,
        deadline: deadline ? Number(deadline) : undefined,
        creator,
        isLive: !!isLive,
        feesAccrued,
        outcomeToken,
        totalCreatorDeposit,
        priceYes: prices.priceYes,
        priceNo: prices.priceNo,
        totalLockedProceeds,
        lockedProceeds: userLockedProceeds,
        totalSupply,
        totalAssets,
        totalNetAssets,
        ammReserve: reserve,
        qYes,
        qNo,
        totalSupplyYes,
        totalSupplyNo,
        isUnderwater: !!isUnderwater,
        isSettled: !!isSettled,
        winningOutcome: winningOutcome !== undefined ? Number(winningOutcome) : undefined,
        fee: feeData ? Number(feeData) / 10000 : (isGraduated ? 0.01 : 0.05),
        adjudicator,
        tStar: tStar ? Number(tStar) : undefined,
        decimals,
        userLpBalance,
        userLpNetValue: pureAmmValues.userLpNetValue,
        userLpCeilingValue: pureAmmValues.userLpCeilingValue,
        ammCash: rawAmmAssets,
        pureFloor: totalNetAssets,
        pureCeiling: rawPureCeiling,
        userSharePercent,
        userYesWallet,
        userNoWallet,
        userYesShares: liqYes,
        userNoShares: liqNo,
        userYesLocked: ammPos?.[0] || 0n,
        userNoLocked: ammPos?.[1] || 0n,
        creatorLpBalance: finalCreatorLpBalance,
        graduate, expire, claimCreatorRefund: claimRefund, redeemLP,
        isGraduatePending: isGraduatePending || isGraduateConfirming,
        isRedeemLPPending: isRedeemLPPending || isRedeemLPConfirming,
        refetch
    };
}
