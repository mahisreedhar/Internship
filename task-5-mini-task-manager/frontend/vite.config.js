/**
 * ARCHITECTURAL NOTE — Vite Dev Proxy
 * =====================================
 * The proxy rewrites `/api/*` requests to the FastAPI backend running on
 * port 8000. This solves two problems at once:
 *
 * 1. CORS: From the browser's perspective all requests go to the same
 *    origin (localhost:5173), so no cross-origin preflight is needed.
 *
 * 2. COOKIES: HttpOnly cookies set by the backend are scoped to
 *    localhost:5173 (the proxy domain), not localhost:8000. Subsequent
 *    requests carry the cookie automatically — no manual token management.
 *
 * In production you'd achieve the same effect with an nginx reverse proxy
 * or by serving the built frontend from FastAPI's StaticFiles mount.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
