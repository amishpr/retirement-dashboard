import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Netlify serves this from the domain root, but a GitHub Pages *project* site serves it from
  // "/<repo>/", so the asset URLs baked into the HTML have to be prefixed. The Pages workflow
  // passes the repo name through BASE_PATH; every other build keeps the plain root default.
  base: process.env.BASE_PATH ?? '/',
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        // Built rather than copied from public/ so its links pick up `base`. Netlify serves this
        // for unmatched paths, and GitHub Pages does the same with a root-level /404.html.
        notFound: fileURLToPath(new URL('./404.html', import.meta.url)),
      },
    },
  },
  // Fixed so it always matches the `targetPort` netlify.toml expects, and so VS Code's launch
  // configs have a stable URL to open instead of guessing at Vite's "next free port" fallback.
  server: {
    port: 5183,
  },
})
