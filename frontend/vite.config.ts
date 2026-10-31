import { monacoLocalization } from './monaco-localization.ts'
/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const apiTarget = process.env.IMAGE_PIPES_API_PROXY || 'http://127.0.0.1:8000'
const vitePort = Number(process.env.IMAGE_PIPES_VITE_PORT || 5173)

export default defineConfig({
  plugins: [monacoLocalization(), react()],
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
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
