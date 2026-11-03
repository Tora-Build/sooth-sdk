import type { CSSProperties } from 'react';

/** Appearance overrides accepted by the widgets; everything else is fixed grayscale. */
export interface SoothAppearanceInput {
  accent?: string;
  radius?: number;
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const DEFAULT_RADIUS = 12;

function relativeLuminance(hex: string): number {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/**
 * Inline custom properties for `.sooth-root`. Invalid accents are ignored so the neutral
 * theme accent stays in effect; the radius is clamped to 0..24px.
 */
export function soothRootStyle(appearance?: SoothAppearanceInput): CSSProperties {
  const style: Record<string, string> = {};
  const accent = appearance?.accent;
  if (typeof accent === 'string' && HEX_COLOR.test(accent)) {
    style['--s-accent'] = accent.toLowerCase();
    // Pick the readable label color for the tinted primary action.
    style['--s-on-accent'] = relativeLuminance(accent) > 0.18 ? '#161616' : '#f4f4f2';
  }
  const radius = appearance?.radius;
  const safeRadius =
    typeof radius === 'number' && Number.isFinite(radius)
      ? Math.min(24, Math.max(0, radius))
      : DEFAULT_RADIUS;
  style['--s-radius'] = `${safeRadius}px`;
  return style as CSSProperties;
}

const lightTokens = `
  --s-bg: #f4f4f2;
  --s-surface: #fbfbfa;
  --s-surface-2: #ebebe8;
  --s-line: #dadad6;
  --s-text: #1e1e1d;
  --s-muted: #5a5a57;
  --s-faint: #8c8c88;
  --s-yes: #2a2a29;
  --s-on-yes: #f4f4f2;
  --s-no: #6b6b68;
  --s-no-fill: #e2e2df;
  --s-focus: #3d3d3b;
  --s-accent: #262625;
  --s-on-accent: #f4f4f2;
  --s-shimmer: rgba(255, 255, 255, 0.6);
  --s-shadow: 0 1px 2px rgba(20, 20, 18, 0.06), 0 8px 24px rgba(20, 20, 18, 0.08);
  --s-scrim: rgba(30, 30, 29, 0.28);
  color-scheme: light;
`;

const darkTokens = `
  --s-bg: #141414;
  --s-surface: #1b1b1b;
  --s-surface-2: #252525;
  --s-line: #323232;
  --s-text: #e2e2df;
  --s-muted: #a2a29e;
  --s-faint: #6f6f6c;
  --s-yes: #dcdcd8;
  --s-on-yes: #161616;
  --s-no: #9a9a96;
  --s-no-fill: #2c2c2c;
  --s-focus: #c4c4c0;
  --s-accent: #d6d6d2;
  --s-on-accent: #161616;
  --s-shimmer: rgba(255, 255, 255, 0.05);
  --s-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 12px 32px rgba(0, 0, 0, 0.35);
  --s-scrim: rgba(0, 0, 0, 0.45);
  color-scheme: dark;
`;

/** Base stylesheet rendered into each widget's shadow root. */
export const soothBaseCss = `
.sooth-root, .sooth-root[data-theme=light] {${lightTokens}}
.sooth-root[data-theme=dark] {${darkTokens}}
@media (prefers-color-scheme: dark) {
  .sooth-root[data-theme=auto] {${darkTokens}}
}
.sooth-root {
  --s-radius: 12px;
  --s-radius-sm: calc(var(--s-radius) * 0.66);
  --s-font: system-ui, -apple-system, "Segoe UI", sans-serif;
  --s-mono: ui-monospace, "SF Mono", Menlo, monospace;
  --s-ease: cubic-bezier(0.2, 0.8, 0.2, 1);
  position: relative;
  container-type: inline-size;
  container-name: sooth;
  box-sizing: border-box;
  min-height: 100%;
  overflow: hidden;
  background: var(--sooth-canvas-background, var(--s-bg));
  color: var(--s-text);
  font: 400 14px/1.45 var(--s-font);
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
  text-rendering: optimizeLegibility;
}
.sooth-root *, .sooth-root *::before, .sooth-root *::after { box-sizing: inherit; }
.sooth-root h1, .sooth-root h2, .sooth-root h3, .sooth-root h4, .sooth-root p { margin: 0; }
.sooth-root h1 { font-size: 20px; line-height: 1.25; font-weight: 650; letter-spacing: -0.01em; }
.sooth-root h2 { font-size: 17px; line-height: 1.3; font-weight: 600; }
.sooth-root h3 { font-size: 15px; line-height: 1.35; font-weight: 600; }
.sooth-root a { color: inherit; text-underline-offset: 2px; }
.s-num { font-family: var(--s-mono); font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
.s-muted { color: var(--s-muted); }
.s-small { font-size: 12px; line-height: 1.4; }
.s-label { font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--s-muted); }
.s-visually-hidden { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

/* Layout: single column (mobile baseline), two columns from 860px container width. */
.s-page { display: flex; flex-direction: column; gap: 12px; padding: var(--sooth-page-padding, 16px); }
.s-layout { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; align-items: start; }
.s-layout-main, .s-layout-side { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.s-row { display: flex; align-items: center; gap: 8px; }
.s-between { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.s-stack { display: flex; flex-direction: column; gap: 8px; }
.s-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.s-grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
@container sooth (min-width: 860px) {
  .s-page { padding: var(--sooth-page-padding, 24px); gap: 16px; }
  .s-layout { grid-template-columns: minmax(0, 1fr) minmax(320px, 380px); gap: 16px; }
  .s-layout-side { position: sticky; top: 16px; }
  .s-wide-only { display: revert; }
  .s-narrow-only { display: none !important; }
}
@container sooth (max-width: 859.98px) {
  .s-wide-only { display: none !important; }
}

/* Cards */
.s-card { background: var(--sooth-card-background, var(--s-surface)); border: var(--sooth-card-border, 1px solid var(--s-line)); border-radius: var(--sooth-card-radius, var(--s-radius)); padding: 16px; display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.s-card-flat { background: var(--s-surface-2); border-color: transparent; }
.s-card-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 24px; }
.s-card-title { font-size: 13px; font-weight: 600; color: var(--s-muted); }
.s-card-button { width: 100%; text-align: left; font: inherit; color: inherit; cursor: pointer; transition: border-color 160ms var(--s-ease), background-color 160ms var(--s-ease); }
.s-card-button:hover { border-color: var(--s-faint); }
.s-divider { height: 1px; background: var(--s-line); border: 0; margin: 0; }

/* Outcome price cards (YES solid, NO outlined). */
.s-price-cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.s-price-card { min-height: 64px; padding: 10px 12px; border-radius: var(--s-radius-sm); border: 1px solid var(--s-line); background: var(--s-surface); color: var(--s-text); display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 2px; font: inherit; cursor: pointer; text-align: left; }
.s-price-card[data-outcome=yes] { background: var(--s-yes); border-color: var(--s-yes); color: var(--s-on-yes); }
.s-price-card[data-outcome=no] { background: var(--s-no-fill); border-color: var(--s-no); color: var(--s-text); }
.s-seg-price { margin-left: 8px; font-family: var(--s-mono); font-variant-numeric: tabular-nums; font-weight: 500; opacity: 0.75; }
.s-price-card-label { font-size: 12px; font-weight: 700; letter-spacing: 0.06em; }
.s-price-card-value { font-family: var(--s-mono); font-variant-numeric: tabular-nums; font-size: 22px; font-weight: 600; line-height: 1.15; }
.s-prob { font-family: var(--s-mono); font-variant-numeric: tabular-nums; font-size: 34px; font-weight: 600; line-height: 1.05; letter-spacing: -0.02em; }
.s-meter { height: 6px; border-radius: 999px; background: var(--s-no-fill); overflow: hidden; }
.s-meter > span { display: block; height: 100%; background: var(--s-yes); border-radius: inherit; }

/* Stat cells */
.s-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; background: var(--s-line); border: 1px solid var(--s-line); border-radius: var(--s-radius-sm); overflow: hidden; }
@container sooth (min-width: 520px) { .s-stats { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
.s-stat { background: var(--s-surface); padding: 10px 12px; display: flex; flex-direction: column; gap: 2px; min-width: 0; margin: 0; }
.s-stat dt, .s-stat-label { font-size: 11px; color: var(--s-muted); letter-spacing: 0.02em; margin: 0; }
.s-stat dd, .s-stat-value { margin: 0; font-family: var(--s-mono); font-variant-numeric: tabular-nums; font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.s-stat-hint { font-size: 11px; color: var(--s-faint); }
.s-market-stats .s-stat dd { white-space: normal; overflow-wrap: anywhere; }
.s-rule-field { display: flex; flex-direction: column; gap: 4px; font-size: 13px; padding: 4px 0; }
.s-rule-field > :first-child { color: var(--s-muted); overflow-wrap: anywhere; }
.s-rule-field > :last-child { overflow-wrap: anywhere; }
.s-kv { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; padding: 4px 0; }
.s-kv > :first-child { color: var(--s-muted); }
.s-kv > :last-child { font-family: var(--s-mono); font-variant-numeric: tabular-nums; text-align: right; overflow-wrap: anywhere; }

/* Buttons */
.s-btn { appearance: none; display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; min-width: 44px; padding: 0 16px; border-radius: var(--s-radius-sm); border: 1px solid transparent; font: 600 14px/1 var(--s-font); cursor: pointer; text-decoration: none; transition: background-color 160ms var(--s-ease), border-color 160ms var(--s-ease), opacity 160ms var(--s-ease); user-select: none; }
.s-btn-block { width: 100%; }
.s-btn-sm { min-height: 36px; padding: 0 12px; font-size: 13px; }
.s-btn-primary { background: var(--s-accent); color: var(--s-on-accent); }
.s-btn-primary:hover:not(:disabled) { opacity: 0.9; }
.s-btn-secondary { background: var(--s-surface-2); color: var(--s-text); border-color: var(--s-line); }
.s-btn-secondary:hover:not(:disabled) { border-color: var(--s-faint); }
.s-btn-ghost { background: transparent; color: var(--s-text); }
.s-btn-ghost:hover:not(:disabled) { background: var(--s-surface-2); }
.s-btn-danger { background: transparent; color: var(--s-text); border-color: var(--s-muted); border-style: dashed; }
.s-btn-danger:hover:not(:disabled) { background: var(--s-surface-2); }
.s-btn-yes { background: var(--s-yes); color: var(--s-on-yes); }
.s-btn-no { background: var(--s-no-fill); color: var(--s-text); border-color: var(--s-no); }
.s-btn:disabled, .s-btn[aria-disabled=true] { opacity: 0.45; cursor: not-allowed; }
.s-icon-btn { appearance: none; display: inline-grid; place-items: center; width: 44px; height: 44px; border-radius: 999px; border: 0; background: transparent; color: var(--s-muted); cursor: pointer; font: inherit; }
.s-icon-btn:hover { background: var(--s-surface-2); color: var(--s-text); }

/* Focus */
.sooth-root :focus { outline: none; }
.sooth-root :focus-visible { outline: 2px solid var(--s-focus); outline-offset: 2px; border-radius: var(--s-radius-sm); }

/* Inputs */
.s-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.s-field-label { font-size: 12px; font-weight: 600; color: var(--s-muted); }
.s-field-hint { font-size: 12px; color: var(--s-muted); }
.s-input, .s-select, .s-textarea { width: 100%; min-height: 44px; padding: 10px 12px; border-radius: var(--s-radius-sm); border: 1px solid var(--s-line); background: var(--s-surface); color: var(--s-text); font: 400 15px/1.3 var(--s-font); transition: border-color 160ms var(--s-ease); }
.s-textarea { min-height: 88px; resize: vertical; }
.s-input::placeholder, .s-textarea::placeholder { color: var(--s-faint); }
.s-input:hover, .s-select:hover, .s-textarea:hover { border-color: var(--s-faint); }
.s-input:focus-visible, .s-select:focus-visible, .s-textarea:focus-visible { outline: 2px solid var(--s-focus); outline-offset: 0; border-color: var(--s-focus); }
.s-input[aria-invalid=true] { border-color: var(--s-text); border-style: dashed; }
.s-input-num { font-family: var(--s-mono); font-variant-numeric: tabular-nums; }
.s-input-wrap { position: relative; display: flex; align-items: center; }
.s-input-wrap .s-input { padding-right: 64px; }
.s-input-suffix { position: absolute; right: 12px; font-size: 13px; color: var(--s-muted); pointer-events: none; }
.s-amount { font-family: var(--s-mono); font-variant-numeric: tabular-nums; font-size: 28px; font-weight: 600; min-height: 56px; }
.s-slider { width: 100%; height: 44px; accent-color: var(--s-text); background: transparent; }

/* Segmented control */
.s-seg { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 2px; padding: 3px; border-radius: calc(var(--s-radius-sm) + 3px); background: var(--s-surface-2); border: 1px solid var(--s-line); }
.s-seg-sm { display: inline-grid; grid-auto-columns: auto; }
.s-seg-btn { appearance: none; min-height: 38px; min-width: 44px; padding: 0 12px; border: 0; border-radius: var(--s-radius-sm); background: transparent; color: var(--s-muted); font: 600 13px/1 var(--s-font); cursor: pointer; transition: background-color 160ms var(--s-ease), color 160ms var(--s-ease); }
.s-seg-sm .s-seg-btn { min-height: 32px; padding: 0 10px; font-size: 12px; }
.s-seg-btn:hover:not(:disabled) { color: var(--s-text); }
.s-seg-btn[aria-checked=true], .s-seg-btn[aria-selected=true] { background: var(--s-surface); color: var(--s-text); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12); }
.s-seg-btn[data-outcome=yes][aria-checked=true] { background: var(--s-yes); color: var(--s-on-yes); }
.s-seg-btn[data-outcome=no][aria-checked=true] { background: var(--s-surface); color: var(--s-text); box-shadow: inset 0 0 0 1px var(--s-no); }
.s-seg-btn:disabled { opacity: 0.45; cursor: not-allowed; }

/* Chips */
.s-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.s-chip { appearance: none; min-height: 44px; min-width: 44px; padding: 0 14px; border-radius: 999px; border: 1px solid var(--s-line); background: var(--s-surface); color: var(--s-text); font: 600 13px/1 var(--s-mono); font-variant-numeric: tabular-nums; cursor: pointer; }
.s-chip:hover:not(:disabled) { border-color: var(--s-faint); }
.s-chip[aria-pressed=true] { background: var(--s-text); border-color: var(--s-text); color: var(--s-bg); }
.s-chip:disabled { opacity: 0.45; cursor: not-allowed; }

/* Badges */
.s-badge { display: inline-flex; align-items: center; gap: 4px; height: 22px; padding: 0 8px; border-radius: 999px; font-size: 11px; font-weight: 600; letter-spacing: 0.02em; white-space: nowrap; background: var(--s-surface-2); color: var(--s-muted); border: 1px solid var(--s-line); }
.s-badge[data-tone=strong] { background: var(--s-text); color: var(--s-bg); border-color: var(--s-text); }
.s-badge[data-tone=outline] { background: transparent; color: var(--s-text); }
.s-badge[data-tone=live]::before { content: ""; width: 6px; height: 6px; border-radius: 999px; background: currentColor; }

/* Notices */
.s-transaction-status { overflow-wrap: anywhere; }
.s-notice { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border-radius: var(--s-radius-sm); font-size: 13px; line-height: 1.45; background: var(--s-surface-2); color: var(--s-text); border: 1px solid var(--s-line); overflow-wrap: anywhere; }
.s-notice[data-tone=warn] { border-color: var(--s-muted); }
.s-notice[data-tone=error] { border-color: var(--s-text); border-left-width: 3px; }
.s-notice-icon { flex: none; width: 18px; height: 18px; display: inline-grid; place-items: center; border-radius: 999px; font: 700 11px/1 var(--s-font); border: 1.5px solid currentColor; margin-top: 1px; }
.s-notice-body { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.s-notice-title { font-weight: 600; }

/* Skeleton & spinner */
.s-skeleton { display: block; border-radius: var(--s-radius-sm); background: var(--s-surface-2); position: relative; overflow: hidden; }
.s-skeleton::after { content: ""; position: absolute; inset: 0; transform: translateX(-100%); background: linear-gradient(90deg, transparent, var(--s-shimmer), transparent); animation: s-shimmer 1.4s infinite; }
.s-spinner { display: inline-block; width: 16px; height: 16px; border-radius: 999px; border: 2px solid currentColor; border-right-color: transparent; animation: s-spin 0.8s linear infinite; vertical-align: -3px; }
@keyframes s-shimmer { to { transform: translateX(100%); } }
@keyframes s-spin { to { transform: rotate(360deg); } }

/* Disclosure */
.s-disclosure { border-top: 1px solid var(--s-line); }
.s-disclosure-btn { appearance: none; width: 100%; min-height: 44px; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 0; border: 0; background: transparent; color: var(--s-text); font: 600 13px/1.3 var(--s-font); cursor: pointer; text-align: left; }
.s-disclosure-btn::after { content: ""; width: 7px; height: 7px; border-right: 1.5px solid var(--s-muted); border-bottom: 1.5px solid var(--s-muted); transform: rotate(45deg); transition: transform 160ms var(--s-ease); margin-right: 4px; }
.s-disclosure-btn[aria-expanded=true]::after { transform: rotate(-135deg); }
.s-disclosure-panel { padding-bottom: 12px; display: flex; flex-direction: column; gap: 4px; }
.s-disclosure-panel[hidden] { display: none; }

/* Bottom sheet (contained in the widget root, never viewport-fixed). */
.s-sheet-layer { position: absolute; inset: 0; z-index: 20; display: flex; flex-direction: column; justify-content: flex-end; }
.s-sheet-scrim { position: absolute; inset: 0; background: var(--s-scrim); border: 0; padding: 0; animation: s-fade 180ms var(--s-ease); }
.s-sheet { position: relative; max-height: calc(100% - 24px); overflow-y: auto; overscroll-behavior: contain; background: var(--s-surface); border: 1px solid var(--s-line); border-bottom: 0; border-radius: calc(var(--s-radius) + 6px) calc(var(--s-radius) + 6px) 0 0; box-shadow: var(--s-shadow); padding: 8px 16px 20px; display: flex; flex-direction: column; gap: 12px; animation: s-rise 220ms var(--s-ease); }
.s-sheet-grip { align-self: center; width: 36px; height: 4px; border-radius: 999px; background: var(--s-line); margin: 2px 0 4px; }
.s-sheet-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
@container sooth (min-width: 860px) {
  .s-sheet-layer { justify-content: center; align-items: center; padding: 24px; }
  .s-sheet { width: min(480px, 100%); border-bottom: 1px solid var(--s-line); border-radius: calc(var(--s-radius) + 4px); max-height: calc(100% - 48px); }
  .s-sheet-grip { display: none; }
}
@keyframes s-rise { from { transform: translateY(24px); opacity: 0; } }
@keyframes s-fade { from { opacity: 0; } }

/* Charts */
.s-chart { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.s-chart-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 32px; }
.s-chart-title { font-size: 13px; font-weight: 600; color: var(--s-muted); }
.s-chart-value { font-family: var(--s-mono); font-variant-numeric: tabular-nums; font-size: 13px; font-weight: 600; }
.s-chart-plot { position: relative; height: 160px; touch-action: pan-y; }
.s-chart-plot svg { display: block; width: 100%; height: 100%; overflow: visible; }
.s-chart-line { fill: none; stroke: var(--s-text); stroke-width: 1.5; vector-effect: non-scaling-stroke; stroke-linejoin: round; }
.s-chart-area { fill: var(--s-text); opacity: 0.07; }
.s-chart-grid { stroke: var(--s-line); stroke-width: 1; vector-effect: non-scaling-stroke; stroke-dasharray: 2 3; }
.s-chart-cross { stroke: var(--s-muted); stroke-width: 1; vector-effect: non-scaling-stroke; }
.s-chart-dot { position: absolute; width: 9px; height: 9px; margin: -4.5px 0 0 -4.5px; border-radius: 999px; background: var(--s-text); border: 2px solid var(--s-surface); pointer-events: none; }
.s-chart-tip { position: absolute; top: 4px; transform: translateX(-50%); padding: 3px 8px; border-radius: 6px; background: var(--s-text); color: var(--s-bg); font: 600 11px/1.4 var(--s-mono); font-variant-numeric: tabular-nums; white-space: nowrap; pointer-events: none; }
.s-chart-axis { display: flex; justify-content: space-between; font-size: 11px; color: var(--s-faint); font-family: var(--s-mono); font-variant-numeric: tabular-nums; }
.s-chart-empty { display: grid; place-items: center; height: 160px; padding: 16px; text-align: center; border: 1px dashed var(--s-line); border-radius: var(--s-radius-sm); font-size: 13px; color: var(--s-muted); }
.s-carousel-panel { min-width: 0; }

/* Depth ladder */
.s-ladder { display: flex; flex-direction: column; font-family: var(--s-mono); font-variant-numeric: tabular-nums; font-size: 12px; }
.s-ladder-head, .s-ladder-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 2px; }
.s-ladder-head { font-family: var(--s-font); font-size: 11px; color: var(--s-muted); padding: 0 0 4px; }
.s-ladder-head > :first-child { text-align: right; padding-right: 8px; }
.s-ladder-head > :last-child { padding-left: 8px; }
.s-ladder-row { min-height: 22px; }
.s-ladder-cell { position: relative; display: flex; align-items: center; gap: 8px; padding: 0 8px; overflow: hidden; }
.s-ladder-cell[data-side=bid] { justify-content: flex-end; }
.s-ladder-cell[data-side=ask] { justify-content: flex-start; }
.s-ladder-bar { position: absolute; top: 2px; bottom: 2px; border-radius: 3px; z-index: 0; }
.s-ladder-cell[data-side=bid] .s-ladder-bar { right: 0; background: var(--s-yes); opacity: 0.16; }
.s-ladder-cell[data-side=ask] .s-ladder-bar { left: 0; background: transparent; border: 1px solid var(--s-no); opacity: 0.55; }
.s-ladder-cell > span { position: relative; z-index: 1; }
.s-ladder-price { font-weight: 600; }
.s-ladder-size { color: var(--s-muted); }
.s-ladder-mid { display: flex; justify-content: center; gap: 12px; padding: 6px 0; margin-top: 4px; border-top: 1px solid var(--s-line); font-size: 12px; color: var(--s-muted); }
.s-ladder-mid strong { color: var(--s-text); font-weight: 600; }

/* Liquidity map */
.s-liq { display: flex; align-items: flex-end; gap: 2px; height: 120px; }
.s-liq-bar { flex: 1 1 0; min-width: 2px; border-radius: 2px 2px 0 0; }
.s-liq-bar[data-side=bid] { background: var(--s-yes); opacity: 0.55; }
.s-liq-bar[data-side=ask] { background: var(--s-no-fill); box-shadow: inset 0 0 0 1px var(--s-no); }
.s-liq-bar[data-side=empty] { background: var(--s-line); opacity: 0.5; }
.s-legend { display: flex; gap: 12px; font-size: 11px; color: var(--s-muted); }
.s-legend > span { display: inline-flex; align-items: center; gap: 4px; }
.s-legend > span::before { content: ""; width: 8px; height: 8px; border-radius: 2px; }
.s-legend [data-side=bid]::before { background: var(--s-yes); opacity: 0.55; }
.s-legend [data-side=ask]::before { background: var(--s-no-fill); box-shadow: inset 0 0 0 1px var(--s-no); }

/* Lists and tables */
.s-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.s-list > li { padding: 10px 0; border-top: 1px solid var(--s-line); }
.s-list > li:first-child { border-top: 0; }
.s-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.s-table th { text-align: left; font-size: 11px; font-weight: 600; color: var(--s-muted); padding: 6px 8px; border-bottom: 1px solid var(--s-line); }
.s-table td { padding: 8px; border-bottom: 1px solid var(--s-line); font-family: var(--s-mono); font-variant-numeric: tabular-nums; }

/* Scrollbars */
.sooth-root { scrollbar-width: thin; scrollbar-color: var(--s-line) transparent; }
.sooth-root ::-webkit-scrollbar { width: 8px; height: 8px; }
.sooth-root ::-webkit-scrollbar-thumb { background: var(--s-line); border-radius: 999px; }
.sooth-root ::-webkit-scrollbar-track { background: transparent; }

@media (prefers-reduced-motion: reduce) {
  .sooth-root *, .sooth-root *::before, .sooth-root *::after { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; scroll-behavior: auto !important; }
  .s-skeleton::after { display: none; }
}
`;
