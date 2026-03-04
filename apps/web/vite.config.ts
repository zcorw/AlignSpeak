import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const proxyTarget = process.env.API_PROXY_TARGET || "http://localhost:8000";
const usePolling = process.env.VITE_WATCH_POLLING?.toLowerCase() === "true";
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    watch: usePolling
      ? {
          usePolling: true,
          interval: 150,
        }
      : undefined,
    proxy: {
      "/auth": {
        target: proxyTarget,
        changeOrigin: true,
        secure: false,
      },
      "/api": {
        target: proxyTarget,
        changeOrigin: true,
        secure: false,
      },
      "/articles": {
        target: proxyTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
