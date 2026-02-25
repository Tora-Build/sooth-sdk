import React, { useState } from 'react';
import { getAllInstances } from '../config/deployments';
import { getAllNodes, getChain } from '@sooth/registry';
import { getAddressUrl } from '../config/chains';

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

export function NodesSection() {
  const instances = getAllInstances();
  const nodes = getAllNodes();
  
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="text-zinc-500 font-mono text-xs uppercase tracking-widest px-2">
        Protocol Nodes
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {instances.map((instance) => {
          const nodeDetails = nodes.find(n => n.chainId === instance.chainId && n.id === instance.id);
          const chain = getChain(instance.chainId);
          
          const contracts = [
            { label: 'LaunchpadEngine', address: instance.launchpadEngine },
            { label: 'SoothBook', address: instance.soothBook },
            { label: 'AMMEngine', address: instance.ammEngine },
            { label: 'Collateralizer', address: instance.collateralizer },
            { label: 'USDC', address: instance.usdc },
            { label: 'ProtocolConfig', address: instance.protocolConfig },
          ];

          return (
            <div key={instance.id} className="surface-card p-6 flex flex-col gap-6">
              {/* TOP: Node ID + Chain */}
              <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="px-2 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono text-[13px] rounded-md tracking-wider">
                    {instance.id}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-zinc-100 font-medium tracking-tight leading-tight">{instance.chainName}</span>
                    <span className="text-zinc-500 font-mono text-[10px] uppercase tracking-widest">{instance.chainId}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {nodeDetails?.indexed !== false ? (
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium font-mono uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                      </span>
                      Indexed
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium font-mono uppercase tracking-wider bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                      <div className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                      Not Indexed
                    </div>
                  )}
                  {chain?.testnet === true && (
                    <div className="px-2 py-0.5 rounded-full text-[10px] font-medium font-mono uppercase tracking-wider bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 flex items-center gap-1.5">
                      <div className="w-1 h-1 rounded-full bg-zinc-500" />
                      Testnet
                    </div>
                  )}
                </div>
              </div>

              {/* MIDDLE: Contracts Grid */}
              <div className="flex flex-col">
                {contracts.map((contract) => {
                  const copyKey = `${instance.id}-${contract.label}`;
                  const isCopied = copiedKey === copyKey;
                  
                  return (
                    <div 
                      key={contract.label} 
                      className="flex items-center justify-between py-2 border-b border-white/[0.02] last:border-0 hover:bg-white/[0.02] -mx-2 px-2 rounded-lg transition-colors"
                    >
                      <span className="text-[13px] text-zinc-400 font-medium">
                        {contract.label}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[13px] text-zinc-300">
                          {shortAddr(contract.address)}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleCopy(contract.address, copyKey)}
                            className={`p-1.5 rounded-md transition-colors ${
                              isCopied 
                                ? 'text-emerald-400 bg-emerald-400/10' 
                                : 'text-zinc-500 hover:text-amber-400 hover:bg-amber-400/10'
                            }`}
                            title="Copy address"
                          >
                            {isCopied ? <CheckIcon className="w-3.5 h-3.5" /> : <CopyIcon className="w-3.5 h-3.5" />}
                          </button>
                          <a
                            href={getAddressUrl(contract.address, instance.chainId)}
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

              {/* BOTTOM: Meta Data */}
              {nodeDetails && (
                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/[0.06]">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-zinc-500 font-mono uppercase tracking-wider text-[9px]">Start Block</span>
                    <span className="text-zinc-300 font-mono text-xs truncate tabular-nums">
                      {nodeDetails.startBlock}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-zinc-500 font-mono uppercase tracking-wider text-[9px]">Deployed At</span>
                    <span className="text-zinc-300 font-mono text-xs truncate">
                      {new Date(nodeDetails.deployedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-zinc-500 font-mono uppercase tracking-wider text-[9px]">Deployed By</span>
                    <span className="text-zinc-300 font-mono text-xs truncate" title={nodeDetails.deployedBy}>
                      {shortAddr(nodeDetails.deployedBy)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
