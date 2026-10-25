/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const gameOrigin = new URL(env.VITE_GAME_ORIGIN || 'http://localhost:5174').origin;
  // Chỉ dùng cho dev server: frontend gọi /api cùng origin (cookie đăng nhập SameSite), Vite proxy sang backend.
  const apiTarget = env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3000';
  const headers = {
    'Content-Security-Policy': `frame-src ${gameOrigin}; object-src 'none'; base-uri 'self'`,
  };

  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      headers,
      proxy: {
        '/api': apiTarget,
      },
    },
    preview: { headers },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['src/test/setup.ts'],
    },
  };
});
