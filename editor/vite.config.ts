import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// Editor is a standalone SPA that ships to `docs/editor/` on the same
// GitHub Pages site as the model viewer. `base: './'` keeps asset URLs
// relative so it works under any subpath (both local dev and Pages).
//
// The auto-load flow in App.tsx fetches `../house_config.json` — from
// docs/editor/ that resolves to docs/house_config.json, which is the
// single canonical source of truth for both Python (via a repo-root
// symlink `house_config.json` → `docs/house_config.json`) and the
// browser. No build-time copy needed — save anywhere and everything
// sees it.

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
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
