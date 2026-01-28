import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-web3': ['wagmi', 'viem', '@tanstack/react-query'],
          'vendor-state': ['zustand'],
        },
      },
    },
  },
  server: {
    proxy: {
      // Proxy Polymarket Gamma API requests
      '/api/polymarket': {
        target: 'https://gamma-api.polymarket.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/polymarket/, ''),
        secure: true,
      },
      // Proxy Kalshi API requests
      '/api/kalshi': {
        target: 'https://api.elections.kalshi.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/kalshi/, ''),
        secure: true,
      },
    },
  },
});
