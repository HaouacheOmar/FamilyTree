import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Proxy /api requests to Django backend at http://localhost:8000
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // Use IPv4 localhost to avoid environments where `localhost` resolves to ::1
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
