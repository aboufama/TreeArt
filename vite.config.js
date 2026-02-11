import { defineConfig } from 'vite';
import glsl from 'vite-plugin-glsl';

export default defineConfig({
  plugins: [glsl()],
  base: '/TreeArt/',
  server: {
    open: true
  },
  build: {
    outDir: 'docs',
    sourcemap: true
  }
});
