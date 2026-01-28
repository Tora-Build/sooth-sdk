// Sooth Protocol Brand Constants
export const COLORS = {
  background: '#020617',
  surface: 'rgba(15, 23, 42, 0.8)',

  // Primary
  cyan: {
    50: '#ecfeff',
    100: '#cffafe',
    200: '#a5f3fc',
    300: '#67e8f9',
    400: '#22d3ee',
    500: '#06b6d4',
    600: '#0891b2',
  },

  // Accent
  magenta: {
    300: '#f0abfc',
    400: '#e879f9',
    500: '#d946ef',
    600: '#c026d3',
  },

  // Supporting
  purple: '#C084FC',
  indigo: '#818CF8',

  // Semantic
  success: '#10b981',
  destructive: '#f43f5e',

  // Text
  text: {
    primary: '#f8fafc',
    secondary: '#94a3b8',
    muted: '#64748b',
  },
} as const;

export const FONTS = {
  heading: "'Space Grotesk', sans-serif",
  mono: "'JetBrains Mono', monospace",
} as const;

// Video settings
export const VIDEO = {
  fps: 30,
  width: 1920,
  height: 1080,
  durationInSeconds: 60,
} as const;

export const SCENE_TIMING = {
  // All times in seconds
  logoReveal: { start: 0, duration: 8 },
  problem: { start: 8, duration: 10 },
  solution: { start: 18, duration: 10 },
  features: { start: 28, duration: 14 },
  traction: { start: 42, duration: 10 },
  cta: { start: 52, duration: 8 },
} as const;
