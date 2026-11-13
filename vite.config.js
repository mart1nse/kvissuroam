import { defineConfig } from 'vite';

export default defineConfig({
  build: { target: 'es2020', chunkSizeWarningLimit: 1200 },
  server: { host: true, hmr: process.env.NO_HMR ? false : undefined },
});
