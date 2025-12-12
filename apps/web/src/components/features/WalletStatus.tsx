import React from 'react';
import { useAccount } from 'wagmi';
import { useAppKitAccount } from '@reown/appkit/react';
import { Card } from '../ui/Card';
import { Wallet, CheckCircle2, XCircle } from 'lucide-react';

/**
 * WalletStatus - Shows connection status for both EVM and Solana
 */
export const WalletStatus: React.FC = () => {
    const { address: evmAddress, isConnected: evmConnected } = useAccount();
    const { address: appKitAddress, isConnected: appKitConnected, caipAddress } = useAppKitAccount();

    // Check if Solana wallet is connected
    const isSolanaWallet = appKitConnected && caipAddress?.startsWith('solana:');

    const isConnected = isSolanaWallet || evmConnected;
    const walletAddress = isSolanaWallet ? appKitAddress : evmAddress;
    const chainType = isSolanaWallet ? 'Solana' : 'EVM';

    return (
        <Card className="p-4 bg-slate-900/40 border-slate-800/60">
            <div className="flex items-center gap-3">
                <Wallet className={`w-5 h-5 ${isConnected ? 'text-emerald-400' : 'text-slate-600'}`} />
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-300">
                            {chainType} Wallet
                        </span>
                        {isConnected ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                            <XCircle className="w-4 h-4 text-slate-600" />
                        )}
                    </div>
                    {isConnected && walletAddress && (
                        <div className="text-xs text-slate-500 font-mono mt-1">
                            {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}
                        </div>
                    )}
                </div>
                <div className={`px-2 py-1 rounded text-[10px] font-medium ${isConnected
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-slate-800/50 text-slate-500 border border-slate-700/50'
                    }`}>
                    {isConnected ? 'Connected' : 'Disconnected'}
                </div>
            </div>
        </Card>
    );
};
