import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        city: fileURLToPath(new URL('./index.html', import.meta.url)),
        aegean: fileURLToPath(new URL('./experiments/aegean-city/index.html', import.meta.url)),
        shanghai: fileURLToPath(new URL('./experiments/shanghai-city/index.html', import.meta.url)),
      },
    },
    target: 'es2022',
    chunkSizeWarningLimit: 800,
  },
});
