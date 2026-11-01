import { defineConfig } from 'vitest/config';

const shared = {
  globals: true,
  pool: 'threads' as const,
};

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          ...shared,
          name: 'node',
          environment: 'node',
          include: ['tests/**/*.{test,spec}.{ts,tsx}'],
          exclude: ['tests/react/**'],
        },
      },
      {
        test: {
          ...shared,
          name: 'jsdom',
          environment: 'jsdom',
          include: ['tests/react/**/*.{test,spec}.{ts,tsx}'],
        },
      },
    ],
  },
});
