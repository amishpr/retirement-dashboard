/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Absolute URL of the finance proxy, for builds deployed somewhere that can't host the
   * serverless function itself (GitHub Pages). Unset means "same origin", which is what the
   * Netlify deploy and `netlify dev` use.
   */
  readonly VITE_FINANCE_ENDPOINT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
