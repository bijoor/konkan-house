import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import fs from 'node:fs'
import type { Plugin } from 'vite'

// Editor is a standalone SPA that ships to `docs/editor/` on the same
// GitHub Pages site as the model viewer. `base: './'` keeps asset URLs
// relative so it works under any subpath (both local dev and Pages).
//
// The auto-load flow in App.tsx fetches `../house_config.json` on first
// visit — this maps to `docs/house_config.json` once deployed to Pages.
// The plugin below copies the canonical config from the repo root into
// the docs output on every build so the fetch has a target.
function copyHouseConfig(): Plugin {
  return {
    name: 'copy-house-config',
    apply: 'build',
    closeBundle() {
      const src = path.resolve(__dirname, '../house_config.json')
      const dst = path.resolve(__dirname, '../docs/house_config.json')
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dst)
        console.log(`  copied ${path.relative(process.cwd(), src)} → ${path.relative(process.cwd(), dst)}`)
      }
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), copyHouseConfig()],
  build: {
    outDir: path.resolve(__dirname, '../docs/editor'),
    emptyOutDir: true,
  },
  // Dev-mode convenience: serve the repo root as a static prefix so the
  // fetch("../house_config.json") in App.tsx resolves during local dev
  // too (Vite dev-server default only serves under `public/`).
  server: {
    fs: {
      allow: [path.resolve(__dirname), path.resolve(__dirname, '..')],
    },
  },
})
