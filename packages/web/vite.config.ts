import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { defineConfig, type Connect, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const seoRoutes = new Set([
  '/bar-chart-maker',
  '/csv-to-chart',
  '/iphone-chart-maker',
  '/pie-chart-maker',
  '/line-graph-maker',
  '/chart-from-google-sheets',
])

function seoPages(): Plugin {
  const serve: Connect.NextHandleFunction = (req, res, next) => {
    const url = req.url?.split('?')[0] ?? ''
    if (!seoRoutes.has(url)) return next()
    const file = path.resolve('public', url.slice(1), 'index.html')
    if (!existsSync(file)) return next()
    res.statusCode = 200
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end(readFileSync(file))
  }
  return {
    name: 'seo-pages',
    configureServer(server) {
      server.middlewares.use(serve)
    },
    configurePreviewServer(server) {
      server.middlewares.use(serve)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), seoPages()],
  server: {
    proxy: {
      // Same path the production host proxies to the API, so a copied share
      // link opens on this origin during local development. The pattern is
      // anchored so it does not swallow /src or /sitemap.xml.
      '^/s/': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
  build: {
    // Keep the feed's first paint small; these only load with the editor.
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ['recharts'],
          editor: ['@uiw/react-codemirror', '@codemirror/lang-sql'],
          capture: ['modern-screenshot'],
          maps: ['react-simple-maps', 'topojson-client'],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
})
