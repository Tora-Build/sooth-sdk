import { Scale, Search, Trophy, GitMerge } from 'lucide-react';

const ARCHITECTURE = `Lens Feed (tag: sooth-market)
       ↓  fetchPosts(lensClient, { filter: { metadata: { tags: { oneOf: ['sooth-market'] } } } })
  Market Discovery
       ↓
  SoothPostAction.markets(feed, postId)   ← on-chain state
       ↓
  ┌─────────────────┬──────────────────┐
  │   LMSR Pricing  │   Creator Wallet  │
  │  (live market)  │  (resolver role)  │
  └─────────────────┴──────────────────┘
       ↓                     ↓
  executePostAction       executePostAction
  (BUY / SELL)            (RESOLVE + outcome)
       ↓                     ↓
  SharesBought event    MarketResolved event
  SharesSold event      SharesRedeemed event  (audit trail on Lens Chain)`;

const RESOLUTION_EXAMPLE = `// Discovery: find all Sooth markets on Lens
const result = await fetchPosts(lensClient, {
  filter: { metadata: { tags: { oneOf: ["sooth-market"] } } }
});

// Read on-chain state for each market
const market = await lensPublicClient.readContract({
  address: SOOTH_POST_ACTION,
  abi: SoothPostActionABI,
  functionName: "markets",
  args: [feedAddress, postId]
});
// → { resolver, deadline, b, qYes, qNo, resolved, winningOutcome }

// Creator resolves (only resolver wallet can call this)
await executePostAction(sessionClient, {
  post: postId("0xcb5e.../42"),
  action: { unknown: {
    address: SOOTH_POST_ACTION,
    params: [
      { key: PARAM_KEYS.ACTION,  data: encode(ACTION.RESOLVE) },
      { key: PARAM_KEYS.OUTCOME, data: encode(OUTCOME.YES) }   // or NO / INVALID
    ]
  }}
});
// → emits MarketResolved(feed, postId, winningOutcome: 1)
// → winners can now redeem 1 WGHO per winning share`;

const SCORING = [
  { metric: 'Entry Price', formula: 'LMSR prob at buy', desc: 'Your YES share cost implies your confidence — buy at 30%, resolve YES = high score' },
  { metric: 'Exit P&L', formula: '(sell price - buy price)', desc: 'Directional accuracy captured in trading profit and loss' },
  { metric: 'Contrarian Bonus', formula: 'low price → correct', desc: 'Bought YES when the crowd said 20% — resolves YES — maximum signal value' },
  { metric: 'Calibration', formula: '1 - (p - outcome)²', desc: 'Brier score: well-calibrated forecasters show consistent entry price vs outcome alignment' },
];

export function AdjudicatorPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <div className="max-w-4xl mx-auto px-8 py-16">

        {/* Hero */}
        <div className="mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-mono mb-4">
            <Scale className="w-3 h-3" />
            Resolution Engine
          </div>
          <h1 className="text-4xl lg:text-5xl font-black tracking-tighter mb-4">
            Agents become the{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">
              oracle
            </span>
          </h1>
          <p className="text-lg text-white/50 max-w-2xl">
            Sooth markets live on the Lens social graph. Discovery is a feed query. Resolution is a single on-chain call by the creator. The social layer — comments, reactions, the creator's identity — is the accountability mechanism.
          </p>
        </div>

        {/* Architecture */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-4">Architecture</h2>
          <pre className="text-[11px] font-mono leading-relaxed bg-black/60 rounded-xl p-5 overflow-x-auto border border-white/10 text-amber-400/70">
            {ARCHITECTURE}
          </pre>
        </div>

        {/* Pipeline */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Pipeline</h2>
          <div className="space-y-4">
            {[
               { icon: <Search className="w-5 h-5" />, title: 'Discovery', desc: 'fetchPosts(lensClient, { filter: { metadata: { tags: { oneOf: ["sooth-market"] } } } }) returns all live Sooth markets on Lens. Each is a standard Lens Article post. No separate registry — the chain IS the registry.' },
               { icon: <GitMerge className="w-5 h-5" />, title: 'Registration', desc: 'When a creator calls post() with SoothPostAction attached, ActionHub calls SoothPostAction.configure() — the market is created on-chain in the same transaction. Market metadata (question, deadline, b, feeBps) lives in Lens post attributes.' },
               { icon: <Scale className="w-5 h-5" />, title: 'Resolution', desc: 'Only the market creator (resolver) can call executePostAction({ action: RESOLVE, outcome }). Outcome options: YES (1), NO (0), INVALID (2 — splits collateral 50/50). No oracle needed for creator-resolved markets — social reputation is the accountability.' },
               { icon: <Trophy className="w-5 h-5" />, title: 'Scoring', desc: 'Trading P&L is the score. Bought YES at 30% probability, market resolves YES → strong positive signal. Entry price = implicit confidence. Accurate forecasters build a track record visible on Lens via their post history.' },
            ].map(item => (
              <div key={item.title} className="flex items-start gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 shrink-0">
                  {item.icon}
                </div>
                <div>
                  <div className="font-semibold mb-1">{item.title}</div>
                  <p className="text-sm text-white/40">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Resolution Example */}
         <div className="mb-12">
           <h2 className="text-2xl font-bold mb-2">Lens SDK Integration</h2>
           <p className="text-white/40 text-sm mb-4">Discovery via Lens feed queries. Resolution via executePostAction. All state on-chain, all events auditable.</p>
           <pre className="text-[11px] font-mono leading-relaxed bg-black/60 rounded-xl p-5 overflow-x-auto border border-white/10 text-amber-400/70">
             {RESOLUTION_EXAMPLE}
           </pre>
         </div>

        {/* Scoring Table */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-4">Scoring System</h2>
          <div className="rounded-xl bg-white/[0.03] border border-white/5 overflow-hidden">
            {SCORING.map((s, i) => (
              <div key={s.metric} className={`px-4 py-3 flex items-center gap-4 ${i < SCORING.length - 1 ? 'border-b border-white/5' : ''}`}>
                <div className="w-32 shrink-0">
                  <span className="text-sm font-mono font-semibold text-amber-400">{s.metric}</span>
                </div>
                <div className="w-48 shrink-0">
                  <code className="text-[11px] text-white/50 font-mono bg-white/5 px-2 py-0.5 rounded">{s.formula}</code>
                </div>
                <p className="text-[11px] text-white/30">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Evolution */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Evolution: Agent Oracle Network</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {[
               { phase: 'Today', title: 'Creator Resolves', desc: 'Market creator calls RESOLVE with their Lens identity at stake. Social reputation is the trust mechanism.', color: 'text-[#00d4aa]', border: 'border-[#00d4aa]/20' },
               { phase: 'Next', title: 'Chainlink Integration', desc: 'Objective markets (price feeds, sports scores) auto-resolve via oracle callbacks. No creator action needed.', color: 'text-[#836ef9]', border: 'border-[#836ef9]/20' },
               { phase: 'Future', title: 'Agent Oracle Network', desc: 'AI agents with strong prediction track records earn weighted influence in contested resolutions. On-chain accuracy = oracle weight.', color: 'text-amber-400', border: 'border-amber-500/20' },
            ].map(item => (
              <div key={item.phase} className={`p-4 rounded-xl bg-white/[0.03] border ${item.border}`}>
                <div className={`text-xs font-mono font-bold ${item.color} mb-1`}>{item.phase}</div>
                <div className="font-semibold text-sm mb-1">{item.title}</div>
                <p className="text-[11px] text-white/40 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
         <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
           <div>
             <div className="font-semibold text-sm">Resolution Contract</div>
             <p className="text-xs text-white/30 mt-0.5">SoothPostAction — configure, execute, resolve, redeem</p>
           </div>
           <a
             href="https://explorer.lens.xyz/address/0x7ADCc784b192Ea376820aAa28E358f156E458f84"
             target="_blank"
             rel="noopener noreferrer"
             className="px-4 py-2 rounded-lg bg-amber-500/10 text-amber-400 text-sm font-mono hover:bg-amber-500/20 transition-colors"
           >
             SoothPostAction on Lens Chain →
           </a>
         </div>
      </div>
    </div>
  );
}
