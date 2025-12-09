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
      define: {
        // Removendo a injeção da chave de API do Gemini, pois ela será gerenciada pelo estado do React.
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      // Forçar a otimização de dependências para evitar múltiplas instâncias do React
      optimizeDeps: {
        include: ['react', 'react-dom', '@supabase/auth-ui-react', '@supabase/auth-ui-shared', 'qrcode.react'],
      }
    };
});