import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { ExternalLink, Copy, Coins, ShieldCheck } from 'lucide-react';
import { Button } from '../ui/Button';
import { useDeployments } from '../../hooks/useDeployments';
import { useMarketStore } from '../../store/useMarketStore';
import { useChainStore } from '../../store/useChainStore';
import { getChainById } from '../../lib/chains';
import toast from 'react-hot-toast';
import { useAccount, useWriteContract, usePublicClient, useReadContract } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { MOCK_ERC20_ABI, ERC20_ABI } from '../../config/abis';

export const ProtocolAddresses: React.FC = () => {
  const { mode } = useMarketStore();
  const { selectedChainId } = useChainStore();
  const deployments = useDeployments();
  const { address: userAddress } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const [isMinting, setIsMinting] = useState(false);

  // Fetch decimals
  const { data: decimals } = useReadContract({
    address: deployments.MockUSDC as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'decimals',
  });

  // Fetch USDC allowance for TraderVaultV3
  const traderVaultAddress = deployments.SoothTraderVault;
  const { data: allowance } = useReadContract({
    address: deployments.MockUSDC as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [userAddress || '0x0', traderVaultAddress as `0x${string}`],
    query: {
      enabled: mode === 'real' && !!userAddress && !!traderVaultAddress,
      refetchInterval: 5000,
    }
  });


  // Fetch USDC Balance
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: deployments.MockUSDC as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [userAddress || '0x0'],
    query: {
      enabled: mode === 'real' && !!userAddress,
      refetchInterval: 5000,
    }
  });

  const chain = getChainById(selectedChainId);
  const explorerUrl = chain?.explorerUrl || 'https://sepolia.basescan.org';


  const addresses = [

    { label: 'Trader Vault', address: deployments.SoothTraderVault },
    { label: 'Market', address: deployments.SoothMarket },
    { label: 'Governor Vault', address: deployments.SoothGovernorVault },
    { label: 'Fee Controller', address: deployments.SoothFeeController },
    { label: 'AMM', address: deployments.SoothLMSRReal },
    { label: 'USDC', address: deployments.MockUSDC, canMint: true },
  ].filter(item => item.address); // Filter out undefined addresses

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Address copied');
  };

  const handleMint = async () => {
    if (!userAddress) {
      toast.error('Connect wallet first');
      return;
    }

    setIsMinting(true);
    try {
      const tokenDecimals = decimals || 18;
      const mintAmount = parseUnits('100000', Number(tokenDecimals));

      const hash = await writeContractAsync({
        address: deployments.MockUSDC as `0x${string}`,
        abi: MOCK_ERC20_ABI,
        functionName: 'mint',
        args: [userAddress, mintAmount],
        gas: 200000n, // Explicit gas limit to prevent estimation hangs
      });

      const toastId = toast.loading('Fauceting 100,000 USDC...');

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
        toast.success('Received 100,000 USDC!', { id: toastId });
        refetchBalance();
      } else {
        toast.success('Faucet transaction sent', { id: toastId });
      }
    } catch (err: any) {
      const revertReason = err.message?.match(/reverted with the following reason:\s*(.+)/)?.[1]
        || err.shortMessage
        || err.message?.split('\n')[0]
        || 'Unknown error';

      toast.error(`Faucet failed: ${revertReason}`);
    } finally {
      setIsMinting(false);
    }
  };

  // Show mock addresses in demo mode
  if (mode === 'demo') {
    const mockAddresses = [
      { label: 'Vault', address: '0x1234567890123456789012345678901234567890' },
      { label: 'Settlement', address: '0x2345678901234567890123456789012345678901' },
      { label: 'Factory', address: '0x3456789012345678901234567890123456789012' },
    ];

    return (
      <Card className="h-full border-slate-800/60 bg-slate-900/40">
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">Protocol Addresses</h3>
        <div className="space-y-3">
          {mockAddresses.map((item) => (
            <div key={item.label} className="flex justify-between items-center group">
              <span className="text-sm text-slate-500">{item.label}</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-slate-600">
                  {item.address.slice(0, 6)}...{item.address.slice(-4)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="h-full border-slate-800/60 bg-slate-900/40">
      <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">Protocol Addresses</h3>
      <div className="space-y-3">
        {addresses.map((item) => (
          <div key={item.label} className="flex justify-between items-center group">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">{item.label}</span>
              {item.canMint && balance !== undefined && (
                <span
                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800/50 text-[10px] text-slate-300 font-mono"
                  title="Your Wallet Balance"
                >
                  {parseFloat(formatUnits(balance as bigint, Number(decimals || 18))).toLocaleString(undefined, { maximumFractionDigits: 0 })} USDC
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {item.canMint && (
                <Button
                  variant="success"
                  size="sm"
                  onClick={handleMint}
                  disabled={isMinting}
                  className="h-5 px-2 text-[10px] gap-1"
                  title="Get 100,000 Mock USDC"
                >
                  <Coins size={10} />
                  {isMinting ? '...' : 'Faucet'}
                </Button>
              )}

              <span className="font-mono text-xs text-slate-400 group-hover:text-slate-300 transition-colors">
                {(item.address as string).slice(0, 6)}...{(item.address as string).slice(-4)}
              </span>
              <button
                onClick={() => copyToClipboard(item.address as string)}
                className="p-1 hover:bg-slate-800 rounded transition-colors text-slate-600 hover:text-slate-400"
              >
                <Copy size={12} />
              </button>
              <a
                href={`${explorerUrl}/address/${item.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 hover:bg-slate-800 rounded transition-colors text-slate-600 hover:text-indigo-400"
              >
                <ExternalLink size={12} />
              </a>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
