import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
      },
      '/api/places': {
        target: 'http://localhost:3001',
        changeOrigin: false,
      },
      '/api/geocode': {
        target: 'http://localhost:3001',
        changeOrigin: false,
      },
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    exclude: ['node_modules', 'e2e'],
  },
})
