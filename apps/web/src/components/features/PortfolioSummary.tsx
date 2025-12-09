import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Wallet, TrendingUp, ChevronDown, ChevronRight, ExternalLink, Copy, Coins } from 'lucide-react';
import { useAccount, useReadContracts, useWriteContract, usePublicClient, useReadContract } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { ERC20_ABI, GOVERNOR_VAULT_V4_ABI, MARKET_V4_ABI, MOCK_ERC20_ABI, TRADER_VAULT_V4_ABI } from '../../config/abis';
import { useDeployments } from '../../hooks/useDeployments';
import { useTraderVault } from '../../hooks/useTraderVault';
import { useVault } from '../../hooks/useVault';
import marketsConfig from '../../config/markets.json';
import { useMarketStore } from '../../store/useMarketStore';
import { useChainStore } from '../../store/useChainStore';
import { getChainById } from '../../lib/chains';
import toast from 'react-hot-toast';

export const PortfolioSummary: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { mode, markets: demoMarkets } = useMarketStore();
  const deployments = useDeployments();
  const { selectedChainId } = useChainStore();

  // Trading Account data
  const { availableBalance, pendingBalance, totalBalance } = useTraderVault();

  // Governor Vault data
  const { lpBalance, sharePrice } = useVault();

  // Collapsible state
  const [tradingExpanded, setTradingExpanded] = useState(false);
  const [positionsExpanded, setPositionsExpanded] = useState(false);
  const [vaultExpanded, setVaultExpanded] = useState(false);

  // Get Market Positions - V4 uses TraderVault.ammPositions
  const realMarkets = marketsConfig.markets.filter(m => m.mode === 'real');
  const traderVaultAddress = deployments.SoothTraderVault as `0x${string}`;

  const marketContracts = realMarkets.flatMap(m => [
    // Fetch ammPositions from TraderVault (use zero address as fallback if not connected)
    {
      address: traderVaultAddress,
      abi: TRADER_VAULT_V4_ABI,
      functionName: 'ammPositions',
      args: [address || '0x0000000000000000000000000000000000000000', m.contractAddress as `0x${string}`]
    },
    // Fetch market data
    { address: m.contractAddress as `0x${string}`, abi: MARKET_V4_ABI, functionName: 'currentTick' },
    { address: m.contractAddress as `0x${string}`, abi: MARKET_V4_ABI, functionName: 'b' },
  ]);

  const { data: positionData } = useReadContracts({
    contracts: marketContracts as any,
    query: { enabled: mode === 'real' && !!address, refetchInterval: 5000 }
  });

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(val);

  // Calculate position values
  let activePositions: any[] = [];
  let totalPositionValue = 0;

  if (mode === 'demo') {
    Object.entries(demoMarkets).forEach(([, market]) => {
      const yesShares = market.userYesShares || 0;
      const noShares = market.userNoShares || 0;
      if (yesShares > 0 || noShares > 0) {
        const yesValue = yesShares * (market.priceYes || 0.5);
        const noValue = noShares * (market.priceNo || 0.5);
        activePositions.push({ name: market.question, yesShares, noShares, yesValue, noValue, totalValue: yesValue + noValue });
        totalPositionValue += (yesValue + noValue);
      }
    });
  } else {
    if (positionData) {
      realMarkets.forEach((market, idx) => {
        const baseIdx = idx * 3; // 3 calls per market now
        const [ammPosition, tickResult, bParam] = [0, 1, 2].map(i => positionData[baseIdx + i]);

        // V4: Calculate price from tick
        let priceYes = 0.5, priceNo = 0.5;
        if (tickResult?.result) {
          const currentTick = Number(tickResult.result);
          priceYes = currentTick / 1000;
          priceNo = 1 - priceYes;
        }

        // V4: Get shares from ammPositions [yesShares, noShares, unlockTime]
        let yesShares = 0, noShares = 0;
        if (ammPosition?.result) {
          const pos = ammPosition.result as [bigint, bigint, bigint];
          yesShares = parseFloat(formatUnits(pos[0], 18));
          noShares = parseFloat(formatUnits(pos[1], 18));
        }

        if (yesShares > 0 || noShares > 0) {
          const yesValue = yesShares * priceYes;
          const noValue = noShares * priceNo;
          activePositions.push({ name: market.name, yesShares, noShares, yesValue, noValue, totalValue: yesValue + noValue });
          totalPositionValue += (yesValue + noValue);
        }
      });
    }
  }

  // Calculate values
  const available = parseFloat(formatUnits(availableBalance, 18));
  const pending = parseFloat(formatUnits(pendingBalance, 18));
  const claimable = 0; // TODO: Calculate unlocked portion based on timestamp
  const locked = pending; // For now, treat all pending as locked
  const tradingAccountTotal = available + locked + totalPositionValue;

  const governorVaultValue = parseFloat(formatUnits(lpBalance, 18)) * sharePrice;
  const portfolioValue = tradingAccountTotal + governorVaultValue;

  // Protocol Addresses logic
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const [isMinting, setIsMinting] = useState(false);
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: deployments.MockUSDC as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address || '0x0'],
    query: { enabled: mode === 'real' && !!address, refetchInterval: 5000 }
  });
  const { data: decimals } = useReadContract({
    address: deployments.MockUSDC as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'decimals',
  });

  const chain = getChainById(selectedChainId);
  const explorerUrl = chain?.explorerUrl || 'https://sepolia.basescan.org';

  const addresses = [
    { label: 'Trader Vault', address: deployments.SoothTraderVault },
    { label: 'Market', address: deployments.SoothMarket },
    { label: 'Governor Vault', address: deployments.SoothGovernorVault },
    { label: 'Fee', address: deployments.SoothFeeController },
    { label: 'AMM', address: deployments.SoothLMSRReal },
    { label: 'USDC', address: deployments.MockUSDC, canMint: true },
  ].filter(item => item.address);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Address copied');
  };



  const handleMint = async () => {
    if (!address) { toast.error('Connect wallet first'); return; }
    setIsMinting(true);
    try {
      const tokenDecimals = decimals || 18;
      const mintAmount = parseUnits('100000', Number(tokenDecimals));
      const hash = await writeContractAsync({
        address: deployments.MockUSDC as `0x${string}`,
        abi: MOCK_ERC20_ABI,
        functionName: 'mint',
        args: [address, mintAmount],
      });
      const toastId = toast.loading('Fauceting 100,000 USDC...');
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
        toast.success('Received 100,000 USDC!', { id: toastId });
        refetchBalance();
      } else {
        toast.success('Transaction sent', { id: toastId });
      }
    } catch (err: any) {
      toast.error('Faucet failed');
    } finally { setIsMinting(false); }
  };

  if (mode === 'real' && !isConnected) {
    return (
      <Card className="h-full border-slate-800/60 bg-slate-900/40" variant="premium">
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">Portfolio Summary</h3>
        <div className="text-center py-8">
          <Wallet className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Connect wallet to view portfolio</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col" variant="premium">

      <div className="flex-1 flex flex-col space-y-4">

        {/* Portfolio Value - Always Visible */}
        <div className="p-4 rounded-lg bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20">
          <div className="text-xs text-indigo-300/70 uppercase tracking-widest mb-1">Portfolio Value</div>
          <div className="text-3xl font-bold text-white font-heading">{formatCurrency(portfolioValue)}</div>
        </div>

        {/* Trading Account - Collapsible */}
        <div className="border border-slate-800/50 rounded-lg overflow-hidden">
          <button
            onClick={() => setTradingExpanded(!tradingExpanded)}
            className="w-full p-3 flex items-center justify-between bg-slate-900/40 hover:bg-slate-900/60 transition-colors"
          >
            <div className="flex items-center gap-2">
              {tradingExpanded ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Trading Account</span>
            </div>
            <span className="text-sm font-mono font-bold text-emerald-400">{formatCurrency(tradingAccountTotal)}</span>
          </button>

          {tradingExpanded && (
            <div className="p-3 space-y-2 bg-slate-950/20 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Available</span>
                <span className="font-mono text-emerald-400">{formatCurrency(available)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Claimable</span>
                <span className="font-mono text-amber-400">{formatCurrency(claimable)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Locked</span>
                <span className="font-mono text-amber-500/60">{formatCurrency(locked)}</span>
              </div>

              {/* Active Positions - Nested Collapsible */}
              {activePositions.length > 0 && (
                <div className="border-t border-slate-800/50 pt-2 mt-2">
                  <button
                    onClick={() => setPositionsExpanded(!positionsExpanded)}
                    className="w-full flex items-center justify-between py-1 hover:bg-slate-800/30 rounded px-1 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      {positionsExpanded ? <ChevronDown size={12} className="text-slate-600" /> : <ChevronRight size={12} className="text-slate-600" />}
                      <span className="text-slate-500">Active Positions ({activePositions.length})</span>
                    </div>
                    <span className="font-mono text-slate-400">{formatCurrency(totalPositionValue)}</span>
                  </button>

                  {positionsExpanded && (
                    <div className="space-y-1.5 mt-2 pl-4">
                      {activePositions.map((pos, i) => (
                        <div key={i} className="p-2 rounded bg-slate-800/20 border border-slate-800/30">
                          <div className="text-[10px] text-slate-400 truncate mb-1" title={pos.name}>{pos.name}</div>
                          <div className="flex justify-between items-end">
                            <div className="flex gap-1.5">
                              {pos.yesShares > 0 && (
                                <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  YES: {pos.yesShares.toFixed(1)}
                                </span>
                              )}
                              {pos.noShares > 0 && (
                                <span className="text-[9px] px-1 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                  NO: {pos.noShares.toFixed(1)}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-mono text-white">{formatCurrency(pos.totalValue)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between items-center pt-2 border-t border-slate-700/50">
                <span className="text-slate-400 font-semibold">Total</span>
                <span className="font-mono font-bold text-emerald-400">{formatCurrency(tradingAccountTotal)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Governor Vault - Collapsible */}
        <div className="border border-slate-800/50 rounded-lg overflow-hidden">
          <button
            onClick={() => setVaultExpanded(!vaultExpanded)}
            className="w-full p-3 flex items-center justify-between bg-slate-900/40 hover:bg-slate-900/60 transition-colors"
          >
            <div className="flex items-center gap-2">
              {vaultExpanded ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Governor Vault</span>
            </div>
            <span className="text-sm font-mono font-bold text-indigo-400">{formatCurrency(governorVaultValue)}</span>
          </button>

          {vaultExpanded && (
            <div className="p-3 space-y-2 bg-slate-950/20 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">LP Tokens</span>
                <span className="font-mono text-slate-400">{parseFloat(formatUnits(lpBalance, 18)).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Share Price</span>
                <span className="font-mono text-slate-400">${sharePrice.toFixed(4)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-700/50">
                <span className="text-slate-400 font-semibold">Value</span>
                <span className="font-mono font-bold text-indigo-400">{formatCurrency(governorVaultValue)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Protocol Addresses - Footer Style */}
        <div className="border-t border-slate-800/30 pt-3 mt-auto">
          <div className="text-center mb-2">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest">Protocol Addresses</span>
          </div>
          <div className="space-y-2">
            {/* Contract names - With hover tooltips */}
            <div className="flex flex-wrap justify-center gap-x-2 gap-y-1 text-[10px]">
              {addresses.filter(item => !item.canMint).map((item) => (
                <div key={item.label} className="relative group">
                  <span className="text-slate-500 hover:text-slate-300 cursor-pointer transition-colors">
                    {item.label}
                  </span>
                  {/* Tooltip on hover */}
                  {item.address && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col bg-slate-950/95 border border-slate-700 rounded-lg p-2 whitespace-nowrap z-10 shadow-xl">
                      <span className="font-mono text-[9px] text-slate-400 mb-1.5">
                        {item.address.slice(0, 6)}...{item.address.slice(-4)}
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => copyToClipboard(item.address!)}
                          className="px-2 py-0.5 text-[8px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded flex items-center gap-1"
                        >
                          <Copy size={8} /> Copy
                        </button>
                        <a
                          href={`${explorerUrl}/address/${item.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-0.5 text-[8px] bg-indigo-600 hover:bg-indigo-500 text-white rounded flex items-center gap-1"
                        >
                          <ExternalLink size={8} /> View
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* USDC - Separate line with allowance and faucet */}
            <div className="flex justify-between items-center px-1 py-1 rounded hover:bg-slate-800/20">
              <span className="text-[11px] text-slate-400">USDC</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500">
                  {balance ? formatCurrency(parseFloat(formatUnits(balance as bigint, Number(decimals || 18)))) : '...'}
                </span>
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
              </div>
            </div>
          </div>
        </div>

      </div>
    </Card>
  );
};
