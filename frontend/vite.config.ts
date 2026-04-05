import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/webauthn': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/otp': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/me': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/devices': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/activity': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/logout': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});