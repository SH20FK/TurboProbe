import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    {
      name: 'clean-assets-only',
      buildStart() {
        const assetsDir = path.resolve(import.meta.dirname, '../docs/assets')
        if (fs.existsSync(assetsDir)) {
          fs.rmSync(assetsDir, { recursive: true, force: true })
        }
      }
    },
    react(),
    tailwindcss(),
  ],
  build: {
    outDir: '../docs',
    emptyOutDir: false, // keep docs/sub intact, plugin cleans docs/assets
  }
})

