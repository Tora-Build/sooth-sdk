import { useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { LAUNCHPAD_FACTORY_ABI, ERC20_ABI } from '../../config/abis';
import { useDeployments } from '../useDeployments';
import { parseUnits, decodeEventLog, maxUint256 } from 'viem';
import { useMemo, useEffect } from 'react';
import { useAccount } from 'wagmi';

export function useLaunchpadFactory() {
    const { config } = useDeployments();
    // @ts-ignore - config type inference is tricky here, but we know structure
    const factoryAddress = config?.contracts?.LaunchpadFactory as `0x${string}` | undefined;

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
                        abi: LAUNCHPAD_FACTORY_ABI,
                        data: log.data,
                        topics: log.topics,
                    });
                    if (decoded.eventName === 'MarketCreated') {
                        return decoded.args.market;
                    }
                } catch (e) {
                    continue; // Not our event
                }
            }
        } catch (e) {
            console.error("Failed to parse logs", e);
        }
    }, [receipt]);

    const createMarket = (
        name: string,
        symbol: string,
        description: string,
        tierIndex: number,
        isOpenEnd: boolean,
        durationSeconds: number
    ) => {
        if (!factoryAddress) throw new Error("Factory not configured");

        writeContract({
            address: factoryAddress,
            abi: LAUNCHPAD_FACTORY_ABI,
            functionName: 'createMarket',
            args: [name, symbol, description, tierIndex, isOpenEnd, durationSeconds],
        });
    };

    const { address: user } = useAccount();

    // 1. Get USDC Address from Factory
    const { data: usdcAddress } = useReadContract({
        address: factoryAddress,
        abi: LAUNCHPAD_FACTORY_ABI,
        functionName: 'usdc',
    });

    // 2. Get Allowance & Balance
    const { data: allowance, refetch: refetchAllowance } = useReadContract({
        address: usdcAddress,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [user || '0x0000000000000000000000000000000000000000', factoryAddress || '0x0000000000000000000000000000000000000000'],
        query: { enabled: !!user && !!factoryAddress && !!usdcAddress }
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
        if (!usdcAddress || !factoryAddress) {
            console.error("Missing address:", { usdcAddress, factoryAddress });
            return;
        }
        console.log("Approving USDC:", {
            token: usdcAddress,
            spender: factoryAddress,
            amount: maxUint256.toString()
        });
        writeApprove({
            address: usdcAddress,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [factoryAddress, maxUint256]
        });
    }

    const isApprovePending = isApproveWritePending || isApproveConfirming;

    // Reads
    const { data: tierData } = useReadContracts({
        contracts: [0, 1, 2, 3].map(i => ({
            address: factoryAddress,
            abi: LAUNCHPAD_FACTORY_ABI,
            functionName: 'tierDeposits',
            args: [BigInt(i)]
        })),
        query: { enabled: !!factoryAddress }
    });

    const tierDeposits = tierData?.map(r => r.result as bigint) || [];

    return {
        createMarket,
        txHash,
        isPending: isWritePending || isConfirming,
        isConfirmed,
        receipt,
        writeError,
        tierDeposits,
        deployedMarketAddress,
        allowance: allowance as bigint | undefined,
        usdcBalance: usdcBalance as bigint | undefined,
        approveUSDC,
        isApprovePending,
        refetchAllowance
    };
}
