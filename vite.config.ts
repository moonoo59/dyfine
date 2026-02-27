import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // 차트 라이브러리 분리 (~300KB)
          recharts: ['recharts'],
          // Supabase SDK 분리 (~150KB)
          supabase: ['@supabase/supabase-js'],
          // React 코어 분리
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
})
