import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    solidPlugin(),
    VitePWA({
      registerType: 'autoUpdate', // 업데이트가 있으면 즉시 새로고침 (게임에 적합)
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg', 'images/*.png', 'images/*.json'], // 캐싱할 정적 파일들
      manifest: {
        name: '살아 남아라 길냥이!', // 앱 전체 이름
        short_name: '살아 남아라 길냥이!', // 아이콘 아래에 표시될 짧은 이름
        description: '뱀서류 길냥이 서바이벌 게임',
        theme_color: '#2d4c1e', // 상단 상태바 색상 (게임 배경색과 맞춤)
        background_color: '#2d4c1e', // 로딩 화면 배경색
        display: 'standalone', // 주소창 없는 앱 모드
        orientation: 'landscape', // 게임이니까 가로 모드 고정 (선택 사항)
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
            purpose: 'any maskable' // 안드로이드 아이콘 마스킹 지원
          }
        ]
      },
      workbox: {
        // 4MB 이상의 파일도 캐싱 허용 (게임 에셋이 클 경우를 대비)
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}']
      }
    })
  ],
});