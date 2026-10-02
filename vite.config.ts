import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type HtmlTagDescriptor, type Plugin } from 'vite'
import { fileURLToPath } from 'node:url'
import { CORE_TICKERS, DEFAULT_FINANCE_ENDPOINT, DEFAULT_INFLATION_ENDPOINT, quotesUrl } from './src/lib/coreQuotes.ts'

/**
 * Starts the page's first requests while the HTML is still being read, rather than once the app's
 * JavaScript has loaded and run: both fonts, the core five quotes, and the inflation data. Without
 * it the fonts are only requested when the first layout finds text that needs them, which costs a
 * second full layout and a visible swap. The fetch URLs come from the same helper the app uses,
 * because the browser only hands a preloaded response to a request for exactly the same URL.
 */
function preloadFirstRequests({ finance, inflation }: { finance: string; inflation: string }): Plugin {
  let base = '/'
  return {
    name: 'preload-first-requests',
    configResolved(config) {
      base = config.base
    },
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        if (!ctx.filename.endsWith('/index.html')) return
        const tag = (attrs: HtmlTagDescriptor['attrs']): HtmlTagDescriptor => ({ tag: 'link', attrs, injectTo: 'head' })
        // Hashed names only exist in a build, and not at all if the font download was skipped.
        const fonts = Object.keys(ctx.bundle ?? {}).filter((file) => file.endsWith('.woff2'))
        return [
          ...fonts.map((file) => tag({ rel: 'preload', href: `${base}${file}`, as: 'font', type: 'font/woff2', crossorigin: true })),
          tag({ rel: 'preload', href: quotesUrl(finance, CORE_TICKERS), as: 'fetch', crossorigin: true }),
          tag({ rel: 'preload', href: inflation, as: 'fetch', crossorigin: true }),
        ]
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    plugins: [
      react(),
      tailwindcss(),
      preloadFirstRequests({
        finance: env.VITE_FINANCE_ENDPOINT || DEFAULT_FINANCE_ENDPOINT,
        inflation: env.VITE_INFLATION_ENDPOINT || DEFAULT_INFLATION_ENDPOINT,
      }),
    ],
    // Netlify serves this from the domain root, but a GitHub Pages *project* site serves it from
    // "/<repo>/", so the asset URLs baked into the HTML have to be prefixed. The Pages workflow
    // passes the repo name through BASE_PATH; every other build keeps the plain root default.
    base: process.env.BASE_PATH ?? '/',
    build: {
      rolldownOptions: {
        input: {
          main: fileURLToPath(new URL('./index.html', import.meta.url)),
          // Built rather than copied from public/ so its links pick up `base`. Netlify serves this
          // for unmatched paths, and GitHub Pages does the same with a root-level /404.html.
          notFound: fileURLToPath(new URL('./404.html', import.meta.url)),
        },
        output: {
          // The libraries in their own files, so a deploy that only changes the app leaves them
          // cached (/assets is served as immutable). The first load is the same number of bytes.
          // Each group names its packages, so ExcelJS stays an on-demand chunk of its own.
          codeSplitting: {
            groups: [
              { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 3 },
              { name: 'motion', test: /node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/, priority: 2 },
              { name: 'charts', test: /node_modules[\\/](recharts|victory-vendor|d3-[a-z-]+)[\\/]/, priority: 1 },
            ],
          },
        },
      },
    },
    // Fixed so it always matches the `targetPort` netlify.toml expects, and so VS Code's launch
    // configs have a stable URL to open instead of guessing at Vite's "next free port" fallback.
    server: {
      port: 5183,
    },
  }
})
