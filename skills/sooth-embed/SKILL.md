---
name: sooth-embed
description: Embed Sooth Factory prediction markets in a website or React app. Covers the hosted iframe snippet (panel, drawer, modal), native SoothNode/SoothMarket components from sooth/react, trusted runtime configuration, wallet adapters and handoff, host messages, CSP and CORS. Use when a developer integrates a Sooth node or market into a frontend.
metadata: { "openclaw": { "homepage": "https://github.com/Tora-Build/sooth-sdk" } }
---

# Sooth Embed

Use this skill to put a Sooth node (a browsable set of markets) or one market
into a host page. For protocol actions from scripts or agents, such as
creation, trading, resolution and claims through the CLI, use the
`sooth-markets` skill.

## Availability

Two things are missing today, and they are separate:

- **Package release.** The published `sooth@1.0.0` contains SQF only.
  `sooth/react` and `sooth/factory` exist only in an SDK checkout.
- **Widget deployment.** No public widget origin is deployed. Get the widget
  origin from the operator. Do not invent one.

To use the React path now, build and pack the checkout with Node.js 22+:

```sh
pnpm install --frozen-lockfile && pnpm build
pnpm pack --pack-destination /tmp/sooth-pack
npm install --save-exact /tmp/sooth-pack/sooth-<version>.tgz
```

The local tarball can report version `1.0.0`, the same number as the npm
release, with different content. Install it only from the file path. Never let
`sooth@1.0.0` resolve from the registry.

For local widget development, first build the Alpha workspace SDK and registry
packages, then run `pnpm --filter sooth-embed dev` in `sooth-alpha`. The widget
serves at `http://127.0.0.1:5180`.

## Select the integration path

| Host | Use | Wallet |
| --- | --- | --- |
| HTML, CMS, any framework | Hosted iframe snippet from `<widget-origin>/v1/generator` | Inside the widget; user-initiated wallet window |
| React app | Native `SoothNode` from `sooth/react` | Component-managed injected wallet, or host adapter |
| One market only | `SoothMarket`, or `generateSoothEmbed` for its iframe | Same as above |

Prefer the iframe when the host has no React or does not own a wallet.
Prefer native React when the host already has a wallet connection.

## Identity references

The publisher selects the node. Never shorten IDs or drop the release or venue.

- Node: `sooth:node:v1:<chainId>:<factory>:<fullNodeId>:<releaseId>`
- Market: `sooth:market:v1:<chainId>:<factory>:<fullNodeId>:<market>:<releaseId>:<amm|book>`

Use `formatSoothNodeReference` / `parseSoothNodeReference` and
`formatSoothMarketReference` / `parseSoothMarketReference`. A reference
selects an identity only. It never supplies RPC URLs, contracts, approval
spenders or signing authority.

`format*` returns the canonical form, with all addresses and hashes in
lowercase. The widget sends and checks canonical references with exact string
comparison. Release seeds and explorers show mixed-case addresses, so always
canonicalize a reference before you compare it or put it in a URL or draft:

```ts
const NODE = formatSoothNodeReference(parseSoothNodeReference(RAW_NODE));
```

A plain HTML host without the SDK must write the reference in lowercase.

## Path A: hosted iframe snippet

1. Open `<widget-origin>/v1/generator`. Choose the node, an optional starting
   market, the creation and order-book flags, presentation, title and theme.
2. For host notifications, enter the host page's exact origin. Enable
   transaction notifications only if the host needs them.
3. Select **Generate node embed**, preview it, then **Copy HTML**.
4. Paste the complete HTML into the host page. Do not edit or trim it.

A panel snippet is one iframe:

```html
<iframe
  src="https://WIDGET_ORIGIN/v1/node?node=<encoded node reference>&instance=<id>&theme=auto&venue=amm"
  title="Community prediction markets" width="100%" height="780"
  style="display:block;width:100%;border:0;border-radius:16px"
  sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
  allow="clipboard-write" referrerpolicy="strict-origin-when-cross-origin"></iframe>
```

Drawer and modal snippets add a host button, `<dialog>`, `<style>` and inline
`<script>` around the same iframe. The script removes the original iframe,
adds a fresh copy each time the dialog opens and deletes it on close. The
hosted node always renders as a panel inside the frame. The host dialog
supplies the drawer (max 480px) or modal (max 960px) boundary.

URL parameters for `/v1/node`:

| Parameter | Values | Notes |
| --- | --- | --- |
| `node` | full node reference | Required |
| `instance` | `[a-zA-Z0-9_-]{8,80}` | Generated if missing. Set it explicitly so the host can check messages. Unique per embed on the page |
| `theme` | `auto`, `light`, `dark` | Default `auto` |
| `create`, `clob` | `1` | Opt-in creation and order book. Both default off. AMM is always on |
| `initialMarket` | market address | Must belong to the node |
| `venue` | `amm`, `book` | `book` falls back to AMM unless `clob=1` |
| `parentOrigin` | exact HTTPS origin (HTTP only on localhost) | Enables outbound messages. An invalid value makes the frame show an error |
| `events` | `transactions` | Adds transaction events. Requires `parentOrigin` |

`/v1/market?market=<market reference>&instance=<id>` is the direct single-market
route. In code,
`await generateSoothEmbed({ runtime, origin, market, instance, parentOrigin?, theme?, hostEvents?, title? })`
resolves the market against the trusted runtime and resolves to its iframe
HTML. That iframe differs slightly from the node snippet: `max-width:560px`,
`loading="lazy"` and no `referrerpolicy`.

### Hosting requirements

- Widget server, frame policy:
  - `/v1/node` and `/v1/market`: `Content-Security-Policy: frame-ancestors 'self' <each host origin>`.
    `'self'` keeps the generator's live preview working.
  - `/v1/node/wallet`, `/v1/wallet` and `/v1/generator`: `frame-ancestors 'none'`.
    The wallet routes are top-level signing windows.
  - Do not send `X-Frame-Options: DENY` or `SAMEORIGIN` on embeddable routes.
  - Serve SPA fallback for all five routes.
- Widget RPCs: the widget calls its configured RPCs from its own origin. Each
  RPC must accept browser CORS requests from that origin. `rpc.sooth.market`
  uses an origin allowlist; add the widget origin to it, or configure other RPCs.
- Never serve the widget from the host's own origin. `allow-scripts` with
  `allow-same-origin` is safe only when the frame is cross-origin; a
  same-origin frame with both tokens can remove its own sandbox.
- Do not remove or change the generated `sandbox` and `allow` tokens, and do
  not put the frame inside a more restrictive sandboxed frame.
- On a user click, the frame can navigate the host tab to the wallet route
  ("Continue in this tab").
- A `Cross-Origin-Opener-Policy` can cut the wallet window's opener link. The
  flow still works, but live completion notices do not arrive; reload the frame.

### Host CSP (iframe)

- `frame-src <widget origin>`.
- Allow the drawer/modal `<script>` by its SHA-256 hash
  (`script-src 'sha256-…'`), computed from the exact pasted script. The script
  contains the snippet's instance, so compute the hash again for each snippet.
  Never add `'unsafe-inline'` to `script-src`.
- The snippets use a `<style>` element and `style` attributes (the panel
  iframe too). Allow them with `style-src` hashes plus `'unsafe-hashes'` for
  the attributes, or with `style-src 'unsafe-inline'`, which has lower risk
  than inline scripts.

### Styling limits

The iframe accepts only `theme` (`auto`, `light`, `dark`). Its fonts, colors,
accent and radius are the widget's own; host CSS cannot reach inside the frame.
Set `theme` to the host's actual scheme: a light-only host must use `light`,
or the frame turns dark on visitors whose system uses dark mode. Native React
adds `appearance={{ accent, radius }}` only; fonts and background stay fixed.
Compare screenshots of the host page and the frame before you ship.

### Host messages

The frame accepts no messages from the host. It sends notifications only when
the URL has `parentOrigin`. Node messages have this shape:

```ts
type NodeMessage = {
  protocol: 'sooth.node.embed.v1';
  instance: string;
  node: string;
  market: string | null; // canonical market reference
  event: SoothHostEvent; // from 'sooth/react'
};
```

`event` is `ready`, `market-opened`, `resize` (`height` 240–2400), or, with
`events=transactions`, `transaction-submitted | -confirmed | -failed` with
`hash` and `chainId`. Validate every boundary, not the origin alone. Read
`NODE` and `INSTANCE` from the frame's own `src` so they are canonical.

For a panel, the frame element stays the same:

```js
const frame = [...document.querySelectorAll('iframe')].find((f) => f.src.includes('/v1/node?'));
if (!frame) throw new Error('Sooth node iframe not found');
const params = new URL(frame.src).searchParams;
const NODE = params.get('node'), INSTANCE = params.get('instance');
const record = (v, keys) => v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k));

window.addEventListener('message', (e) => {
  if (e.origin !== WIDGET_ORIGIN || e.source !== frame.contentWindow) return;
  const m = e.data;
  if (!record(m, ['protocol', 'instance', 'node', 'market', 'event'])
    || m.protocol !== 'sooth.node.embed.v1' || m.instance !== INSTANCE || m.node !== NODE) return;
  // Also check that m.market is null or a market reference with this node's
  // chain, factory, node and release, and that 'book' appears only with clob=1.
  const ev = m.event;
  if (record(ev, ['type', 'height']) && ev.type === 'resize'
    && Number.isSafeInteger(ev.height) && ev.height >= 240 && ev.height <= 2400) {
    frame.height = String(ev.height);
  }
});
```

For a drawer or modal, the snippet replaces the iframe each time the dialog
opens. Find the current frame when each message arrives, and do not apply
`resize`; the dialog sets the frame's height:

```js
const frame = dialog.querySelector('iframe');
if (!frame || e.origin !== WIDGET_ORIGIN || e.source !== frame.contentWindow) return;
```

Direct-market frames use `{ protocol: 'sooth.embed.v1', instance, market, event }`.
Validate them with `acceptsSoothEmbedMessage(event, { origin, source: iframe.contentWindow, instance, market })`,
where `market` is the canonical reference. Messages are notifications only.
They never authorize a transaction.

## Path B: native React

`sooth/react` needs React and React DOM 18+; viem installs with the package.
It needs no router and no React Query provider. The optional hooks in
`sooth/react/factoryHooks` are the exception: they need `@tanstack/react-query`
v5 and a `QueryClientProvider`.

Create one runtime from application-owned configuration:

```ts
import { createSoothRuntime } from 'sooth/react';
import { SUPPORTED_FACTORY_RELEASES } from 'sooth/factory/releases';
import { parseFactoryRelease } from 'sooth/factory/schema';

export const runtime = createSoothRuntime({
  releases: SUPPORTED_FACTORY_RELEASES.map(parseFactoryRelease),
  chains: [{
    id: 46630,
    name: 'Robinhood Chain Testnet',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    // Two independent RPCs that accept CORS from this app's origin.
    // rpc.sooth.market rejects origins outside its allowlist.
    rpcUrls: [RPC_A, RPC_B],
  }],
  catalogUrl: 'https://registry.sooth.market',
  canonicalOrigin: WIDGET_ORIGIN,
});
```

The runtime refuses a node whose release is not in `releases`, a chain with
fewer than two RPC URLs, a node not in the catalog, and a market whose catalog
question does not match its on-chain hash. Never take these values from page
URLs, catalog data or messages.

### Host CSP and CORS (native)

In native mode the host page calls the catalog and RPCs itself.

- Allow `connect-src` for `catalogUrl` and every entry in `rpcUrls`. Each of
  those services must send CORS headers for the host's origin.
- The components add a `<style>` element to their shadow root. Allow it with a
  `style-src` hash or `'unsafe-inline'`; otherwise they render unstyled.

### Mount the node

Set the node reference at build time, not from visitor input:

```tsx
import { SoothNode } from 'sooth/react';

<SoothNode
  node={NODE_REFERENCE}
  runtime={runtime}
  features={{ create: false, clob: false }}
  presentation="panel"
  theme="auto"
  appearance={{ accent: '#225c46', radius: 12 }}
  onEvent={(event) => { /* ready, market-opened, transaction-* */ }}
/>
```

`presentation` is `'panel'`, `'drawer'` or `'modal'`. A drawer or modal opens
on mount when `open` is omitted. Pass a controlled `open` and `onClose` for
those presentations (native dialogs, Escape closes, focus returns).
`initialMarket`, `initialVenue`, `initialIntent` and `initialView`
(`'markets' | 'create'`) set the start state. `onMarketChange` reports the
selected market. `SoothProvider` can supply a shared `runtime` and `wallet`
instead of props. Imports are safe on the server; mount the interactive UI on
the client only.

For one market without the browsing shell:

```tsx
<SoothMarket market={MARKET_REFERENCE} runtime={runtime} />
```

### Wallets

- Component-managed: omit `wallet`. The component uses the wallet injected into
  its own browsing context.
- Host-supplied: pass the host's existing connection. Do not nest a second
  wallet provider.

```ts
import { createEip1193WalletAdapter, createViemWalletAdapter } from 'sooth/react';
const wallet = createEip1193WalletAdapter(hostProvider); // or createViemWalletAdapter(walletClient)
```

A custom adapter implements `SoothWalletAdapter`: `connect`, `getSession`,
`switchChain`, `sendTransaction` and optional `subscribe`. Call `connect` and
`switchChain` only from user actions. The SDK rechecks account, chain and
transaction identity before each signature.

When no wallet exists, a callback fires from the user's connect button:

- `SoothNode`: `onWalletUnavailable(intent, market)` for a trade, and
  `onCreationWalletUnavailable()` for creation.
- `SoothMarket`: `onWalletUnavailable(intent)`. It has no creation callback.

Show the user a link to the hosted wallet window. Build it from the same
canonical node, instance and flags, and put the draft in the fragment.
For a trade:

```ts
const url = new URL('/v1/node/wallet', WIDGET_ORIGIN);
url.searchParams.set('node', NODE_REFERENCE);
url.searchParams.set('instance', INSTANCE);
url.searchParams.set('theme', 'auto');
if (create) url.searchParams.set('create', '1');
if (clob) url.searchParams.set('clob', '1');
url.searchParams.set('initialMarket', market.market);
url.searchParams.set('venue', market.venue);
url.hash = new URLSearchParams({ draft: JSON.stringify({
  node: NODE_REFERENCE, instance: INSTANCE,
  market: formatSoothMarketReference(market),
  intent, view: 'markets', createdAt: Date.now(),
}) }).toString();
```

For creation, `create=1` is required. Do not set `initialMarket`, and omit
`market` and `intent` from the draft:

```ts
const url = new URL('/v1/node/wallet', WIDGET_ORIGIN);
url.searchParams.set('node', NODE_REFERENCE);
url.searchParams.set('instance', INSTANCE);
url.searchParams.set('theme', 'auto');
url.searchParams.set('create', '1');
if (clob) url.searchParams.set('clob', '1');
url.searchParams.set('venue', 'amm');
url.hash = new URLSearchParams({ draft: JSON.stringify({
  node: NODE_REFERENCE, instance: INSTANCE, view: 'create', createdAt: Date.now(),
}) }).toString();
```

Check that `market` belongs to the configured node before you build the link.
Drafts expire after 30 minutes. Opening a draft never connects, approves or
signs automatically. Offer both a new-window link and a same-tab link.

## Rules

- Trusted configuration (releases, chains, RPCs, catalog, widget origin) comes
  from the application build only.
- Use a unique `instance` for each embed on a page.
- The host never requests signatures. Users approve every approval and
  transaction in their wallet.
- After an interruption, reconcile pending transactions; never resubmit them.
  Pending records belong to the browsing context that submitted them: the
  origin and, in browsers that partition storage, also the top-level site.
  Reconcile from that same context: the same host page for signing inside the
  frame, or the wallet window for signing after handoff.
- New signatures need the Web Locks API and writable local storage. Without
  them, the UI allows reads and recovery only.
- Do not claim that a wallet, browser or signed lifecycle is supported without
  real signed-transaction evidence.

## Verify

1. `node --input-type=module -e "await import('sooth/react')"` in the installed
   host project (import check only).
2. Build the host with the installed tarball, not copied SDK source.
3. In a browser on a different origin from the widget: the node loads, search
   and the Open/Resolved/All filters work, a market opens, and back returns.
4. Drawer and modal open and close, Escape works, focus returns, and narrow
   screens fill the viewport.
5. With `parentOrigin`, the host receives `ready` (and `resize` for a panel).
   Messages from a wrong origin, wrong frame or wrong instance are ignored.
   For drawer and modal, check messages after closing and reopening.
6. Wallet path: connect, use the correct network, review the quote, approve
   with a bounded amount, sign, and get a confirmed receipt. Check balances
   independently. Test trade and creation handoff, popup blocking and reload
   after broadcast.
