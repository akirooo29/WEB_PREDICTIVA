import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173, // El puerto donde corre React
    proxy: {
      '/api': {
        target: 'http://localhost:5039', // <-- ¡TU API DE ASP.NET CORE!
        changeOrigin: true,
        secure: false,
      }
    }
  }
})