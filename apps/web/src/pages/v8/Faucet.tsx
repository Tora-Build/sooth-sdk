import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAccount, useReadContract, useWriteContract, usePublicClient, useChainId } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { MOCK_ERC20_ABI, ERC20_ABI } from '../config/abis';
import { useDeployments } from '../../hooks/useDeployments';
import { Coins, Droplets, ExternalLink, Info, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';

export const Faucet = () => {
    const { address, isConnected } = useAccount();
    const chainId = useChainId();
    const { config } = useDeployments();
    const deployments = config.contracts;
    
    const [isMinting, setIsMinting] = useState(false);
    const { writeContractAsync } = useWriteContract();
    const publicClient = usePublicClient();

    // Read current USDC balance
    const { data: balance, refetch: refetchBalance } = useReadContract({
        address: deployments.MockUSDC as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address || '0x0'],
        query: { enabled: !!address && !!deployments.MockUSDC }
    });

    const { data: decimals } = useReadContract({
        address: deployments.MockUSDC as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'decimals',
        query: { enabled: !!deployments.MockUSDC }
    });

    const handleMint = async () => {
        if (!address) {
            toast.error('Please connect your wallet first');
            return;
        }

        if (!deployments.MockUSDC) {
            toast.error('MockUSDC not deployed on this network');
            return;
        }

        setIsMinting(true);
        const tid = toast.loading('Requesting 10,000 mUSDC...');

        try {
            const tokenDecimals = Number(decimals || 6);
            const amount = parseUnits('10000', tokenDecimals);

            const hash = await writeContractAsync({
                address: deployments.MockUSDC as `0x${string}`,
                abi: MOCK_ERC20_ABI,
                functionName: 'mint',
                args: [address, amount],
            });

            if (publicClient) {
                await publicClient.waitForTransactionReceipt({ hash });
                toast.success('10,000 mUSDC received!', { id: tid });
                refetchBalance();
            } else {
                toast.success('Transaction sent!', { id: tid });
            }
        } catch (err: any) {
            console.error('Faucet error:', err);
            toast.error(err.shortMessage || 'Failed to mint tokens', { id: tid });
        } finally {
            setIsMinting(false);
        }
    };

    const isMegaETH = chainId === 4326;

    return (
        <div className="max-w-4xl mx-auto space-y-8 py-8">
            <div className="space-y-2 text-center">
                <h1 className="text-4xl font-heading font-bold text-white tracking-tight flex items-center justify-center gap-3">
                    <Droplets className="text-cyan-400 w-10 h-10" />
                    Protocol Faucet
                </h1>
                <p className="text-slate-400">Get test tokens to interact with the Sooth Protocol</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* mUSDC Faucet */}
                <Card className="p-6 border-cyan-500/20 bg-slate-900/40 backdrop-blur-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Coins size={80} className="text-cyan-400" />
                    </div>
                    
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <Coins className="text-cyan-400 w-5 h-5" />
                        Mock USDC
                    </h3>
                    
                    <p className="text-slate-400 text-sm mb-6">
                        Mint 10,000 mUSDC to your wallet. This token is used as collateral for all trading on Sooth.
                    </p>

                    <div className="bg-slate-950/50 rounded-lg p-4 mb-6 border border-slate-800/50">
                        <div className="flex justify-between items-center text-sm mb-1">
                            <span className="text-slate-500">Your Balance</span>
                            <span className="text-white font-mono font-bold">
                                {balance !== undefined ? `${Number(formatUnits(balance as bigint, Number(decimals || 6))).toLocaleString()} mUSDC` : '0 mUSDC'}
                            </span>
                        </div>
                        <div className="text-[10px] text-slate-600 font-mono truncate">
                            {deployments.MockUSDC}
                        </div>
                    </div>

                    <Button 
                        className="w-full h-12 text-base font-bold shadow-lg shadow-cyan-500/10"
                        onClick={handleMint}
                        isLoading={isMinting}
                        disabled={!isConnected}
                    >
                        {isConnected ? 'Request 10,000 mUSDC' : 'Connect Wallet to Mint'}
                    </Button>
                </Card>

                {/* Native ETH Info */}
                <Card className="p-6 border-purple-500/20 bg-slate-900/40 backdrop-blur-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Wallet size={80} className="text-purple-400" />
                    </div>

                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <Wallet className="text-purple-400 w-5 h-5" />
                        Native ETH
                    </h3>

                    <p className="text-slate-400 text-sm mb-6">
                        Gas fees on {isMegaETH ? 'MegaETH Frontier' : 'this network'} must be paid in native ETH.
                    </p>

                    <div className="space-y-3">
                        {isMegaETH ? (
                            <>
                                <div className="flex items-start gap-3 p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-lg text-xs text-slate-300">
                                    <Info className="text-indigo-400 w-4 h-4 shrink-0 mt-0.5" />
                                    <p>Frontier Net is a restricted phase. Please reach out to the MegaETH team or use the official bridge if you have access.</p>
                                </div>
                                <a 
                                    href="https://docs.megaeth.com/frontier" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-between p-4 bg-slate-950/50 border border-slate-800 rounded-lg hover:border-purple-500/50 transition-colors group/link"
                                >
                                    <span className="text-sm font-medium text-white">MegaETH Frontier Docs</span>
                                    <ExternalLink size={14} className="text-slate-500 group-hover/link:text-purple-400" />
                                </a>
                            </>
                        ) : (
                            <div className="flex items-start gap-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg text-xs text-slate-300">
                                <Info className="text-amber-400 w-4 h-4 shrink-0 mt-0.5" />
                                <p>Please use the official faucet for this testnet to obtain ETH for gas.</p>
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            {/* Warning / Tips */}
            <Card className="p-4 border-slate-800 bg-slate-900/20 flex items-start gap-3">
                <Info className="text-slate-500 w-5 h-5 shrink-0" />
                <div className="text-xs text-slate-500 space-y-1">
                    <p><strong>Note:</strong> Mock USDC (mUSDC) has no real value and is for protocol testing only.</p>
                    <p>If you are experiencing issues with transactions, ensure you have enough native ETH for gas fees.</p>
                </div>
            </Card>
        </div>
    );
};
