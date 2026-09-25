import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './', // enables hosting on GitHub Pages, relative hosting, or any static CDN
  build: {
    outDir: 'dist',
    sourcemap: false,
  }
});
