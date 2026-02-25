import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getNodeById, getChain } from '@sooth/registry';
import { getAllInstances } from '../config/deployments';
import { getAddressUrl } from '../config/chains';
import { useLaunchpadMarkets } from '../hooks/indexer/useLaunchpadMarkets';
import { getMarketStatus } from '../types';

function shortAddr(addr: string): string {
  if (!addr) return '';
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

function CopyIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
    </svg>
  );
}

function CheckIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

export function NodePage() {
  const { nodeId } = useParams<{ nodeId: string }>();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const nodeDetails = nodeId ? getNodeById(nodeId) : undefined;
  const chain = nodeDetails ? getChain(nodeDetails.chainId) : undefined;
  

  const instance = nodeId ? getAllInstances().find(i => i.id === nodeId) : undefined;

  const { markets, isLoading } = useLaunchpadMarkets({ nodeId });

  if (!nodeId || !nodeDetails || !instance) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
        <header className="border-b border-white/5 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-[1400px] mx-auto px-6 py-5 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-4 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 flex items-center justify-center bg-zinc-900 border border-white/10 rounded-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
                <div className="w-3 h-3 bg-amber-500 rounded-sm shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
              </div>
              <div>
                <h1 className="font-bold text-xl tracking-tight text-zinc-50 leading-none font-mono">
                  SOOTH<span className="text-zinc-500">.MARKET</span>
                </h1>
              </div>
            </Link>
          </div>
        </header>
        <main className="max-w-[1400px] mx-auto px-6 py-12 text-center">
          <h2 className="text-2xl font-bold mb-4">Node not found</h2>
          <Link to="/" className="text-amber-400 hover:text-amber-300 font-mono">← Back to Terminal</Link>
        </main>
      </div>
    );
  }

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const contracts = [
    { label: 'LaunchpadEngine', address: instance.launchpadEngine },
    { label: 'SoothBook', address: instance.soothBook },
    { label: 'AMMEngine', address: instance.ammEngine },
    { label: 'Collateralizer', address: instance.collateralizer },
    { label: 'USDC', address: instance.usdc },
    { label: 'ProtocolConfig', address: instance.protocolConfig },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      <header className="border-b border-white/5 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-6 py-5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-4 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 flex items-center justify-center bg-zinc-900 border border-white/10 rounded-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
              <div className="w-3 h-3 bg-amber-500 rounded-sm shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
            </div>
            <div>
              <h1 className="font-bold text-xl tracking-tight text-zinc-50 leading-none font-mono">
                SOOTH<span className="text-zinc-500">.MARKET</span>
              </h1>
            </div>
          </Link>
          <div className="font-mono text-xs text-zinc-500">Node Registry</div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-12 flex flex-col gap-12">
        <div>
          <Link to="/" className="text-zinc-500 hover:text-zinc-300 font-mono text-sm mb-6 inline-block">
            ← Back to Terminal
          </Link>

          <div className="flex flex-col md:flex-row gap-8 items-start justify-between">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono text-lg rounded-md tracking-wider">
                  {nodeId}
                </div>
                <div className="flex flex-col">
                  <span className="text-2xl font-bold tracking-tight leading-tight">{chain?.name || 'Unknown Chain'}</span>
                  <span className="text-zinc-500 font-mono text-xs uppercase tracking-widest">Chain ID: {nodeDetails.chainId}</span>
                </div>
              </div>

              {nodeDetails.indexed !== false ? (
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium font-mono uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 w-max">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  Indexed
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium font-mono uppercase tracking-wider bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 w-max">
                  <div className="w-2 h-2 rounded-full bg-zinc-500" />
                  Not Indexed
                </div>
              )}
            </div>

            <div className="surface-card p-4 rounded-xl border border-white/10 bg-zinc-900/40 min-w-[300px]">
              <div className="text-zinc-500 font-mono text-[10px] uppercase tracking-wider mb-2">CLI Instructions</div>
              <div className="flex items-center justify-between gap-4 bg-zinc-950 border border-white/5 rounded-lg px-3 py-2">
                <code className="text-amber-400 font-mono text-sm">bun run interactive {nodeId}</code>
                <button
                  onClick={() => handleCopy(`bun run interactive ${nodeId}`, 'cli')}
                  className="text-zinc-500 hover:text-amber-400 transition-colors"
                >
                  {copiedKey === 'cli' ? <CheckIcon className="w-4 h-4 text-emerald-400" /> : <CopyIcon className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="surface-card p-6 flex flex-col gap-6 rounded-[2rem] border border-white/5">
            <h3 className="text-lg font-medium text-zinc-100">Core Contracts</h3>
            <div className="flex flex-col">
              {contracts.map((contract) => {
                if (!contract.address) return null;
                const copyKey = `contract-${contract.label}`;
                const isCopied = copiedKey === copyKey;
                return (
                  <div 
                    key={contract.label} 
                    className="flex items-center justify-between py-3 border-b border-white/[0.02] last:border-0 hover:bg-white/[0.02] -mx-2 px-2 rounded-lg transition-colors"
                  >
                    <span className="text-sm text-zinc-400 font-medium">{contract.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm text-zinc-300">{shortAddr(contract.address)}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleCopy(contract.address, copyKey)}
                          className={`p-1.5 rounded-md transition-colors ${
                            copiedKey === copyKey 
                              ? 'text-emerald-400 bg-emerald-400/10' 
                              : 'text-zinc-500 hover:text-amber-400 hover:bg-amber-400/10'
                          }`}
                          title="Copy address"
                        >
                          {copiedKey === copyKey ? <CheckIcon className="w-4 h-4" /> : <CopyIcon className="w-4 h-4" />}
                        </button>
                        <a
                          href={getAddressUrl(contract.address, nodeDetails.chainId)}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-md text-zinc-500 hover:text-amber-400 hover:bg-amber-400/10 transition-colors"
                          title="View on Explorer"
                        >
                          <span className="text-[10px] leading-none block px-0.5 font-bold">↗</span>
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="surface-card p-6 flex flex-col gap-6 rounded-[2rem] border border-white/5">
            <h3 className="text-lg font-medium text-zinc-100">Deployment Metadata</h3>
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-1.5">
                <span className="text-zinc-500 font-mono uppercase tracking-wider text-[10px]">Start Block</span>
                <span className="text-zinc-100 font-mono tabular-nums bg-zinc-900/50 px-3 py-2 rounded-lg border border-white/5 w-fit">
                  {nodeDetails.startBlock}
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-zinc-500 font-mono uppercase tracking-wider text-[10px]">Deployed At</span>
                <span className="text-zinc-100 font-mono tabular-nums bg-zinc-900/50 px-3 py-2 rounded-lg border border-white/5 w-fit">
                  {new Date(nodeDetails.deployedAt).toLocaleString()}
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-zinc-500 font-mono uppercase tracking-wider text-[10px]">Deployed By</span>
                <div className="flex items-center gap-3 bg-zinc-900/50 px-3 py-2 rounded-lg border border-white/5 w-fit">
                  <span className="text-zinc-100 font-mono">
                    {nodeDetails.deployedBy}
                  </span>
                  <button
                    onClick={() => handleCopy(nodeDetails.deployedBy, 'deployer')}
                    className="text-zinc-500 hover:text-amber-400 transition-colors"
                  >
                    {copiedKey === 'deployer' ? <CheckIcon className="w-4 h-4 text-emerald-400" /> : <CopyIcon className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="surface-card rounded-[2rem] border border-white/5 overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-white/[0.04] bg-zinc-900/40">
            <h3 className="text-lg font-medium text-zinc-100">Markets</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-zinc-950/80 text-[11px] uppercase tracking-wider font-mono">
                <tr>
                  <th className="px-6 py-4 font-normal text-zinc-500 whitespace-nowrap">Market Address</th>
                  <th className="px-6 py-4 font-normal text-zinc-500 whitespace-nowrap">Question</th>
                  <th className="px-6 py-4 font-normal text-zinc-500 whitespace-nowrap text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] text-sm">
                {isLoading ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-zinc-500">Loading markets...</td>
                  </tr>
                ) : markets.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-zinc-500">No markets found for this node.</td>
                  </tr>
                ) : (
                  markets.map((m) => {
                    const status = getMarketStatus(m);
                    return (
                      <tr key={m.address} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4">
                          <a
                            href={getAddressUrl(m.address, nodeDetails.chainId)}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono text-zinc-300 hover:text-amber-400 transition-colors"
                          >
                            {shortAddr(m.address)} ↗
                          </a>
                        </td>
                        <td className="px-6 py-4 text-zinc-200">
                          {m.question || m.name || 'Unnamed Market'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium font-mono uppercase tracking-wider border ${
                            status === 'live' 
                              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                              : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                          }`}>
                            <div className={`w-1 h-1 rounded-full ${status === 'live' ? 'bg-emerald-500' : 'bg-zinc-500'}`} />
                            {status}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}