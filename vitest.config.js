import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

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
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    coverage: {
      exclude: ['src/styles/**']
    }
  }
});
