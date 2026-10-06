import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('pdf-lib')) return 'pdf-lib';
          if (id.includes('react') || id.includes('react-dom')) return 'react-vendor';
        },
      },
    },
  },
  optimizeDeps: {
    include: ['pdf-lib', 'papaparse'],
  },
})
