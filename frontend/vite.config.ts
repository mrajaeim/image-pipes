import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiTarget = process.env.IMAGE_PIPES_API_PROXY || 'http://127.0.0.1:8000'
const vitePort = Number(process.env.IMAGE_PIPES_VITE_PORT || 5173)

export default defineConfig({
  plugins: [react()],
  server: {
    port: vitePort,
    strictPort: true,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/ws': {
        target: apiTarget.replace(/^http/, 'ws'),
        ws: true,
      },
    },
  },
})
