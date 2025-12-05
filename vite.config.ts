import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      optimizeDeps: {
        exclude: ['react', 'react-dom'],
      },
      build: {
        rollupOptions: {
          external: ['react', 'react-dom', 'react-dom/client'],
        },
      },
      define: {
        // Removendo a injeção da chave de API do Gemini, pois ela será gerenciada pelo estado do React.
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});