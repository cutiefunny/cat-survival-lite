import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    solidPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg', 'images/*.png', 'images/*.json'],
      manifest: {
        name: '살아 남아라 길냥이!',
        short_name: '살아 남아라 길냥이!',
        description: '뱀서류 길냥이 서바이벌 게임',
        theme_color: '#2d4c1e',
        background_color: '#2d4c1e',
        display: 'standalone',
        orientation: 'landscape',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // [최적화] 캐시 제한을 조금 늘려 Phaser 허용
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}']
      }
    })
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html')
      },
      // [최적화] 수동 청크 분할 (Code Splitting)
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('phaser')) {
              return 'vendor_phaser'; // Phaser 관련은 별도 파일로 분리
            }
            return 'vendor'; // 나머지 라이브러리 분리
          }
        }
      }
    },
    // [최적화] 청크 크기 경고 기준 상향 (Phaser가 크기 때문)
    chunkSizeWarningLimit: 1500
  }
});