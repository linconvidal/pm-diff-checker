import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/pm-diff-checker/',
  build: {
    outDir: 'docs',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    host: true
  }
})