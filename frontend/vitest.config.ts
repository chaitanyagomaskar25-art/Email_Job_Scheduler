import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    root: path.resolve(__dirname),
    globals: true,
    environment: 'jsdom',
    setupFiles: [path.resolve(__dirname, 'src/tests/setup.ts')],
    include: ['src/tests/**/*.test.{ts,tsx}'],
  },
});

