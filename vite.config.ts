import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-chess': ['chess.js', 'react-chessboard'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-lucide': ['lucide-react'],
        },
      },
    },
  },
});
