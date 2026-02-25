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
      },
      fontFamily: {
        sans: ['Satoshi', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas'],
        heading: ['Satoshi', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        surface: {
          DEFAULT: '#18181b',
          raised: '#27272a',
          overlay: 'rgba(24, 24, 27, 0.95)',
        },
        border: {
          DEFAULT: 'rgba(255, 255, 255, 0.06)',
          hover: 'rgba(255, 255, 255, 0.12)',
          active: 'rgba(255, 255, 255, 0.18)',
        },
        accent: {
          DEFAULT: '#22D3EE', // cyan-400 (was amber)
          muted: 'rgba(34, 211, 238, 0.12)',
          foreground: '#000',
        },
        positive: {
          DEFAULT: '#10b981',
          muted: 'rgba(16, 185, 129, 0.12)',
          foreground: '#d1fae5',
        },
        negative: {
          DEFAULT: '#f43f5e',
          muted: 'rgba(244, 63, 94, 0.12)',
          foreground: '#ffe4e6',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'shimmer': 'shimmer 1.8s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
  ],
}
