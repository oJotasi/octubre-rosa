import { build } from "esbuild";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";
import { readFile, writeFile, mkdir, readdir, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import path from "node:path";
import qrcode from "qrcode-generator";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = new URL("../outputs/github-pages/", import.meta.url);
const assets = new URL("assets/", output);
const site = "https://ojotasi.github.io/octubre-rosa/";
await mkdir(assets, { recursive: true });
// Only remove generated asset files in this script's fixed output directory.
for (const entry of await readdir(assets, { withFileTypes: true })) {
  if (entry.isFile()) await unlink(new URL(entry.name, assets));
}
const bundle = await build({
  absWorkingDir: root,
  entryPoints: { game: "github-pages/main.tsx", statistics: "github-pages/statistics.tsx" },
  outdir: fileURLToPath(assets),
  entryNames: "[name]-[hash]", chunkNames: "shared-[hash]",
  bundle: true, splitting: true, format: "esm", platform: "browser",
  minify: true, jsx: "automatic", target: "es2022", metafile: true,
  define: { "process.env.NODE_ENV": '"production"' },
});
const cssPath = fileURLToPath(new URL("../app/globals.css", import.meta.url));
const css = await postcss([tailwindcss({ base: path.join(root, "app") })]).process(await readFile(cssPath, "utf8"), { from: cssPath });
const cssName = `styles-${createHash("sha256").update(css.css).digest("hex").slice(0, 10)}.css`;
await writeFile(new URL(cssName, assets), css.css);
for (const [template, entryPoint] of [["index.html", "github-pages/main.tsx"], ["estadisticas.html", "github-pages/statistics.tsx"]]) {
  const script = Object.entries(bundle.metafile.outputs).find(([, value]) => value.entryPoint === entryPoint)?.[0];
  if (!script) throw new Error(`Missing generated script: ${entryPoint}`);
  const source = await readFile(new URL(`../github-pages/${template}`, import.meta.url), "utf8");
  const html = source.replaceAll("{{STYLES}}", `./assets/${cssName}`).replaceAll("{{SCRIPT}}", `./assets/${path.basename(script)}`);
  await writeFile(new URL(template, output), html);
}
await writeFile(new URL(".nojekyll", output), "");
const qr = qrcode(0, "M"); qr.addData(site); qr.make();
await writeFile(new URL("acceso-qr.svg", output), qr.createSvgTag({ cellSize: 6, margin: 24, scalable: true }));
await writeFile(new URL("favicon.svg", output), await readFile(new URL("../public/favicon.svg", import.meta.url)));
console.log(`GitHub Pages preparado en ${fileURLToPath(output)} (HTML, CSS y JavaScript separados).`);
