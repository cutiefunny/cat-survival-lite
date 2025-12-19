import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path'; // [추가] 경로 해결을 위해 필요

export default defineConfig({
  plugins: [
    solidPlugin(),
    VitePWA({
      // ... 기존 PWA 설정 그대로 유지 ...
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
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}']
      }
    })
  ],
  // [추가] 빌드 설정: 멀티 페이지 앱(MPA) 구성
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html')
      }
    }
  }
});