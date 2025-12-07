/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        heading: ['Outfit', 'sans-serif'],
      },
      colors: {
        background: '#020617', // slate-950
        surface: 'rgba(15, 23, 42, 0.6)', // slate-900/60
        primary: {
          DEFAULT: '#6366f1', // indigo-500
          foreground: '#e0e7ff', // indigo-100
        },
        secondary: {
          DEFAULT: '#1e293b', // slate-800
          foreground: '#f8fafc', // slate-50
        },
        accent: {
          DEFAULT: '#8b5cf6', // violet-500
          foreground: '#f3e8ff', // violet-100
        },
        destructive: {
          DEFAULT: '#f43f5e', // rose-500
          foreground: '#ffe4e6', // rose-100
        },
        success: {
          DEFAULT: '#10b981', // emerald-500
          foreground: '#d1fae5', // emerald-100
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-glow': 'radial-gradient(circle at top center, rgba(99, 102, 241, 0.15) 0%, rgba(2, 6, 23, 0) 70%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
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
      },
      boxShadow: {
        'glow-indigo': '0 0 20px -5px rgba(99, 102, 241, 0.4)',
        'glow-emerald': '0 0 20px -5px rgba(16, 185, 129, 0.4)',
        'glow-rose': '0 0 20px -5px rgba(244, 63, 94, 0.4)',
        'glow-violet': '0 0 20px -5px rgba(139, 92, 246, 0.4)',
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
  ],
}
