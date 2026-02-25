import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Use /contento/ so assets resolve correctly when served at /contento (no trailing slash)
  base: '/contento/',
});
