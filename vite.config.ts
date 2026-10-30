import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath, URL } from 'node:url';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), viteSingleFile({ removeViteModuleLoader: true })],
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    watch: {
      // 忽略工具链临时目录，避免 Windows 上 EBUSY 导致 dev server 崩溃
      ignored: ['**/.*.tmpdir/**', '**/*.tmpdir/**', '**/*.tmp', '**/.edge-profile/**'],
    },
  },
  build: {
    target: 'es2020',
    cssCodeSplit: false,
    assetsInlineLimit: 100 * 1024 * 1024,
    chunkSizeWarningLimit: 8000,
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
