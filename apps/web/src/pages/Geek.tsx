import { useCallback, useMemo, useEffect } from 'react';
import { useAccount, usePublicClient, useWalletClient, useChainId, useBalance, useReadContract, useConfig } from 'wagmi';
import { Terminal, Wallet, Key, Download } from 'lucide-react';
import { formatUnits } from 'viem';
import { Card } from '../components/ui/Card';
import { WebTerminal } from '../components/features/WebTerminal';
import { SoothSDK, type OutputLine } from '../lib/sdk';
import deployments from '../config/deployments.json';
import { allowedChains } from '../lib/chains';
import { parseAbi } from 'viem';
import { useLocalWallet } from '../hooks/useLocalWallet';

const ERC20_ABI = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
]);

const WELCOME_OUTPUT: OutputLine[] = [
  { type: 'bold', text: 'SOOTH PROTOCOL SDK CLI v1.0' },
  { type: 'dim', text: '────────────────────────────────────────' },
  { type: 'plain', text: '' },
  { type: 'info', text: 'Type "help" for available commands' },
  { type: 'plain', text: '' },
];

export function Geek() {
  const { address: connectedAddress, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: connectedWalletClient } = useWalletClient();
  const wagmiConfig = useConfig();

  const networkConfig = useMemo(() => {
    return Object.values(deployments.networks).find(n => n.chainId === chainId);
  }, [chainId]);

  const currentChain = useMemo(() => {
    return wagmiConfig.chains.find(c => c.id === chainId);
  }, [wagmiConfig.chains, chainId]);

  const rpcUrlForLocalWallet = useMemo(() => {
    const chain = allowedChains.find(c => c.id === chainId);
    return chain?.rpcUrl;
  }, [chainId]);

  const localWallet = useLocalWallet(currentChain, rpcUrlForLocalWallet);
  
  const activeAddress = localWallet.isActive ? localWallet.address : connectedAddress;
  const activeWalletClient = localWallet.isActive ? localWallet.walletClient : connectedWalletClient;

  const isSupported = !!networkConfig;
  const hasWallet = localWallet.isActive || isConnected;

  const rpcHost = useMemo(() => {
    const chain = allowedChains.find(c => c.id === chainId);
    if (!chain?.rpcUrl) return null;
    try {
      return new URL(chain.rpcUrl).host;
    } catch {
      return chain.rpcUrl;
    }
  }, [chainId]);

  const { data: gasBalance } = useBalance({
    address: activeAddress ?? undefined,
    query: { enabled: hasWallet && isSupported },
  });

  const { data: usdcBalance } = useReadContract({
    address: networkConfig?.contracts.MockUSDC as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: activeAddress ? [activeAddress] : undefined,
    query: { enabled: hasWallet && isSupported && !!networkConfig?.contracts.MockUSDC },
  });

  const { data: usdcDecimals } = useReadContract({
    address: networkConfig?.contracts.MockUSDC as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'decimals',
    query: { enabled: hasWallet && isSupported && !!networkConfig?.contracts.MockUSDC },
  });

  const sdk = useMemo(() => {
    if (!publicClient || !chainId || !isSupported) return null;

    try {
      return new SoothSDK(chainId, publicClient, activeWalletClient ?? undefined, activeAddress ?? undefined);
    } catch {
      return null;
    }
  }, [chainId, publicClient, activeWalletClient, activeAddress, isSupported]);

  useEffect(() => {
    if (sdk && activeAddress) {
      sdk.setAddress(activeAddress);
    }
  }, [sdk, activeAddress]);

  useEffect(() => {
    if (sdk && activeWalletClient) {
      sdk.setWalletClient(activeWalletClient);
    }
  }, [sdk, activeWalletClient]);

  const handleCommand = useCallback(async (input: string, stream?: (line: OutputLine) => void): Promise<OutputLine[]> => {
    const parts = input.trim().split(/\s+/);
    const cmd = parts[0]?.toLowerCase();
    const subCmd = parts[1]?.toLowerCase();

    if (cmd === 'localwallet' || cmd === 'lw') {
      if (!subCmd || subCmd === 'status') {
        if (localWallet.isActive) {
          return [
            { type: 'success', text: 'Local wallet ACTIVE' },
            { type: 'plain', text: `Address: ${localWallet.address}` },
            { type: 'dim', text: 'All transactions auto-signed (no popups)' },
          ];
        }
        return [
          { type: 'info', text: localWallet.hasStoredKey ? 'Local wallet DISABLED' : 'Local wallet not set up' },
          { type: 'plain', text: '' },
          { type: 'plain', text: 'Commands:' },
          { type: 'plain', text: '  lw create   Generate new wallet' },
          ...(localWallet.hasStoredKey ? [
            { type: 'plain' as const, text: '  lw enable   Activate stored wallet' },
            { type: 'dim' as const, text: `              (${localWallet.storedAddress})` },
          ] : []),
          { type: 'plain', text: '  lw disable  Deactivate (keep key)' },
          { type: 'plain', text: '  lw clear    Remove wallet permanently' },
        ];
      }
      
      if (subCmd === 'create') {
        const addr = localWallet.create();
        return [
          { type: 'success', text: 'Local wallet created!' },
          { type: 'plain', text: `Address: ${addr}` },
          { type: 'dim', text: 'Send native gas token to this address to start' },
        ];
      }

      if (subCmd === 'enable') {
        if (localWallet.isActive) {
          return [
            { type: 'info', text: 'Local wallet already active' },
            { type: 'plain', text: `Address: ${localWallet.address}` },
          ];
        }
        const addr = localWallet.enable();
        if (!addr) {
          return [{ type: 'error', text: 'No stored wallet. Use: lw create' }];
        }
        return [
          { type: 'success', text: 'Local wallet enabled!' },
          { type: 'plain', text: `Address: ${addr}` },
        ];
      }

      if (subCmd === 'disable') {
        if (!localWallet.isActive) {
          return [{ type: 'info', text: 'Local wallet already disabled' }];
        }
        localWallet.disable();
        return [
          { type: 'success', text: 'Local wallet disabled' },
          { type: 'dim', text: 'Key preserved. Use "lw enable" to reactivate.' },
        ];
      }
      
      if (subCmd === 'clear') {
        localWallet.clear();
        return [{ type: 'success', text: 'Local wallet cleared' }];
      }

      return [{ type: 'error', text: 'Unknown subcommand. Use: lw create|enable|disable|clear' }];
    }

    if (!sdk) {
      return [{ type: 'error', text: 'SDK not initialized. Connect wallet to a supported chain.' }];
    }
    
    if (!hasWallet) {
      const readOnlyCommands = ['help', 'state', 'book', 'info', 'markets'];
      if (cmd && !readOnlyCommands.includes(cmd)) {
        return [{ type: 'error', text: 'No wallet. Use "lw create" or connect via navbar.' }];
      }
    }

    if (cmd === 'createmarket') {
      let streamed = false;
      const out = (line: OutputLine) => { streamed = true; stream?.(line); };
      const { output } = await sdk.createmarket(parts.slice(1), out);
      return streamed ? [] : output;
    }

    if (cmd === 'graduate') {
      let streamed = false;
      const out = (line: OutputLine) => { streamed = true; stream?.(line); };
      const { output } = await sdk.graduate(parts.slice(1), out);
      return streamed ? [] : output;
    }

    if (cmd === 'simulate') {
      let streamed = false;
      const out = (line: OutputLine) => { streamed = true; stream?.(line); };
      const { output } = await sdk.simulate(parts.slice(1), out);
      return streamed ? [] : output;
    }

    const { output } = await sdk.executeCommand(input);
    return output;
  }, [sdk, hasWallet, localWallet]);

  const formatBalance = (value: bigint | undefined, decimals: number, symbol: string, maxDecimals = 2) => {
    if (value === undefined) return '—';
    const formatted = parseFloat(formatUnits(value, decimals));
    return `${formatted.toLocaleString(undefined, { minimumFractionDigits: maxDecimals, maximumFractionDigits: maxDecimals })}${symbol ? ` ${symbol}` : ''}`;
  };

  return (
    <div className="h-[calc(100vh-12rem)] flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Terminal className="text-cyan-400 w-8 h-8" />
          <div>
            <h1 className="text-2xl font-heading font-bold text-white">Geek Mode</h1>
            <p className="text-sm text-slate-500">Direct protocol interaction via CLI</p>
          </div>
        </div>
        <button
          disabled
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-500 cursor-not-allowed opacity-50"
          title="Coming Soon"
        >
          <Download className="w-4 h-4" />
          <span className="text-sm">SDK</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400">Soon</span>
        </button>
      </div>

      {!isSupported ? (
        <Card className="flex-1 flex items-center justify-center border-amber-500/20 bg-slate-900/40">
          <div className="text-center space-y-4">
            <Wallet className="w-12 h-12 text-amber-400 mx-auto" />
            <h2 className="text-xl font-bold text-white">Unsupported Network</h2>
            <p className="text-slate-400 max-w-md">
              Switch to a supported network using the chain selector in the navbar.
            </p>
          </div>
        </Card>
      ) : (
        <Card className="flex-1 flex flex-col border-cyan-500/20 bg-slate-900/40 overflow-hidden p-0">
          <div className="flex-1 min-h-0">
            <WebTerminal
              onCommand={handleCommand}
              prompt="sooth>"
              initialOutput={WELCOME_OUTPUT}
            />
          </div>
        </Card>
      )}

      {isSupported && (
        <div className="text-xs px-1 text-slate-500 space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {hasWallet && (
                <>
                  <span>Gas: {gasBalance ? `${parseFloat(gasBalance.formatted).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${gasBalance.symbol}` : '—'}</span>
                  <span>USDC: {formatBalance(usdcBalance as bigint | undefined, Number(usdcDecimals ?? 18), '', 2)}</span>
                </>
              )}
              {rpcHost && <span>RPC: {rpcHost}</span>}
              {!hasWallet && <span className="text-slate-600">Type "lw create" to start</span>}
            </div>
            <span className="text-slate-600">↑↓ history</span>
          </div>
          {localWallet.isActive && localWallet.address && (
            <div className="flex items-center gap-2">
              <Key className="w-3 h-3 text-amber-400" />
              <span className="text-amber-400">LOCAL:</span>
              <span 
                className="text-slate-500 cursor-pointer hover:text-slate-300 transition-colors"
                onClick={() => {
                  navigator.clipboard.writeText(localWallet.address!);
                }}
                title="Click to copy"
              >
                {localWallet.address}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
