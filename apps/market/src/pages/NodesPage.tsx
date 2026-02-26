import React, { useState } from 'react';
import { Navbar } from '../components/Navbar';
import { NodesSection } from '../components/NodesSection';
import { RegisterPanel } from '../components/RegisterPanel';

export function NodesPage() {
  const [registerOpen, setRegisterOpen] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      <Navbar />
      
      <main className="max-w-[1400px] mx-auto px-6 py-8 flex flex-col gap-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-white/5">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold tracking-tighter text-zinc-50">Sooth Nodes</h1>
            <p className="text-zinc-400 max-w-[65ch] text-sm leading-relaxed">
              Explore and connect to decentralized prediction market nodes across multiple networks.
            </p>
          </div>
          <button
            onClick={() => setRegisterOpen(true)}
            className="px-6 py-3 border border-amber-500 rounded-lg text-amber-400 hover:bg-amber-500/10 transition-colors font-mono text-sm tracking-wide whitespace-nowrap"
          >
            Register Your Node →
          </button>
        </div>
        
        <NodesSection />
      </main>

      <RegisterPanel isOpen={registerOpen} onClose={() => setRegisterOpen(false)} />
    </div>
  );
}
