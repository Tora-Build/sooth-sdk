import React, { useState } from 'react';
import { useAccount, useReadContracts, useWriteContract, usePublicClient, useReadContract } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { TRADER_VAULT_V4_ABI, OUTCOME_TOKEN_ABI } from '../../../config/abis';
import { useDeployments } from '../../../hooks/useDeployments';
import { useTraderVault } from '../../../hooks/useTraderVault';
import marketsConfig from '../../../config/markets.json';
import { Dialog } from '../../ui/Dialog';
import { Button } from '../../ui/Button';
import { ArrowRightLeft, Wallet, Vault } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '../../../lib/utils';
import { useMarketStore } from '../../../store/useMarketStore';
import { useChainStore } from '../../../store/useChainStore';

interface AssetRowProps {
    marketName: string;
    marketAddress: string;
    outcome: 0 | 1; // 0=YES, 1=NO
    vaultBalance: string;
    walletBalance: string;
    tokenAddress: string;
    onAction: (type: 'deposit' | 'withdraw', market: string, outcome: 0 | 1, maxAmount: string) => void;
}

const AssetRow: React.FC<AssetRowProps> = ({ marketName, marketAddress, outcome, vaultBalance, walletBalance, onAction }) => {
    const vBal = parseFloat(vaultBalance);
    const wBal = parseFloat(walletBalance);

    if (vBal < 0.001 && wBal < 0.001) return null;

    return (
        <div className="flex items-center justify-between p-3 bg-slate-900/40 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors">
            <div className="flex-1">
                <div className="text-sm font-medium text-white">{marketName}</div>
                <div className={cn("text-xs font-bold uppercase", outcome === 0 ? "text-emerald-400" : "text-rose-400")}>
                    {outcome === 0 ? "YES" : "NO"} Position
                </div>
            </div>

            <div className="flex gap-6 mr-6">
                <div className="text-right">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Vault (Spot Sell)</div>
                    <div className="font-mono text-emerald-300 font-medium">{vBal.toFixed(2)}</div>
                </div>
                <div className="text-right">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Wallet (Transfer)</div>
                    <div className="font-mono text-indigo-300 font-medium">{wBal.toFixed(2)}</div>
                </div>
            </div>

            <div className="flex gap-2">
                <Button
                    size="xs"
                    variant="secondary"
                    disabled={wBal < 0.0001}
                    onClick={() => onAction('deposit', marketAddress, outcome, walletBalance)}
                    title="Deposit from Wallet to Vault (Required for Limit Sell)"
                >
                    Deposit
                </Button>
                <Button
                    size="xs"
                    variant="secondary"
                    disabled={vBal < 0.0001}
                    onClick={() => onAction('withdraw', marketAddress, outcome, vaultBalance)}
                    title="Withdraw from Vault to Wallet"
                >
                    Withdraw
                </Button>
            </div>
        </div>
    );
};

export const AssetManager: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    const { address } = useAccount();
    const { config } = useDeployments();
    const deployments = config.contracts;
    const { mode } = useMarketStore();
    const { selectedChainId } = useChainStore();
    const publicClient = usePublicClient();
    const { depositShares, withdrawShares, isPending } = useTraderVault();
    const { writeContractAsync } = useWriteContract();

    // Filter markets by mode AND selected chain to prevent cross-chain errors
    const realMarkets = marketsConfig.markets.filter(m => m.mode === 'real' && m.chainId === selectedChainId);
    const traderVaultAddress = deployments.SoothTraderVault as `0x${string}`;

    // Build contract reads
    const contractReads = realMarkets.flatMap(m => ([
        // YES (0)
        { address: traderVaultAddress, abi: TRADER_VAULT_V4_ABI, functionName: 'shareBalances', args: [address || '0x0', m.contractAddress as `0x${string}`, 0] },
        { address: m.outcomeTokenAddress as `0x${string}`, abi: OUTCOME_TOKEN_ABI, functionName: 'balanceOf', args: [address || '0x0', 0] },
        // NO (1)
        { address: traderVaultAddress, abi: TRADER_VAULT_V4_ABI, functionName: 'shareBalances', args: [address || '0x0', m.contractAddress as `0x${string}`, 1] },
        { address: m.outcomeTokenAddress as `0x${string}`, abi: OUTCOME_TOKEN_ABI, functionName: 'balanceOf', args: [address || '0x0', 1] },
    ]));

    const { data, refetch } = useReadContracts({
        contracts: contractReads as any,
        query: { enabled: isOpen && !!address, refetchInterval: 5000 }
    });

    // Action State
    const [actionType, setActionType] = useState<'deposit' | 'withdraw' | null>(null);
    const [selectedMarket, setSelectedMarket] = useState<{ address: string; outcome: 0 | 1; max: string } | null>(null);
    const [amount, setAmount] = useState('');

    // Approval state for deposits
    const { data: isApproved, isLoading: isCheckingApproval, refetch: refetchApproval } = useReadContract({
        address: selectedMarket ? realMarkets.find(m => m.contractAddress === selectedMarket.address)?.outcomeTokenAddress as `0x${string}` : undefined,
        abi: OUTCOME_TOKEN_ABI,
        functionName: 'isApprovedForAll',
        args: [address || '0x0', traderVaultAddress],
        query: { enabled: !!selectedMarket && actionType === 'deposit' }
    });

    const handleActionClick = (type: 'deposit' | 'withdraw', market: string, outcome: 0 | 1, maxAmount: string) => {
        setActionType(type);
        setSelectedMarket({ address: market, outcome, max: maxAmount });
        setAmount('');
    };

    const executeAction = async () => {
        if (!selectedMarket || !amount) return;

        if (actionType === 'deposit') {
            // Check Approval
            if (isApproved === false) {
                try {
                    // Find token address
                    const m = realMarkets.find(x => x.contractAddress === selectedMarket.address);
                    if (!m) return;

                    const hash = await writeContractAsync({
                        address: m.outcomeTokenAddress as `0x${string}`,
                        abi: OUTCOME_TOKEN_ABI,
                        functionName: 'setApprovalForAll',
                        args: [traderVaultAddress, true]
                    });
                    const tid = toast.loading("Approving manager...");
                    await publicClient?.waitForTransactionReceipt({ hash });
                    toast.success("Approved!", { id: tid });
                    refetchApproval();
                    return; // User clicks again to deposit
                } catch (e: any) {
                    toast.error("Approval failed");
                    return;
                }
            }
            await depositShares(selectedMarket.address, selectedMarket.outcome, amount);
        } else {
            await withdrawShares(selectedMarket.address, selectedMarket.outcome, amount);
        }

        // Cleanup
        setAmount('');
        setActionType(null);
        setSelectedMarket(null);
        refetch();
    };

    // Render Rows
    const rows = [];
    if (data) {
        for (let i = 0; i < realMarkets.length; i++) {
            const market = realMarkets[i];
            const base = i * 4;

            const vYes = data[base]?.result ? formatUnits(data[base].result as bigint, 18) : '0';
            const wYes = data[base + 1]?.result ? formatUnits(data[base + 1].result as bigint, 18) : '0';

            const vNo = data[base + 2]?.result ? formatUnits(data[base + 2].result as bigint, 18) : '0';
            const wNo = data[base + 3]?.result ? formatUnits(data[base + 3].result as bigint, 18) : '0';

            rows.push(
                <AssetRow
                    key={`${market.contractAddress}-YES`}
                    marketName={market.name}
                    marketAddress={market.contractAddress}
                    outcome={0}
                    tokenAddress={market.outcomeTokenAddress || ''}
                    vaultBalance={vYes}
                    walletBalance={wYes}
                    onAction={handleActionClick}
                />
            );
            rows.push(
                <AssetRow
                    key={`${market.contractAddress}-NO`}
                    marketName={market.name}
                    marketAddress={market.contractAddress}
                    outcome={1}
                    tokenAddress={market.outcomeTokenAddress || ''}
                    vaultBalance={vNo}
                    walletBalance={wNo}
                    onAction={handleActionClick}
                />
            );
        }
    }

    const activeRows = rows.filter(r => r !== null);


    // Modal Content for Action
    const isDeposit = actionType === 'deposit';
    const needsApprove = isDeposit && isApproved === false;
    const actionTitle = isDeposit ? "Deposit to Vault" : "Withdraw to Wallet";
    const btnText = isCheckingApproval ? "Checking Approval..." : (needsApprove ? "Approve Manager" : (isDeposit ? "Deposit Shares" : "Withdraw Shares"));

    return (
        <>
            <Dialog isOpen={isOpen} onClose={onClose} title="Asset Manager" maxWidth="max-w-3xl">
                <div className="space-y-4">
                    <div className="flex gap-4 p-4 bg-indigo-900/20 border border-indigo-500/30 rounded-lg">
                        <div className="flex flex-col items-center">
                            <Vault className="text-emerald-400 mb-1" size={20} />
                            <span className="text-xs text-emerald-400 font-bold uppercase">Vault</span>
                        </div>
                        <div className="flex-1 text-sm text-slate-300">
                            <p><strong>Vault Shares</strong> are held internally for gas-free Orderbook Trading (Spot Sells).</p>
                        </div>
                        <ArrowRightLeft className="text-slate-500 mt-2" size={16} />
                        <div className="flex-1 text-sm text-slate-300 text-right">
                            <p><strong>Wallet Tokens</strong> are ERC1155 tokens in your wallet. You can transfer them or list on other marketplaces.</p>
                        </div>
                        <div className="flex flex-col items-center">
                            <Wallet className="text-indigo-400 mb-1" size={20} />
                            <span className="text-xs text-indigo-400 font-bold uppercase">Wallet</span>
                        </div>
                    </div>

                    <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                        {activeRows.length > 0 ? activeRows : (
                            <div className="text-center py-12 text-slate-500">
                                No active positions found. Buy some shares to manage them here.
                            </div>
                        )}
                    </div>
                </div>
            </Dialog>

            {/* Action Sub-Modal (Quick & Dirty overlay) */}
            {selectedMarket && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-full max-w-sm shadow-2xl relative">
                        <button onClick={() => setActionType(null)} className="absolute top-4 right-4 text-slate-500 hover:text-white">✕</button>
                        <h3 className="text-lg font-bold text-white mb-4">{actionTitle}</h3>

                        <div className="mb-4">
                            <label className="text-xs text-slate-500 mb-1 block">Amount</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-white font-mono"
                                    placeholder="0.00"
                                />
                                <button
                                    onClick={() => setAmount(selectedMarket.max)}
                                    className="absolute right-2 top-2 px-2 py-1 bg-slate-800 text-xs text-emerald-400 rounded hover:bg-slate-700"
                                >
                                    MAX {parseFloat(selectedMarket.max).toFixed(2)}
                                </button>
                            </div>
                        </div>

                        <Button
                            className="w-full"
                            onClick={executeAction}
                            isLoading={isPending || isCheckingApproval}
                            disabled={!amount || parseFloat(amount) <= 0 || isCheckingApproval}
                        >
                            {btnText}
                        </Button>
                    </div>
                </div>
            )}
        </>
    );
};
