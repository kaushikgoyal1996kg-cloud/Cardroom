/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // listen on 0.0.0.0 so phones on the same WiFi can reach it, not just localhost
  },
  test: {
    // Vitest stubs CSS to an empty string by default, which also empties
    // `import styles from './x.css?raw'`. The layout contract tests read the
    // real stylesheet text, so CSS must be processed rather than stubbed.
    css: true,
  },
});
