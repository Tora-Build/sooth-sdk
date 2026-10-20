import { soothBaseCss } from '../ui/theme.js';

/** Node shell: panel border, modal/drawer dialogs, market list and cards. */
export const soothNodeCss = `${soothBaseCss}
:host { display: block; min-width: 0; }
dialog { padding: 0; border: 0; background: transparent; color: inherit; max-height: 100dvh; max-width: 100vw; overflow: auto; }
dialog::backdrop { background: rgb(20 20 18 / 0.45); backdrop-filter: blur(3px); }
dialog[data-presentation=modal] { width: min(960px, calc(100vw - 48px)); margin: auto; }
dialog[data-presentation=drawer] { width: min(480px, 100vw); height: 100dvh; max-height: 100dvh; margin: 0 0 0 auto; }
dialog[data-presentation=drawer] > .sooth-root { min-height: 100%; border-radius: var(--s-radius) 0 0 var(--s-radius); }
@media (max-width: 520px) {
  dialog[data-presentation=modal], dialog[data-presentation=drawer] { width: 100vw; height: 100dvh; max-height: 100dvh; margin: 0; }
  dialog[data-presentation] > .sooth-root { min-height: 100%; border-radius: 0; }
}
.s-node { border: var(--sooth-card-border, 1px solid var(--s-line)); border-radius: var(--sooth-card-radius, var(--s-radius)); overflow-wrap: anywhere; }
.s-node-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.s-node-title { display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; }
.s-node-title .s-disclosure { border-top: 0; }
.s-node-title .s-disclosure-btn { min-height: 32px; font-weight: 500; color: var(--s-muted); justify-content: flex-start; }
.s-node-actions { display: flex; align-items: center; gap: 4px; flex: none; }
.s-node-tools { display: flex; flex-direction: column; gap: 8px; }
.s-node-search { position: relative; display: flex; align-items: center; }
.s-node-search .s-input { padding-left: 38px; }
.s-node-search svg { position: absolute; left: 13px; color: var(--s-faint); pointer-events: none; }
.s-node-filters { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.s-node-filters .s-seg { flex: 1 1 220px; }
.s-node-sort { flex: 1 1 140px; display: flex; align-items: center; gap: 8px; }
.s-node-sort .s-select { min-height: 44px; }
.s-node-rail { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding: 2px 0; }
.s-node-rail::-webkit-scrollbar { display: none; }
.s-node-cat { flex: none; display: inline-flex; align-items: center; gap: 6px; min-height: 36px; font-family: var(--s-font); }
.s-node-cat-count { font-family: var(--s-mono); font-variant-numeric: tabular-nums; font-size: 12px; opacity: 0.7; }
.s-node-list { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; }
@container sooth (min-width: 620px) { .s-node-list { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@container sooth (min-width: 980px) { .s-node-list { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.s-node-list > li { display: flex; min-width: 0; }
/* List items stay boxed when a host flattens page sections. */
.s-node-card { flex: 1; gap: 10px; background: var(--s-surface); border: 1px solid var(--s-line); border-radius: var(--s-radius); }
.s-node-card-tags { display: flex; align-items: center; justify-content: space-between; gap: 6px; flex-wrap: wrap; }
.s-node-card-open { appearance: none; display: flex; flex-direction: column; align-items: flex-start; gap: 6px; min-height: 44px; margin: 0; padding: 0; border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.s-node-card-open h3 { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.s-node-card-open:hover h3 { text-decoration: underline; text-underline-offset: 3px; text-decoration-color: var(--s-faint); }
.s-node-prob { display: flex; align-items: baseline; gap: 6px; }
.s-node-prob-value { font-size: 20px; font-weight: 600; }
.s-node-prices { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: auto; }
.s-node-price { justify-content: space-between; padding: 0 14px; }
.s-node-result { font-weight: 600; margin-top: auto; }
.s-node-meta { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 12px; color: var(--s-muted); }
.s-node-meta > span { display: inline-flex; align-items: center; gap: 4px; }
.s-node-empty { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 24px 16px; border: 1px dashed var(--s-line); border-radius: var(--s-radius); }
.s-node-more { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.s-node-foot { font-size: 12px; color: var(--s-faint); }
.s-node-skeleton { height: 188px; border-radius: var(--s-radius); }
.s-node-back { align-self: flex-start; }
`;
