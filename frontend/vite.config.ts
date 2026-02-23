import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,          // allow access via localhost & local IP
    port: 5173,          // or any port you want
    strictPort: true,    // fail if port already used
    open: true,          // auto open browser
  },
})
