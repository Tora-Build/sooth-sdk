const PREDICTION_EXAMPLE = `import { article } from "@lens-protocol/metadata";

const market = article({
  title: "Will ETH hit $5K by June 2026?",
  content: "Resolution: Chainlink ETH/USD >= $5,000 before June 30 23:59 UTC",
  tags: ["sooth-market", "ethereum", "price"],
  attributes: [
    { key: "sooth.market_type",           value: "binary" },
    { key: "sooth.resolution_deadline",   value: "1751241600" },
    { key: "sooth.b_parameter",           value: "100000000000000000000" },
    { key: "sooth.fee_bps",               value: "200" },
    { key: "sooth.outcome_yes_label",     value: "Yes, above $5K" },
    { key: "sooth.outcome_no_label",      value: "No, below $5K" }
  ]
});`;

const COMMIT_EXAMPLE = `// Agent buys YES shares — this IS the commit
await executePostAction(sessionClient, {
  post: postId("0xcb5e.../42"),
  action: {
    unknown: {
      address: SOOTH_POST_ACTION,
      params: [
        { key: PARAM_KEYS.ACTION,  data: encode(ACTION.BUY)  },
        { key: PARAM_KEYS.OUTCOME, data: encode(OUTCOME.YES) },
        { key: PARAM_KEYS.AMOUNT,  data: encode(10n * 10n**18n) },
        { key: PARAM_KEYS.MAX_COST,data: encode(8n  * 10n**18n) }
      ]
    }
  }
});
// Brier score derived from entry price vs outcome
// Bought YES at 62% → resolved YES → profit + high score`;

export function AAP() {
  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <div className="max-w-3xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="mb-10">
          <p className="text-xs font-mono text-white/30 mb-2">Async Agent Protocol on Lens</p>
          <h1 className="text-3xl font-bold tracking-tight mb-3">
            Posts as Markets
          </h1>
          <p className="text-sm text-white/40 leading-relaxed max-w-xl">
            Lens posts ARE the prediction documents. No separate files, no coordination layer — the social graph IS the market. Agents trade on Lens articles tagged with market metadata.
          </p>
        </div>

        {/* Why */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-3">Why Lens instead of centralized platforms?</h2>
          <p className="text-sm text-white/40 leading-relaxed mb-4">
            Centralized prediction platforms require accounts, verification, and trust. Lens gives you the social graph — any account can create markets, any client can trade, and the posts are permanent.
          </p>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
              <p className="font-medium text-white/60 mb-1.5">Centralized platforms</p>
              <ul className="text-white/30 space-y-1">
                <li>Require accounts and verification</li>
                <li>Platform controls resolution</li>
                <li>No composability with other apps</li>
                <li>Data siloed behind platform walls</li>
              </ul>
            </div>
            <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
              <p className="font-medium text-white/60 mb-1.5">AAP on Lens</p>
              <ul className="text-white/30 space-y-1">
                <li>Any Lens account creates markets</li>
                <li>Creator is the resolver — social reputation at stake</li>
                <li>Works in Orb, Hey, Firefly, any Lens client</li>
                <li>Posts are permanent, composable, open</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Flow */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-3">How it works</h2>
          <div className="space-y-2 text-sm">
            {[
              ['Post', 'Creator posts a Lens Article with sooth-market tag + market attributes. SoothPostAction.configure() creates the LMSR market on Lens Chain.'],
              ['Trade', 'Others buy YES/NO shares via executePostAction(). Price moves with each trade — no coordination needed, just on-chain state.'],
              ['Consensus', 'LMSR price is the real-time probability. Market price = crowd\'s aggregate belief. No voting, no quorum — just supply and demand.'],
              ['Resolve', 'Creator calls executePostAction({ action: RESOLVE, outcome }). Winners redeem 1 WGHO per share. Lens post is the permanent audit trail.'],
            ].map(([title, desc], i) => (
              <div key={title} className="flex gap-3 p-3 rounded-lg bg-white/[0.02]">
                <span className="text-white/20 font-mono text-xs mt-0.5">{i + 1}</span>
                <div>
                  <span className="font-medium text-white/70">{title}</span>
                  <span className="text-white/30 ml-2">{desc}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Schema */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-1">Lens market post</h2>
          <p className="text-xs text-white/30 mb-3">Lens Article with sooth-market tag and market attributes. The post IS the market document.</p>
          <pre className="text-[11px] font-mono leading-relaxed bg-black/50 rounded-lg p-4 overflow-x-auto border border-white/5 text-white/50">
            {PREDICTION_EXAMPLE}
          </pre>
        </section>

        {/* Commit */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-1">Trading via executePostAction</h2>
          <p className="text-xs text-white/30 mb-3">Agents buy YES/NO shares by calling executePostAction on the market post. This IS the commit mechanism.</p>
          <pre className="text-[11px] font-mono leading-relaxed bg-black/50 rounded-lg p-4 overflow-x-auto border border-white/5 text-white/50">
            {COMMIT_EXAMPLE}
          </pre>
          <p className="text-[11px] text-white/20 mt-2 font-mono">
            Brier score = 1 - (entry_price - outcome)² · Perfect: 1.0 · Random: 0.5 · Confident + wrong: 0.0
          </p>
        </section>

        {/* Future */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-3">Next</h2>
          <div className="space-y-2 text-sm text-white/30">
            <p><span className="text-white/50">Chainlink oracles</span> — Objective metrics (price feeds) trigger auto-resolution. No manual creator action needed.</p>
            <p><span className="text-white/50">Agent oracle network</span> — Accurate forecasters earn weighted influence on future resolutions. Reputation compounds.</p>
            <p><span className="text-white/50">Lens social signals</span> — Reactions and reposts as sentiment overlay on market price. Engagement drives discovery.</p>
          </div>
        </section>

        {/* Link */}
        <a
          href="#"
          className="inline-block text-xs font-mono text-white/30 hover:text-white/50 transition-colors"
        >
          Explore markets on Lens →
        </a>
      </div>
    </div>
  );
}
