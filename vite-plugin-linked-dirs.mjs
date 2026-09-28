import fs from "node:fs";
import path from "node:path";

// public/{images,libraries,locales,resources} are git symlinks to the real
// directories. A Windows checkout without symlink support (git's default
// there, core.symlinks=false) turns each of them into a small text file that
// holds the target path, so Vite would serve and bundle nothing for them.
//
// This plugin serves (dev) and copies (build) those directories from their
// real location whenever the public/ entry is not a directory. Where the
// symlinks work (Linux, macOS, Windows with symlinks enabled) it does
// nothing.

export const LINKED_DIRS = {
  images: "src/images",
  libraries: "libraries",
  locales: "locales",
  resources: "resources",
};

const MIME_TYPES = {
  ".bin": "application/octet-stream",
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".gltf": "model/gltf+json",
  ".html": "text/html; charset=utf-8",
  ".icns": "image/icns",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function isDirectory(p) {
  return fs.statSync(p, { throwIfNoEntry: false })?.isDirectory() ?? false;
}

function isFile(p) {
  return fs.statSync(p, { throwIfNoEntry: false })?.isFile() ?? false;
}

// public/ entries that are not usable directories, with their real location
export function unlinkedDirs(root) {
  return Object.entries(LINKED_DIRS)
    .filter(([name]) => !isDirectory(path.join(root, "public", name)))
    .map(([name, target]) => ({ name, dir: path.join(root, target) }));
}

export function linkedDirs() {
  let root;
  let outDir;

  return {
    name: "linked-dirs",

    configResolved(config) {
      root = config.root;
      outDir = path.resolve(root, config.build.outDir);
    },

    configureServer(server) {
      const dirs = unlinkedDirs(root);
      if (dirs.length === 0) {
        return;
      }

      server.config.logger.info(
        `linked-dirs: serving ${dirs.map((d) => d.name).join(", ")} ` +
          "from their real location (public/ symlinks not available)",
      );

      // Registered before Vite's own middlewares
      server.middlewares.use((req, res, next) => {
        const url = decodeURIComponent((req.url ?? "").split("?")[0]);
        const match = url.match(/^\/([^/]+)\/(.+)$/);
        const entry = match && dirs.find((d) => d.name === match[1]);
        if (!entry) {
          return next();
        }

        const file = path.resolve(entry.dir, match[2]);
        if (!file.startsWith(entry.dir + path.sep) || !isFile(file)) {
          return next();
        }

        res.setHeader(
          "Content-Type",
          MIME_TYPES[path.extname(file).toLowerCase()] ??
            "application/octet-stream",
        );
        res.setHeader("Cache-Control", "no-cache");
        fs.createReadStream(file).pipe(res);
      });
    },

    // Build only (unlike closeBundle, not called when the dev server stops)
    writeBundle() {
      for (const { name, dir } of unlinkedDirs(root)) {
        const dest = path.join(outDir, name);
        // Vite copied the placeholder file from public/; replace it
        fs.rmSync(dest, { recursive: true, force: true });
        fs.cpSync(dir, dest, { recursive: true });
      }
    },
  };
}
