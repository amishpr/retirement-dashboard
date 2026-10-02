/**
 * Downloads the app's two fonts, Satoshi and Cabinet Grotesk, from Fontshare into
 * src/assets/fonts/, where index.css picks them up and Vite fingerprints them into /assets.
 *
 * Why a download step instead of committing the files: both fonts are under the ITF Free Font
 * License, which allows self-hosting them for your own site but not making the files available in
 * a public repository, and this repo is public. So the folder is gitignored and this runs before
 * `dev` and `build` (npm's predev and prebuild hooks), on Netlify and in the Pages workflow alike.
 *
 * Files that are already there are skipped. A failed download only warns: the build goes ahead and
 * the page falls back to the system font stack in index.css, rather than a Fontshare outage
 * breaking a deploy.
 */
import { mkdir, stat, writeFile } from "node:fs/promises";

const OUT_DIR = new URL("../src/assets/fonts/", import.meta.url);

// `@1` asks Fontshare's CSS API for the variable version of each family.
const FONTS = [
  { family: "Satoshi", slug: "satoshi", file: "Satoshi-Variable.woff2" },
  { family: "Cabinet Grotesk", slug: "cabinet-grotesk", file: "CabinetGrotesk-Variable.woff2" },
];

async function exists(url) {
  try {
    return (await stat(url)).size > 0;
  } catch {
    return false;
  }
}

/** The upright woff2 URL for `family` in a Fontshare stylesheet. The API sometimes returns other
 *  families in the same response, so each @font-face block is matched by name, not position. */
function findWoff2(css, family) {
  for (const block of css.split("@font-face").slice(1)) {
    const name = /font-family:\s*'([^']+)'/.exec(block)?.[1];
    const style = /font-style:\s*(\w+)/.exec(block)?.[1] ?? "normal";
    const src = /url\('([^']+\.woff2)'\)/.exec(block)?.[1];
    if (name === family && style === "normal" && src) return src.startsWith("//") ? `https:${src}` : src;
  }
  return undefined;
}

async function download({ family, slug, file }) {
  const target = new URL(file, OUT_DIR);
  if (await exists(target)) return;

  const cssRes = await fetch(`https://api.fontshare.com/v2/css?f[]=${slug}@1&display=swap`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!cssRes.ok) throw new Error(`stylesheet request returned ${cssRes.status}`);
  const src = findWoff2(await cssRes.text(), family);
  if (!src) throw new Error("no variable woff2 in the stylesheet");

  const fontRes = await fetch(src, { signal: AbortSignal.timeout(30000) });
  if (!fontRes.ok) throw new Error(`font request returned ${fontRes.status}`);
  const bytes = new Uint8Array(await fontRes.arrayBuffer());
  // Every woff2 file starts with the signature "wOF2". Anything else is an error page.
  if (String.fromCharCode(...bytes.slice(0, 4)) !== "wOF2") throw new Error("response is not a woff2 file");

  await writeFile(target, bytes);
  console.log(`fetch-fonts: saved ${file} (${Math.round(bytes.length / 1024)} KB)`);
}

await mkdir(OUT_DIR, { recursive: true });
for (const font of FONTS) {
  try {
    await download(font);
  } catch (err) {
    console.warn(`fetch-fonts: couldn't get ${font.family} (${err.message}). The app will use fallback fonts.`);
  }
}
