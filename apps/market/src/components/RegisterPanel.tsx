import React, { useState, useEffect, useRef } from 'react';
import { discoverContracts } from '@sooth/registry/discover';
import type { Address } from 'viem';

interface RegisterPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RegisterPanel({ isOpen, onClose }: RegisterPanelProps) {
  const [chainId, setChainId] = useState('');
  const [rpcUrl, setRpcUrl] = useState('');
  const [launchpadEngine, setLaunchpadEngine] = useState('');
  
  const [chainMeta, setChainMeta] = useState<{name: string, rpcs: string[]} | null>(null);
  const [chainLookupLoading, setChainLookupLoading] = useState(false);
  const [chainLookupError, setChainLookupError] = useState<string | null>(null);
  const [useCustomRpc, setUseCustomRpc] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setChainMeta(null);
    setChainLookupError(null);
    setUseCustomRpc(false);
    setRpcUrl('');
    
    if (!chainId) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    setChainLookupLoading(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://raw.githubusercontent.com/ethereum-lists/chains/master/_data/chains/eip155-${chainId}.json`);
        if (!res.ok) throw new Error('Chain not found');
        
        const data = await res.json();
        const httpRpcs = (data.rpc || []).filter(
          (r: string) => r.startsWith('https://') && !r.includes('${')
        );
        
        if (httpRpcs.length > 0) {
          setChainMeta({ name: data.name, rpcs: httpRpcs });
          setRpcUrl(httpRpcs[0]);
        } else {
          throw new Error('No public HTTP RPCs found');
        }
      } catch (err: any) {
        setChainLookupError(err.message || 'Chain not found');
        setUseCustomRpc(true);
      } finally {
        setChainLookupLoading(false);
      }
    }, 600);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [chainId]);

  const [discovered, setDiscovered] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [success, setSuccess] = useState<{ nodeId: string, message: string } | null>(null);

  const handleDiscover = async () => {
    setError(null);
    if (!chainId || !rpcUrl || !launchpadEngine) {
      setError('All fields are required for discovery');
      return;
    }
    setDiscovering(true);
    try {
      const contracts = await discoverContracts(Number(chainId), rpcUrl, launchpadEngine as Address);
      setDiscovered(contracts);
    } catch (err: any) {
      setError(err.message || 'Failed to discover contracts');
      setDiscovered(null);
    } finally {
      setDiscovering(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!discovered) return;
    
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('https://access.sooth.market/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chainId: Number(chainId),
          rpcUrl,
          launchpadEngine
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Registration failed');
      }
      setSuccess({
        nodeId: data.nodeId,
        message: data.message || 'Your node is pending review'
      });
    } catch (err: any) {
      setError(err.message || 'An error occurred during registration');
    } finally {
      setSubmitting(false);
    }
  };

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setSuccess(null);
        setDiscovered(null);
        setError(null);
        setChainId('');
        setRpcUrl('');
        setLaunchpadEngine('');
      }, 300);
    }
  }, [isOpen]);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm z-40" 
          onClick={onClose} 
        />
      )}

      {/* Slide-over panel */}
      <div 
        className={`fixed inset-y-0 right-0 w-full max-w-[480px] bg-zinc-950 border-l border-white/5 z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Panel Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 shrink-0">
          <h2 className="text-xl font-bold tracking-tight text-zinc-50">Register Your Node</h2>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/5 text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Panel Body */}
        <div className="flex-1 overflow-y-auto px-6 py-8">
          {success ? (
            <div className="surface-card p-8 text-center rounded-[2rem] border border-amber-500/20 bg-amber-500/5">
              <div className="w-16 h-16 bg-amber-500/20 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-amber-50 mb-2">Registration Submitted</h3>
              <p className="text-amber-200/80 mb-6">{success.message}</p>
              <div className="inline-block bg-zinc-950 border border-white/10 rounded-lg px-4 py-3 font-mono text-sm text-zinc-300 mb-8 w-full break-all">
                Node ID: <span className="text-white">{success.nodeId}</span>
              </div>
              <button
                onClick={onClose}
                className="w-full bg-zinc-100 text-zinc-950 font-medium py-3 rounded-lg hover:bg-white transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <p className="text-zinc-400 text-sm leading-relaxed">
                Submit your node for indexer aggregation. We'll automatically discover your core contracts from your LaunchpadEngine.
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-6 mt-2">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-zinc-300">Chain ID</label>
                  <input
                    type="number"
                    value={chainId}
                    onChange={e => setChainId(e.target.value)}
                    placeholder="e.g. 84532"
                    className="bg-zinc-900 border border-white/10 rounded-lg px-4 py-3 text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                    required
                  />
                  {chainLookupLoading ? (
                    <div className="text-xs text-zinc-500 mt-1 animate-pulse font-mono uppercase tracking-wider">Looking up chain...</div>
                  ) : chainMeta ? (
                    <div className="text-xs text-zinc-400 mt-1 font-mono uppercase tracking-wider">{chainMeta.name}</div>
                  ) : chainLookupError && chainId ? (
                    <div className="text-xs text-zinc-500 mt-1 font-mono uppercase tracking-wider">Chain not found — enter RPC manually</div>
                  ) : null}
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-zinc-300">RPC URL</label>
                  {chainMeta && !useCustomRpc ? (
                    <select
                      value={rpcUrl}
                      onChange={e => {
                        if (e.target.value === 'custom') {
                          setUseCustomRpc(true);
                          setRpcUrl('');
                        } else {
                          setRpcUrl(e.target.value);
                        }
                      }}
                      className="bg-zinc-900 border border-white/10 rounded-lg px-4 py-3 text-white font-mono focus:outline-none focus:border-amber-500/50 appearance-none transition-colors"
                      required
                    >
                      {chainMeta.rpcs.map((rpc, i) => (
                        <option key={i} value={rpc}>{rpc}</option>
                      ))}
                      <option value="custom">Custom RPC...</option>
                    </select>
                  ) : (
                    <input
                      type="url"
                      value={rpcUrl}
                      onChange={e => setRpcUrl(e.target.value)}
                      placeholder="https://..."
                      className="bg-zinc-900 border border-white/10 rounded-lg px-4 py-3 text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                      required
                    />
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-zinc-300">LaunchpadEngine Address</label>
                  <input
                    type="text"
                    value={launchpadEngine}
                    onChange={e => setLaunchpadEngine(e.target.value)}
                    placeholder="0x..."
                    className="bg-zinc-900 border border-white/10 rounded-lg px-4 py-3 text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                    required
                  />
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                {!discovered ? (
                  <button
                    type="button"
                    onClick={handleDiscover}
                    disabled={discovering}
                    className="w-full bg-zinc-100 text-zinc-950 font-medium py-3 rounded-lg hover:bg-white disabled:opacity-50 transition-colors mt-2"
                  >
                    {discovering ? 'Discovering...' : 'Discover Contracts'}
                  </button>
                ) : (
                  <div className="space-y-6 mt-2">
                    <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-4">
                      <h4 className="text-[10px] font-mono font-medium text-zinc-400 mb-4 uppercase tracking-widest">Discovered Contracts</h4>
                      <div className="space-y-3 font-mono text-xs">
                        {Object.entries(discovered).map(([key, value]) => (
                          <div key={key} className="flex flex-col gap-1 border-b border-white/5 pb-2 last:border-0 last:pb-0">
                            <span className="text-zinc-500 uppercase tracking-wider">{key}</span>
                            <span className="text-amber-400 break-all">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex gap-4">
                      <button
                        type="button"
                        onClick={() => setDiscovered(null)}
                        className="flex-1 bg-zinc-900 text-zinc-300 font-medium py-3 rounded-lg border border-white/10 hover:bg-zinc-800 transition-colors"
                      >
                        Reset
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="flex-[2] w-full bg-amber-500 text-amber-950 font-bold py-3 rounded-lg hover:bg-amber-400 disabled:opacity-50 transition-colors"
                      >
                        {submitting ? 'Submitting...' : 'Submit Registration'}
                      </button>
                    </div>
                  </div>
                )}
              </form>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
