import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

const devAllowedHosts = String(process.env.VITE_DEV_ALLOWED_HOSTS || '')
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean)

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@waline\/api$/,
        replacement: fileURLToPath(new URL('./src/vendors/waline-api.js', import.meta.url))
      },
      {
        find: /^@waline\/api-original$/,
        replacement: fileURLToPath(new URL('./node_modules/@waline/api/dist/api.js', import.meta.url))
      }
    ]
  },
  plugins: [react()],
  server: {
    host: process.env.VITE_DEV_HOST || '127.0.0.1',
    port: 8080,
    strictPort: true,
    ...(devAllowedHosts.length > 0 ? { allowedHosts: devAllowedHosts } : {}),
  },
})
