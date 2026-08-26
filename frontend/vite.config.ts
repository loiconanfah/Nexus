import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// Proxy vers l'API NEXUS en développement (évite CORS).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:5199', changeOrigin: true },
      '/health': { target: 'http://localhost:5199', changeOrigin: true },
    },
  },
})
