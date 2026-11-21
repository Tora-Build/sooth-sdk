/**
 * Calls `load` every `interval` ms while the page is visible. A tick that falls while the page
 * is hidden is skipped, and one load runs when the page is shown again, so data is never older
 * on screen than before. Without a document (server rendering, Node), it polls as before.
 * Returns the function that stops it.
 */
export function pollWhileVisible(load: () => void, interval: number): () => void {
  const doc = typeof document === 'undefined' ? null : document;
  let missed = false;
  const timer = setInterval(() => {
    if (doc?.hidden) missed = true;
    else load();
  }, interval);
  const onShow = () => {
    if (doc?.hidden || !missed) return;
    missed = false;
    load();
  };
  doc?.addEventListener('visibilitychange', onShow);
  return () => {
    clearInterval(timer);
    doc?.removeEventListener('visibilitychange', onShow);
  };
}
