import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import { useAccessGate } from '../hooks/useAccessGate';

const ACCESS_API = 'https://access.sooth.market';

const SoothLogo = ({ size = 48 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 200 200" fill="none">
    <path d="M100 50L180 120L100 190L20 120Z" fill="#818CF8" opacity="0.4" stroke="#818CF8" strokeWidth="1"/>
    <path d="M100 30L180 100L100 170L20 100Z" fill="#C084FC" opacity="0.4" stroke="#C084FC" strokeWidth="1"/>
    <path d="M100 10L180 80L100 150L20 80Z" fill="#22D3EE" opacity="0.6" stroke="#22D3EE" strokeWidth="2"/>
    <path d="M100 10V190" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="1.0"/>
  </svg>
);

const elegantStyles = `
  @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes gradientShift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
  .float { animation: float 6s ease-in-out infinite; }
  .fade-up { animation: fadeUp 0.8s ease-out both; }
  .fade-up-d1 { animation: fadeUp 0.8s ease-out 0.1s both; }
  .fade-up-d2 { animation: fadeUp 0.8s ease-out 0.2s both; }
  .fade-up-d3 { animation: fadeUp 0.8s ease-out 0.3s both; }
  .fade-up-d4 { animation: fadeUp 0.8s ease-out 0.4s both; }
  .gradient-shift { background-size: 200% 200%; animation: gradientShift 8s ease infinite; }
`;

export function AccessGate() {
  const { allowed, loading, isConnected, address } = useAccessGate();
  const [email, setEmail] = useState('');
  const [requestStatus, setRequestStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const handleRequest = async () => {
    if (!address) return;
    setRequestStatus('sending');
    try {
      const res = await fetch(`${ACCESS_API}/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address.toLowerCase(), email: email || undefined }),
      });
      if (res.ok) setRequestStatus('sent');
      else setRequestStatus('error');
    } catch {
      setRequestStatus('error');
    }
  };

  // Checking access
  if (isConnected && (loading || allowed === null)) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <style>{elegantStyles}</style>
        <div className="text-center fade-up">
          <div className="float inline-block mb-6"><SoothLogo size={48} /></div>
          <div className="flex items-center justify-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-[#836ef9] animate-pulse" />
            <span className="text-white/30 font-mono text-xs tracking-wider">verifying</span>
          </div>
        </div>
      </div>
    );
  }

  // Allowed
  if (isConnected && allowed === true) {
    return <Outlet />;
  }

  // Not connected OR not allowed — unified page
  const denied = isConnected && allowed === false;

  return (
    <div className="min-h-screen bg-[#020617] flex flex-col">
      <style>{elegantStyles}</style>

      {/* Ambient glow */}
      <div className="fixed top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-[#836ef9]/6 via-[#00d4aa]/4 to-transparent rounded-full blur-[120px] pointer-events-none" />

      {/* Top right wallet (when connected) */}
      {isConnected && (
        <div className="fixed top-4 right-4 z-50 fade-up">
          <w3m-button size="sm" />
        </div>
      )}

      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-md w-full">
          {/* Logo + title */}
          <div className="text-center mb-10 fade-up">
            <div className="float inline-block mb-8">
              <SoothLogo size={64} />
            </div>
            <h1 className="text-3xl font-bold text-white mb-3 font-mono tracking-tight">
              sooth
            </h1>
            <p className="text-white/25 text-sm font-mono leading-relaxed max-w-xs mx-auto">
              Permissionless prediction markets with dual venue execution and trustless settlement
            </p>
            <div className="flex items-center justify-center gap-2 mt-4">
              <span className="w-1.5 h-1.5 rounded-full bg-[#836ef9] animate-pulse" />
              <span className="text-[10px] text-white/20 font-mono uppercase tracking-widest">
                {denied ? 'Early Access · Invite Only' : 'Early Access · Base Sepolia'}
              </span>
            </div>
          </div>

          {/* Action card */}
          <div className="fade-up-d1 mb-10">
            {denied ? (
              // Request form
              requestStatus === 'sent' ? (
                <div className="p-8 rounded-2xl border border-[#00d4aa]/10 bg-[#00d4aa]/[0.03] text-center">
                  <div className="w-12 h-12 rounded-full border border-[#00d4aa]/20 flex items-center justify-center mx-auto mb-4">
                    <span className="text-[#00d4aa] text-lg">✓</span>
                  </div>
                  <p className="text-white/60 text-sm font-mono mb-1">Request received</p>
                  <p className="text-white/20 text-xs font-mono">We'll review and grant access shortly.</p>
                </div>
              ) : (
                <div className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.015] backdrop-blur-sm">
                  <h3 className="text-xs font-semibold text-white/40 font-mono uppercase tracking-widest mb-4">Request an invite</h3>
                  <input
                    type="email"
                    placeholder="email (optional)"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-white text-sm font-mono placeholder:text-white/15 focus:outline-none focus:border-[#836ef9]/30 transition-colors mb-3"
                  />
                  <button
                    onClick={handleRequest}
                    disabled={requestStatus === 'sending'}
                    className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-[#836ef9] to-[#00d4aa] gradient-shift text-white font-semibold text-sm font-mono hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    {requestStatus === 'sending' ? 'Submitting...' : 'Request Access'}
                  </button>
                  {requestStatus === 'error' && (
                    <p className="text-red-400/60 text-xs font-mono mt-3 text-center">Something went wrong. Try again.</p>
                  )}
                </div>
              )
            ) : (
              // Connect wallet
              <div className="p-8 rounded-2xl border border-white/[0.06] bg-white/[0.015] backdrop-blur-sm text-center">
                <p className="text-white/40 text-xs font-mono uppercase tracking-widest mb-6">Connect to continue</p>
                <w3m-button />
              </div>
            )}
          </div>

          {/* Features */}
          <div className="fade-up-d2 grid grid-cols-2 gap-3 mb-10">
            {[
              { title: 'Dual Venue', desc: 'AMM + orderbook' },
              { title: 'UMA Oracle', desc: 'Trustless settlement' },
              { title: 'Creator Fees', desc: 'Earn from markets' },
              { title: 'Portfolio', desc: 'Track positions & P&L' },
            ].map(f => (
              <div key={f.title} className="p-3 rounded-lg border border-white/[0.03] bg-white/[0.005]">
                <div className="text-xs font-semibold text-white/40 font-mono">{f.title}</div>
                <div className="text-[10px] text-white/15 font-mono mt-0.5">{f.desc}</div>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="fade-up-d3 flex justify-center gap-12 mb-6">
            {[
              { v: '50+', l: 'markets' },
              { v: '16', l: 'settled' },
              { v: '2', l: 'venues' },
            ].map(s => (
              <div key={s.l} className="text-center">
                <div className="text-lg font-bold text-white/60 font-mono">{s.v}</div>
                <div className="text-[9px] text-white/15 font-mono uppercase tracking-widest mt-0.5">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="fade-up-d4 py-8 text-center">
        <div className="flex items-center justify-center gap-8 text-[11px] font-mono">
          <a href="https://sooth.market" className="text-white/15 hover:text-white/40 transition-colors">protocol</a>
          <a href="https://sooth.market/whitepaper.html" className="text-white/15 hover:text-white/40 transition-colors">whitepaper</a>
          <a href="https://sayer.sooth.market" className="text-white/15 hover:text-white/40 transition-colors">soothsayer</a>
          <a href="https://x.com/SoothProtocol" target="_blank" rel="noopener" className="text-white/15 hover:text-white/40 transition-colors">X</a>
        </div>
        <p className="text-[10px] text-white/8 font-mono mt-3">Base Sepolia Testnet</p>
      </div>
    </div>
  );
}
