import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import dyadComponentTagger from '@dyad-sh/react-vite-component-tagger';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [dyadComponentTagger(), react()],
      define: {
        // Removendo a injeção da chave de API do Gemini, pois ela será gerenciada pelo estado do React.
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      // Adicionando esta configuração para garantir que o Vite não tente pré-otimizar o React,
      // confiando no carregamento via importmap.
      optimizeDeps: {
        exclude: ['react', 'react-dom'],
      }
    };
});