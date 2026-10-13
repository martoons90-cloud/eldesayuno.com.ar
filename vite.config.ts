import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    define: {
      'import.meta.env.VITE_CLOUDFLARE_ACCOUNT_ID': JSON.stringify(
        process.env.VITE_CLOUDFLARE_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || 'b36aef318f314d0aaaef32a2155d9841'
      ),
      'import.meta.env.VITE_CLOUDFLARE_DATABASE_ID': JSON.stringify(
        process.env.VITE_CLOUDFLARE_DATABASE_ID || process.env.CLOUDFLARE_DATABASE_ID || 'f0474948-373a-4522-833b-36eb13858100'
      ),
      'import.meta.env.VITE_CLOUDFLARE_API_TOKEN': JSON.stringify(
        process.env.VITE_CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || 'cfat_eAr1X7lzTtl0Mbov4nGM0l1F8BCW61SrNWNQqEVA34a6cee2'
      ),
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
