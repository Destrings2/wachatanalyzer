import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/wachatanalyzer/',
  css: {
    devSourcemap: true,
  },
  worker: {
    format: 'es'
  }
})
