import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  build: {
    chunkSizeWarningLimit: 700,
    rolldownOptions: {
      output: {
        // Bibliotheken getrennt vom eigenen Code ausliefern: bei einem App-Update
        // muss das Gerät dann nur den kleinen eigenen Teil neu laden.
        codeSplitting: {
          groups: [{ name: 'vendor', test: /node_modules/ }],
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Momentum',
        short_name: 'Momentum',
        description: 'Alle Vorhaben und ihr Fortschritt auf einen Blick',
        lang: 'de',
        start_url: '/',
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#4f46e5',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        // Push-Benachrichtigungen anzeigen (public/push-sw.js)
        importScripts: ['push-sw.js'],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
})
