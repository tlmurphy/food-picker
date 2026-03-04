import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/places': {
          target: 'https://places-api.foursquare.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/places/, '/places'),
          headers: {
            Authorization: `Bearer ${env.VITE_FOURSQUARE_API_KEY}`,
            'X-Places-Api-Version': '2025-06-17',
          },
        },
      },
    },
  }
})
