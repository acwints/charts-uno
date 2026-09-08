import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Keep the feed's first paint small; these only load with the editor.
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ['recharts'],
          editor: ['@uiw/react-codemirror', '@codemirror/lang-sql'],
          capture: ['html2canvas'],
          maps: ['react-simple-maps', 'topojson-client'],
          ai: ['openai', '@google/generative-ai'],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
})
