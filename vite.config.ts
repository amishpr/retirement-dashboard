import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Fixed so it always matches the `targetPort` netlify.toml expects, and so VS Code's launch
  // configs have a stable URL to open instead of guessing at Vite's "next free port" fallback.
  server: {
    port: 5183,
  },
})
