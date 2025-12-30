/**
 * Pin `window.ethereum` to a preferred injected provider when multiple wallets are installed.
 *
 * Why:
 * - Some wallets (e.g. Phantom) inject EVM providers that can become the default.
 * - wagmi's injected connector and other libs often read `window.ethereum` directly.
 *
 * Policy (alpha):
 * - Prefer MetaMask, then Coinbase Wallet, then any non-Phantom provider.
 * - Do not select Phantom unless it is the only available provider.
 */
export function preferInjectedProvider() {
  if (typeof window === 'undefined') return;

  const eth = (window as any).ethereum;
  if (!eth) return;

  const providers: any[] = Array.isArray(eth.providers) ? eth.providers : [eth];
  const uniq = Array.from(new Set(providers.filter(Boolean)));
  if (uniq.length <= 1) return;

  const pick = (pred: (p: any) => boolean) => uniq.find(pred);

  const mm = pick((p) => !!p?.isMetaMask);
  const cb = pick((p) => !!p?.isCoinbaseWallet);
  const nonPhantom = pick((p) => !p?.isPhantom);

  const preferred = mm ?? cb ?? nonPhantom ?? null;
  if (!preferred) return;

  // If we're already pinned, do nothing.
  if (eth === preferred) return;

  // Pin.
  (window as any).ethereum = preferred;
}


