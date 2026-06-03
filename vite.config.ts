import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/')
          if (!normalizedId.includes('/node_modules/')) return undefined

          if (
            normalizedId.includes('/node_modules/monaco-editor/') ||
            normalizedId.includes('/node_modules/@monaco-editor/')
          ) {
            return 'monaco'
          }

          if (
            normalizedId.includes('/node_modules/react/') ||
            normalizedId.includes('/node_modules/react-dom/') ||
            normalizedId.includes('/node_modules/scheduler/')
          ) {
            return 'react'
          }

          if (normalizedId.includes('/node_modules/@radix-ui/')) {
            return 'radix'
          }

          if (normalizedId.includes('/node_modules/lucide-react/')) {
            return 'icons'
          }

          if (normalizedId.includes('/node_modules/@tauri-apps/')) {
            return 'tauri'
          }

          return 'vendor'
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
