import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { discoverContracts } from '@sooth/registry/discover';
import type { Address } from 'viem';

export function RegisterPage() {
  const [chainId, setChainId] = useState('');
  const [rpcUrl, setRpcUrl] = useState('');
  const [launchpadEngine, setLaunchpadEngine] = useState('');
  
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
          <div className="font-mono text-xs text-zinc-500">Node Operator Platform</div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-8">
          <Link to="/" className="text-zinc-500 hover:text-zinc-300 font-mono text-sm mb-4 inline-block">
            ← Back to Terminal
          </Link>
          <h2 className="text-3xl font-bold tracking-tighter">Register Your Node</h2>
          <p className="text-zinc-400 mt-2">
            Submit your node for indexer aggregation. We'll automatically discover your core contracts from your LaunchpadEngine.
          </p>
        </div>

        {success ? (
          <div className="surface-card p-8 text-center rounded-[2.5rem] border border-amber-500/20 bg-amber-500/5">
            <div className="w-16 h-16 bg-amber-500/20 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-amber-50 mb-2">Registration Submitted</h3>
            <p className="text-amber-200/80 mb-6">{success.message}</p>
            <div className="inline-block bg-zinc-950 border border-white/10 rounded-lg px-4 py-3 font-mono text-sm text-zinc-300">
              Node ID: <span className="text-white">{success.nodeId}</span>
            </div>
          </div>
        ) : (
          <div className="surface-card p-8 rounded-[2.5rem] border border-white/5">
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-zinc-300">Chain ID</label>
                <input
                  type="number"
                  value={chainId}
                  onChange={e => setChainId(e.target.value)}
                  placeholder="e.g. 84532"
                  className="bg-zinc-900 border border-white/10 rounded-lg px-4 py-3 text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50"
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-zinc-300">RPC URL</label>
                <input
                  type="url"
                  value={rpcUrl}
                  onChange={e => setRpcUrl(e.target.value)}
                  placeholder="https://..."
                  className="bg-zinc-900 border border-white/10 rounded-lg px-4 py-3 text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50"
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-zinc-300">LaunchpadEngine Address</label>
                <input
                  type="text"
                  value={launchpadEngine}
                  onChange={e => setLaunchpadEngine(e.target.value)}
                  placeholder="0x..."
                  className="bg-zinc-900 border border-white/10 rounded-lg px-4 py-3 text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50"
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
                  className="w-full bg-zinc-100 text-zinc-950 font-medium py-3 rounded-lg hover:bg-white disabled:opacity-50 transition-colors"
                >
                  {discovering ? 'Discovering...' : 'Discover Contracts'}
                </button>
              ) : (
                <div className="space-y-6">
                  <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-4">
                    <h4 className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-wider">Discovered Contracts</h4>
                    <div className="space-y-3 font-mono text-xs">
                      {Object.entries(discovered).map(([key, value]) => (
                        <div key={key} className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-4 border-b border-white/5 pb-2 last:border-0 last:pb-0">
                          <span className="text-zinc-500">{key}</span>
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
                      className="flex-2 w-full bg-amber-500 text-amber-950 font-bold py-3 rounded-lg hover:bg-amber-400 disabled:opacity-50 transition-colors"
                    >
                      {submitting ? 'Submitting...' : 'Submit Registration'}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        )}
      </main>
    </div>
  );
}