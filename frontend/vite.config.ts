import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/process': 'http://localhost:8000',
      '/stream': 'http://localhost:8000',
      '/result': 'http://localhost:8000',
      '/download': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
    },
  },
})
