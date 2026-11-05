import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Document navigations (Accept: text/html) must hit the SPA, not the API.
// XHR/fetch (Accept: */* or application/json) keep proxying to the services.
const spaBypass = (req) => (req.headers.accept && req.headers.accept.includes('text/html') ? req.url : undefined);

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
      '/employees': { target: 'http://localhost:8082', changeOrigin: true, bypass: spaBypass },
      '/audit': { target: 'http://localhost:8082', changeOrigin: true, bypass: spaBypass },
    },
  },
});
