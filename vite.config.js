import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

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
    host: true,
    port: 8080,
    strictPort: true,
    allowedHosts: true,
  },
})
