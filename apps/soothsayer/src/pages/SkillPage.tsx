import { Plug, Terminal, Layers, Cpu } from 'lucide-react';

const SKILL_EXAMPLE = `# Copy skill into your agent workspace
cp skill/SKILL.md ~/your-agent/skills/sooth-protocol/SKILL.md

# Your agent now knows how to:
# - Read prediction documents
# - Create on-chain markets via LaunchpadEngine
# - Trade YES/NO outcome tokens
# - Settle and finalize markets`;

const INTEGRATION_EXAMPLE = `// Agent reads a prediction document
const prediction = await readFile("predictions.json");
const pending = prediction.predictions.filter(p => p.status === "pending");

// Agent commits to a prediction
const commit = "[COMMIT] YES 80%";
await postComment(pending[0].source_url, commit);

// Agent creates on-chain market (via Sooth Protocol skill)
await createMarket({
  question: pending[0].question,
  deadline: pending[0].resolution.deadline,
  chainId: 10143 // Monad Testnet
});`;

const CONTRACTS = [
  { name: 'LaunchpadEngine', address: '0x7447...2084', desc: 'Market creation + bonding curve' },
  { name: 'AMMEngine', address: '0x6714...96a7', desc: 'Automated market making' },
  { name: 'Collateralizer', address: '0x5799...632f', desc: 'Token minting + collateral' },
  { name: 'TickBookPoolManager', address: '0xcc8f...98b4', desc: 'Order book + AMM hybrid' },
  { name: 'MockUSDC', address: '0x3b2f...222a', desc: 'Test collateral token' },
];

export function SkillPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <div className="max-w-4xl mx-auto px-8 py-16">

        {/* Hero */}
        <div className="mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00d4aa]/10 border border-[#00d4aa]/20 text-[#00d4aa] text-xs font-mono mb-4">
            <Plug className="w-3 h-3" />
            Drop-in Agent Skill
          </div>
          <h1 className="text-4xl lg:text-5xl font-black tracking-tighter mb-4">
            Teach any agent{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d4aa] to-cyan-400">
              prediction markets
            </span>
          </h1>
          <p className="text-lg text-white/50 max-w-2xl">
            One file. Drop it into your agent's skills directory. Now it knows how to create markets, 
            trade outcomes, and resolve truth on Sooth Protocol.
          </p>
        </div>

        {/* Quick Start */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-4">Quick Start</h2>
          <pre className="text-[11px] font-mono leading-relaxed bg-black/60 rounded-xl p-5 overflow-x-auto border border-white/10 text-[#00d4aa]/80">
            {SKILL_EXAMPLE}
          </pre>
        </div>

        {/* What Your Agent Learns */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">What Your Agent Learns</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { icon: <Layers className="w-5 h-5" />, title: 'Create Markets', desc: 'Deploy prediction markets on LaunchpadEngine with bonding curve bootstrapping. Markets graduate to full AMM at threshold.' },
              { icon: <Terminal className="w-5 h-5" />, title: 'Trade Outcomes', desc: 'Buy and sell YES/NO tokens. Bonding curve for early markets, TickBook AMM for graduated ones.' },
              { icon: <Cpu className="w-5 h-5" />, title: 'Read Market State', desc: 'Query bonding, live, settled, or finalized status. Check probabilities, deadlines, and LP positions.' },
              { icon: <Plug className="w-5 h-5" />, title: 'Settle & Resolve', desc: 'Submit outcomes, finalize markets, and claim winnings. Two-step settlement: resolve → finalize.' },
            ].map(item => (
              <div key={item.title} className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="flex items-center gap-2 mb-2 text-[#00d4aa]">
                  {item.icon}
                  <span className="font-semibold text-sm">{item.title}</span>
                </div>
                <p className="text-[11px] text-white/40 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Integration Example */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-2">Integration Example</h2>
          <p className="text-white/40 text-sm mb-4">Combine Data (AAP) + Skill to build a complete prediction market agent.</p>
          <pre className="text-[11px] font-mono leading-relaxed bg-black/60 rounded-xl p-5 overflow-x-auto border border-white/10 text-[#836ef9]/80">
            {INTEGRATION_EXAMPLE}
          </pre>
        </div>

        {/* Contracts */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-4">Sooth Protocol Contracts</h2>
          <p className="text-white/40 text-sm mb-4">Deployed on Monad Testnet (10143) and Base Sepolia (84532)</p>
          <div className="rounded-xl bg-white/[0.03] border border-white/5 overflow-hidden">
            {CONTRACTS.map((c, i) => (
              <div key={c.name} className={`px-4 py-3 flex items-center justify-between ${i < CONTRACTS.length - 1 ? 'border-b border-white/5' : ''}`}>
                <div>
                  <span className="text-sm font-mono font-semibold text-[#00d4aa]">{c.name}</span>
                  <p className="text-[10px] text-white/30 mt-0.5">{c.desc}</p>
                </div>
                <span className="text-[11px] font-mono text-white/30">{c.address}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Compatible Frameworks */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-4">Compatible With</h2>
          <div className="grid grid-cols-3 gap-4">
            {[
              { name: 'OpenClaw', desc: 'Drop SKILL.md into skills/' },
              { name: 'LangChain', desc: 'Use as tool reference' },
              { name: 'Any Framework', desc: 'Read as markdown context' },
            ].map(f => (
              <div key={f.name} className="p-4 rounded-xl bg-white/[0.03] border border-white/5 text-center">
                <div className="font-semibold text-sm mb-1">{f.name}</div>
                <p className="text-[10px] text-white/30">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
          <div>
            <div className="font-semibold text-sm">Get the Skill</div>
            <p className="text-xs text-white/30 mt-0.5">SKILL.md + integration guide + contract addresses</p>
          </div>
          <a
            href="https://github.com/Tora-Build/soothsayer-core/tree/main/skill"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-lg bg-[#00d4aa]/10 text-[#00d4aa] text-sm font-mono hover:bg-[#00d4aa]/20 transition-colors"
          >
            View on GitHub →
          </a>
        </div>
      </div>
    </div>
  );
}
