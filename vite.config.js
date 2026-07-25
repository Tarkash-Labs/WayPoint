import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Proxy external API calls through the dev server to avoid CORS issues.
  // The browser sends requests to /api/nvidia/* and /api/gemini/* which Vite
  // forwards to the real endpoints, adding the correct headers server-side.
  server: {
    proxy: {
      '/api/nvidia': {
        target: 'https://integrate.api.nvidia.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/nvidia/, ''),
        secure: true,
      },
      '/api/gemini': {
        target: 'https://generativelanguage.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/gemini/, ''),
        secure: true,
      },
      '/api/github': {
        target: 'https://api.github.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/github/, ''),
        secure: true,
      },
      '/api/raw-github': {
        target: 'https://raw.githubusercontent.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/raw-github/, ''),
        secure: true,
      },
    },
  },
})
