import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/ws': {
          target: 'ws://localhost:3001',
          ws: true,
        },
        '/api/places': {
          target: 'https://places.googleapis.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/places/, '/v1/places'),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              proxyReq.setHeader('X-Goog-Api-Key', env.VITE_GOOGLE_MAPS_API_KEY)
              const url = req.url ?? ''
              if (url.includes(':autocomplete'))
                proxyReq.setHeader('X-Goog-FieldMask', 'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.distanceMeters')
              else if (url.includes(':searchText'))
                proxyReq.setHeader('X-Goog-FieldMask', 'places.displayName,places.formattedAddress,places.location')
              else
                proxyReq.setHeader('X-Goog-FieldMask', 'location,displayName,formattedAddress')
            })
          },
        },
      },
    },
  }
})
