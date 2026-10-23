import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path';

// https://vite.dev/config/
export default defineConfig(({mode}) => {
  const doNotMinify = mode === 'dev'
  return {
    build: {
      minify: !doNotMinify,
      rollupOptions: {
        output: {
          entryFileNames: 'static/js/main.min.js',  // Customize here
          assetFileNames: 'static/[ext]/main.min.[ext]' // Customize other assets like CSS
        }
      },
      target: ['chrome89', 'edge89', 'firefox89', 'safari15'],
    },
    esbuild: {
      drop: !doNotMinify ? ['console', 'debugger'] : [] // removes all calls to console.* and debugger.* when running not in dev mode
    },
    plugins: [
      {
        name: 'resolve-libsodium',
        resolveId(source, importer) {
          if (source === './libsodium.mjs' && importer?.includes('libsodium-wrappers')) {
            return path.resolve(
              __dirname,
              'node_modules/libsodium/dist/modules-esm/libsodium.mjs'
            );
          }
        },
      },
      vue()
    ],
    resolve: {
      extensions: ['.ts', '.js', '.vue', '.json'],
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    }
  }
})
