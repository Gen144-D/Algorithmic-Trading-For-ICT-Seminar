import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/auth': 'http://localhost:5000',
      '/strategies': 'http://localhost:5000',
      '/market': 'http://localhost:5000',
      '/backtest': 'http://localhost:5000',
      '/api': 'http://localhost:5000',
      '/ai': 'http://localhost:5000',
      '/ws': { target: 'ws://localhost:5000', ws: true },
    },
  },
});
