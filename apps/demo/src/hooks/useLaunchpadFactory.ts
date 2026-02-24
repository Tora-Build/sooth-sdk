import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi';
import { ABIS, ERC20_ABI } from '../config/abis';
import { useDeployments } from './useDeployments';
import { decodeEventLog, maxUint256 } from 'viem';
import { useMemo, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { getPollingInterval } from '../lib/polling';

export function useLaunchpadFactory() {
    const chainId = useChainId();
    const { contracts } = useDeployments();
    const launchpadEngineAddress = contracts?.LaunchpadEngine as `0x${string}` | undefined;

    // Writes
    const { writeContract, data: txHash, isPending: isWritePending, error: writeError } = useWriteContract();

    const { isLoading: isConfirming, isSuccess: isConfirmed, data: receipt } = useWaitForTransactionReceipt({
        hash: txHash,
    });

    const deployedMarketAddress = useMemo(() => {
        if (!receipt) return undefined;
        try {
            for (const log of receipt.logs) {
                try {
                    const decoded = decodeEventLog({
                        abi: ABIS.TruthMarket,
                        data: log.data,
                        topics: log.topics,
                    });
                    if (decoded.eventName === 'MarketCreated' && decoded.args) {
                        return (decoded.args as unknown as { market: `0x${string}` }).market;
                    }
                } catch (e) {
                    continue; // Not our event
                }
            }
        } catch (e) {
            console.error("Failed to parse logs", e);
        }
    }, [receipt]);

    const { data: protocolConfig } = useReadContract({
        address: launchpadEngineAddress,
        abi: ABIS.LaunchpadEngine,
        functionName: 'protocolConfig',
        query: { enabled: !!launchpadEngineAddress },
    });

    const createMarket = (
        question: string,
        startTime: bigint,
        deadline: bigint,
        initialLiquidity: bigint,
        adjudicator: `0x${string}`,
        adjudicatorAgentId: bigint = 0n,
        adjudicatorMinValidators: bigint = 0n
    ) => {
        if (!launchpadEngineAddress) throw new Error("LaunchpadEngine not configured");
        if (!protocolConfig) throw new Error("ProtocolConfig not configured");

        writeContract({
            address: launchpadEngineAddress,
            abi: ABIS.LaunchpadEngine,
            functionName: 'createMarket',
            args: [
                question,
                startTime,
                deadline,
                adjudicator,
                protocolConfig as `0x${string}`,
                initialLiquidity,
                adjudicatorAgentId,
                adjudicatorMinValidators,
            ],
        });
    };

    const { address: user } = useAccount();

    // 1. Get USDC Address from Config (Single Source of Truth)
    const usdcAddress = contracts?.MockUSDC as `0x${string}` | undefined;



    // 2. Get Allowance & Balance
    const { data: allowance, refetch: refetchAllowance } = useReadContract({
        address: usdcAddress,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [user || '0x0000000000000000000000000000000000000000', launchpadEngineAddress || '0x0000000000000000000000000000000000000000'],
        query: {
            enabled: !!user && !!launchpadEngineAddress && !!usdcAddress,
            refetchInterval: getPollingInterval(chainId, 'fast')
        }
    });

    const { data: usdcBalance } = useReadContract({
        address: usdcAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [user || '0x0000000000000000000000000000000000000000'],
        query: { enabled: !!user && !!usdcAddress }
    });

    // 3. Approve Write
    const { writeContract: writeApprove, data: approveTxHash, isPending: isApproveWritePending } = useWriteContract();

    const { isLoading: isApproveConfirming, isSuccess: isApproveConfirmed } = useWaitForTransactionReceipt({
        hash: approveTxHash,
    });

    // Auto-refetch allowance when confirmed
    useEffect(() => {
        if (isApproveConfirmed) {
            refetchAllowance();
        }
    }, [isApproveConfirmed, refetchAllowance]);

    const approveUSDC = () => {
        if (!usdcAddress || !launchpadEngineAddress) {
            console.error("Missing address:", { usdcAddress, launchpadEngineAddress });
            return;
        }
        writeApprove({
            address: usdcAddress,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [launchpadEngineAddress, maxUint256]
        });
    }

    const isApprovePending = isApproveWritePending || isApproveConfirming;



    return {
        createMarket,
        txHash,
        isPending: isWritePending || isConfirming,
        isConfirmed,
        receipt,
        writeError,
        deployedMarketAddress,
        allowance: allowance as bigint | undefined,
        usdcBalance: usdcBalance as bigint | undefined,
        approveUSDC,
        isApprovePending,
        refetchAllowance
    };
}
