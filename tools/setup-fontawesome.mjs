// Copies the Font Awesome stylesheet and solid webfonts from node_modules to
// public/fontawesome (git-ignored). Cross-platform replacement for the
// Makefile's rm/mkdir/cp.
//
//   node tools/setup-fontawesome.mjs              always (re)create
//   node tools/setup-fontawesome.mjs --if-missing only when not there yet

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const src = path.join(root, "node_modules/@fortawesome/fontawesome-free");
const dst = path.join(root, "public/fontawesome");
const css = path.join(dst, "css/all.min.css");

if (process.argv.includes("--if-missing") && fs.existsSync(css)) {
  process.exit(0);
}

if (!fs.existsSync(src)) {
  console.error(
    "setup-fontawesome: @fortawesome/fontawesome-free not installed, run `pnpm install` first",
  );
  process.exit(1);
}

fs.rmSync(dst, { recursive: true, force: true });
fs.mkdirSync(path.join(dst, "css"), { recursive: true });
fs.mkdirSync(path.join(dst, "webfonts"), { recursive: true });

fs.copyFileSync(path.join(src, "css/all.min.css"), css);

const fonts = fs
  .readdirSync(path.join(src, "webfonts"))
  .filter((f) => f.startsWith("fa-solid"));
for (const font of fonts) {
  fs.copyFileSync(
    path.join(src, "webfonts", font),
    path.join(dst, "webfonts", font),
  );
}

console.log(`setup-fontawesome: copied stylesheet and ${fonts.length} fonts`);
