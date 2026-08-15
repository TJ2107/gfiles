import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        hmr: false,
        watch: {
          ignored: ['**/server-debug.log']
        }
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['favicon.svg'],
          workbox: {
            maximumFileSizeToCacheInBytes: 5000000 // 5MB
          },
          manifest: {
            name: 'GLOBAL FILES - Gestion Enterprise',
            short_name: 'GlobalFiles',
            description: 'Application professionnelle pour le suivi de la maintenance préventive.',
            theme_color: '#4338ca',
            background_color: '#0f172a',
            display: 'standalone',
            icons: [
              {
                src: '/favicon.svg',
                sizes: 'any',
                type: 'image/svg+xml',
                purpose: 'any maskable'
              }
            ]
          }
        })
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
