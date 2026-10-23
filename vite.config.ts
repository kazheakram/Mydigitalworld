import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// On Cloudflare Pages (CF_PAGES is set during its builds) the site uses the Firebase backend.
// Locally, `npm run dev` keeps using the original Node server unless VITE_BACKEND=firebase.
const backend = process.env.VITE_BACKEND ?? (process.env.CF_PAGES ? 'firebase' : 'server');

export default defineConfig({
  plugins: [react()],
  define: { 'import.meta.env.VITE_BACKEND': JSON.stringify(backend) },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:8787', '/uploads': 'http://localhost:8787' },
  },
  build: { outDir: 'dist', chunkSizeWarningLimit: 900 },
});
