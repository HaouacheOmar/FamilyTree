import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The app calls the backend at http://127.0.0.1:8000 directly (see API_BASE_URL in src/App.jsx).
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5173 },
})
