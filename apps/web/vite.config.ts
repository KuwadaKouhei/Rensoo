import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// バンドル分割（NFR-2 / 初期ロード最適化）。
// 重い描画系（React Flow＋Dagre）と React ランタイムを vendor チャンクに分け、
// アプリコードの変更時にライブラリ部のキャッシュが効くようにする。
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-flow': ['@xyflow/react', '@dagrejs/dagre'],
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
})
