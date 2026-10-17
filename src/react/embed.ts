import { factoryAddress, factoryChainId, factoryHash } from '../factory/schema.js';
import type { Address, Hash } from 'viem';

export type SoothVenue = 'amm' | 'book';
export type SoothTheme = 'light' | 'dark' | 'auto';
export interface SoothMarketReference {
  chainId: number;
  factory: Address;
  nodeId: Hash;
  market: Address;
  releaseId: Hash;
  venue: SoothVenue;
}
/** A reference selects exactly one release, node, market and venue. It supplies no RPC or spender. */
export function parseSoothMarketReference(
  value: string | SoothMarketReference,
): SoothMarketReference {
  const parts = typeof value === 'string' ? value.split(':') : null;
  if (
    parts &&
    (parts.length !== 9 || parts[0] !== 'sooth' || parts[1] !== 'market' || parts[2] !== 'v1')
  )
    throw new Error('A full Sooth v1 market reference is required');
  const input = parts
    ? {
        chainId: Number(parts[3]),
        factory: parts[4],
        nodeId: parts[5],
        market: parts[6],
        releaseId: parts[7],
        venue: parts[8],
      }
    : (value as SoothMarketReference);
  if (input.venue !== 'amm' && input.venue !== 'book')
    throw new Error('Select the AMM or book venue explicitly');
  return {
    chainId: factoryChainId(input.chainId),
    factory: factoryAddress(input.factory),
    nodeId: factoryHash(input.nodeId),
    market: factoryAddress(input.market),
    releaseId: factoryHash(input.releaseId),
    venue: input.venue,
  };
}
export function formatSoothMarketReference(value: SoothMarketReference): string {
  const r = parseSoothMarketReference(value);
  return `sooth:market:v1:${r.chainId}:${r.factory}:${r.nodeId}:${r.market}:${r.releaseId}:${r.venue}`;
}
export const SOOTH_EMBED_PROTOCOL = 'sooth.embed.v1' as const;
export type SoothHostEvent =
  | { type: 'ready' | 'market-opened' }
  | { type: 'resize'; height: number }
  | {
      type: 'transaction-submitted' | 'transaction-confirmed' | 'transaction-failed';
      hash: Hash;
      chainId: number;
    };
export interface SoothEmbedMessage {
  protocol: typeof SOOTH_EMBED_PROTOCOL;
  instance: string;
  market: string;
  event: SoothHostEvent;
}
export function isSoothEmbedMessage(
  value: unknown,
  instance: string,
  market: string,
): value is SoothEmbedMessage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const m = value as Partial<SoothEmbedMessage>;
  if (Object.keys(m).some((key) => !['protocol', 'instance', 'market', 'event'].includes(key)))
    return false;
  if (
    m.protocol !== SOOTH_EMBED_PROTOCOL ||
    m.instance !== instance ||
    m.market !== market ||
    !m.event ||
    typeof m.event !== 'object' ||
    Array.isArray(m.event)
  )
    return false;
  const e = m.event;
  if (e.type === 'ready' || e.type === 'market-opened') return Object.keys(e).length === 1;
  if (e.type === 'resize')
    return (
      Object.keys(e).length === 2 &&
      Number.isSafeInteger(e.height) &&
      e.height >= 240 &&
      e.height <= 2400
    );
  if (
    !['transaction-submitted', 'transaction-confirmed', 'transaction-failed'].includes(e.type) ||
    Object.keys(e).length !== 3 ||
    !('hash' in e) ||
    typeof e.hash !== 'string' ||
    !/^0x[0-9a-fA-F]{64}$/.test(e.hash) ||
    !('chainId' in e) ||
    !Number.isSafeInteger(e.chainId)
  )
    return false;
  try {
    return e.chainId === parseSoothMarketReference(market).chainId;
  } catch {
    return false;
  }
}
export function acceptsSoothEmbedMessage(
  event: MessageEvent,
  options: { origin: string; source: MessageEventSource | null; instance: string; market: string },
): event is MessageEvent<SoothEmbedMessage> {
  return (
    options.source !== null &&
    event.origin === options.origin &&
    event.source === options.source &&
    isSoothEmbedMessage(event.data, options.instance, options.market)
  );
}
export function soothWidgetUrl(options: {
  origin: string;
  market: string | SoothMarketReference;
  instance: string;
  parentOrigin?: string;
  theme?: SoothTheme;
  hostEvents?: boolean;
}): string {
  const origin = new URL(options.origin);
  if (
    origin.protocol !== 'https:' &&
    !(origin.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname))
  )
    throw new Error('Widget origin must use HTTPS (HTTP is allowed on localhost)');
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(options.instance))
    throw new Error('An 8–80 character widget instance is required');
  const url = new URL('/v1/market', origin.origin);
  url.searchParams.set(
    'market',
    formatSoothMarketReference(parseSoothMarketReference(options.market)),
  );
  url.searchParams.set('instance', options.instance);
  url.searchParams.set('theme', options.theme ?? 'auto');
  if (options.parentOrigin) {
    const parent = new URL(options.parentOrigin);
    if (!['https:', 'http:'].includes(parent.protocol) || parent.origin !== options.parentOrigin)
      throw new Error('Exact parent origin required');
    url.searchParams.set('parentOrigin', parent.origin);
  }
  if (options.hostEvents) url.searchParams.set('events', 'transactions');
  return url.href;
}
const escapeAttribute = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Call only after resolving this reference against the trusted runtime (see generateSoothEmbed). */
export function renderSoothEmbedSnippet(
  options: Parameters<typeof soothWidgetUrl>[0] & { title: string },
): string {
  return `<iframe src="${escapeAttribute(soothWidgetUrl(options))}" title="${escapeAttribute(options.title)}" width="100%" height="780" style="max-width:560px;border:0;border-radius:16px" loading="lazy" allow="clipboard-write" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"></iframe>`;
}
