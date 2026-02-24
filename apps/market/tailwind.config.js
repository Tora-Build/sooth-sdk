/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      zIndex: {
        "dropdown": "50",
        "sticky": "60",
        "overlay": "70",
        "modal": "80",
        "popover": "90",
        "toast": "100",
        "tour": "110",
      },
      fontFamily: {
        sans: ['Satoshi', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas'],
        heading: ['Satoshi', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        background: '#020617',
        surface: 'rgba(15, 23, 42, 0.8)',
        primary: {
          DEFAULT: '#f59e0b',
          foreground: '#000',
        },
        secondary: {
          DEFAULT: '#1e293b',
          foreground: '#f8fafc',
        },
        accent: {
          DEFAULT: '#d946ef',
          foreground: '#fdf4ff',
        },
        destructive: {
          DEFAULT: '#f43f5e',
          foreground: '#ffe4e6',
        },
        success: {
          DEFAULT: '#10b981',
          foreground: '#d1fae5',
        },
        amber: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
        cyan: {
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63',
          950: '#083344',
        },
        magenta: {
          50: '#fdf4ff',
          100: '#fae8ff',
          200: '#f5d0fe',
          300: '#f0abfc',
          400: '#e879f9',
          500: '#d946ef',
          600: '#c026d3',
          700: '#a21caf',
          800: '#86198f',
          900: '#701a75',
          950: '#4a044e',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-glow': 'radial-gradient(circle at top center, rgba(245, 158, 11, 0.15) 0%, rgba(2, 6, 23, 0) 50%)',
        'neon-glow': 'radial-gradient(circle at center, rgba(6, 182, 212, 0.2) 0%, transparent 70%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s infinite',
        'flicker': 'flicker 0.15s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        flicker: {
          '0%, 100%': { opacity: '0.01' },
          '50%': { opacity: '0.02' },
        },
      },
      boxShadow: {
        'glow-cyan': '0 0 20px -5px rgba(6, 182, 212, 0.5)',
        'glow-magenta': '0 0 20px -5px rgba(217, 70, 239, 0.5)',
        'glow-emerald': '0 0 20px -5px rgba(16, 185, 129, 0.5)',
        'glow-rose': '0 0 20px -5px rgba(244, 63, 94, 0.5)',
        'glow-amber': '0 0 20px -5px rgba(245, 158, 11, 0.5)',
        'neon': '0 0 5px currentColor, 0 0 20px currentColor, 0 0 40px currentColor',
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
  ],
}
