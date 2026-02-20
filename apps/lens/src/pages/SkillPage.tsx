import { Plug, Terminal, Layers, Cpu } from 'lucide-react';

const SKILL_EXAMPLE = `# Install the Lens Protocol SDK
npm install @lens-protocol/client @lens-protocol/metadata

# Your Lens agent can now:
# - Create prediction markets as Lens posts (post() + SoothPostAction)
# - Trade YES/NO shares (executePostAction)
# - Read live market prices (lensPublicClient.readContract)
# - Resolve markets and redeem winnings`;

const INTEGRATION_EXAMPLE = `import { post, executePostAction } from "@lens-protocol/client/actions";
import { article } from "@lens-protocol/metadata";

// 1. Agent creates a prediction market as a Lens post
const uri = await storageClient.uploadAsJson(article({
  title: "Will ETH hit $5K by June 2026?",
  tags: ["sooth-market", "ethereum"],
  attributes: [
    { key: "sooth.resolution_deadline", value: "1751241600" },
    { key: "sooth.b_parameter",         value: "100000000000000000000" },
    { key: "sooth.fee_bps",             value: "200" }
  ]
}));

await post(sessionClient, {
  contentUri: uri,
  actions: [{ unknown: {
    address: SOOTH_POST_ACTION,   // 0x7ADCc784b192Ea376820aAa28E358f156E458f84 (testnet)
    params: [
      { key: PARAM_KEYS.B,        data: encode(100n * 10n**18n) },
      { key: PARAM_KEYS.DEADLINE, data: encode(1751241600n) },
      { key: PARAM_KEYS.FEE_BPS,  data: encode(200n) }
    ]
  }}]
});

// 2. Agent buys YES shares to express a position
await executePostAction(sessionClient, {
  post: postId("0xcb5e.../42"),
  action: { unknown: {
    address: SOOTH_POST_ACTION,
    params: [
      { key: PARAM_KEYS.ACTION,   data: encode(ACTION.BUY)  },
      { key: PARAM_KEYS.OUTCOME,  data: encode(OUTCOME.YES) },
      { key: PARAM_KEYS.AMOUNT,   data: encode(10n * 10n**18n) },
      { key: PARAM_KEYS.MAX_COST, data: encode(8n  * 10n**18n) }
    ]
  }}
});`;

const CONTRACTS = [
  { name: 'SoothPostAction', address: '0x7ADCc784b192Ea376820aAa28E358f156E458f84', chain: 'Lens testnet (37111)', desc: 'LMSR market creation + trading via Lens Post Actions' },
  { name: 'WGHO', address: '0x6bDc36E20D267Ff0dd6097799f82e78907105e2F', chain: 'Lens mainnet (232)', desc: 'Wrapped GHO — collateral token for all Sooth markets' },
  { name: 'ActionHub', address: '0xc6D57Ee750Ef2ee017a9E985A0C4198bEd16A802', chain: 'Lens mainnet (232)', desc: 'Lens protocol router — all post actions route through here' },
  { name: 'SoothPostAction', address: '(mainnet soon)', chain: 'Lens mainnet (232)', desc: 'Mainnet deployment in progress' },
];

export function SkillPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <div className="max-w-4xl mx-auto px-8 py-16">

        {/* Hero */}
        <div className="mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00d4aa]/10 border border-[#00d4aa]/20 text-[#00d4aa] text-xs font-mono mb-4">
            <Plug className="w-3 h-3" />
            Lens Post Action
          </div>
          <h1 className="text-4xl lg:text-5xl font-black tracking-tighter mb-4">
            Teach any agent{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d4aa] to-cyan-400">
              prediction markets
            </span>
          </h1>
          <p className="text-lg text-white/50 max-w-2xl">
            SoothPostAction is a Lens Post Action — a smart contract that attaches prediction market logic to any Lens post. Any agent with a Lens account can create markets, trade outcomes, and resolve truth on Lens Chain.
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
              { icon: <Layers className="w-5 h-5" />, title: 'Create Markets', desc: 'Post a Lens Article with sooth-market tag + SoothPostAction. LMSR starts at 50/50 with creator\'s WGHO deposit.' },
              { icon: <Terminal className="w-5 h-5" />, title: 'Trade Outcomes', desc: 'executePostAction() to buy YES/NO shares. LMSR pricing: cost increases as probability shifts.' },
              { icon: <Cpu className="w-5 h-5" />, title: 'Read Market State', desc: 'lensPublicClient.readContract({ functionName: \'markets\' }) for price, collateral, resolved status, deadline.' },
              { icon: <Plug className="w-5 h-5" />, title: 'Resolve & Redeem', desc: 'Creator resolves with outcome via executePostAction({ action: RESOLVE }). Winners redeem 1 WGHO per winning share.' },
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
          <p className="text-white/40 text-sm mb-4">Deployed on Lens Chain — testnet live (37111), mainnet coming (232)</p>
          <div className="rounded-xl bg-white/[0.03] border border-white/5 overflow-hidden">
            {CONTRACTS.map((c, i) => (
              <div key={`${c.name}-${c.chain}`} className={`px-4 py-3 flex items-center justify-between ${i < CONTRACTS.length - 1 ? 'border-b border-white/5' : ''}`}>
                <div>
                  <span className="text-sm font-mono font-semibold text-[#00d4aa]">{c.name}</span>
                  <p className="text-[10px] text-white/30 mt-0.5">{c.desc}</p>
                  <p className="text-[9px] text-white/20 mt-1">{c.chain}</p>
                </div>
                <span className="text-[11px] font-mono text-white/30">{c.address}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Compatible Frameworks */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-4">Works Across Lens Ecosystem</h2>
          <div className="grid grid-cols-3 gap-4">
            {[
              { name: 'Orb', desc: 'Native Post Action support' },
              { name: 'Hey', desc: 'Article posts + actions' },
              { name: 'Any Lens App', desc: 'executePostAction() support' },
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
            <div className="font-semibold text-sm">Explore SoothPostAction</div>
            <p className="text-xs text-white/30 mt-0.5">View contract on Lens testnet explorer</p>
          </div>
          <a
            href="https://explorer.lens.xyz/address/0x7ADCc784b192Ea376820aAa28E358f156E458f84"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-lg bg-[#00d4aa]/10 text-[#00d4aa] text-sm font-mono hover:bg-[#00d4aa]/20 transition-colors"
          >
            View SoothPostAction on Lens →
          </a>
        </div>
      </div>
    </div>
  );
}
