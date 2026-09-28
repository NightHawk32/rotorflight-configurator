## Setup

1. Install Node.js `nvm install`
2. Install pnpm `npm install -g pnpm`
3. Install dependencies `make init` (or, without `make`, e.g. on Windows: `pnpm install --frozen-lockfile` and `pnpm run setup`)

## Development

### Desktop

1. Run from source with `pnpm start`

**Note:** The NW.js SDK needs to be downloaded the first time the configurator is started, and may take some time to complete.

`pnpm start` runs the Vite dev server and the NW.js client together; closing the configurator window stops both. It also installs the Font Awesome assets on first use.

**Another port:** the dev server uses port 5077. To run a second checkout at the same time, pick another port with `RF_DEV_PORT`:

```
RF_DEV_PORT=5078 pnpm start          # bash
$env:RF_DEV_PORT=5078; pnpm start    # PowerShell
set RF_DEV_PORT=5078 && pnpm start   # cmd
```

The NW.js client then uses a generated manifest in `.nwjs-dev/` with its own profile, so both instances can be open side by side.

### Windows

Everything above works from PowerShell or cmd. No symlink support, Developer Mode or `make` is needed:

- `public/images`, `libraries`, `locales` and `resources` are git symlinks. Without symlink support git checks them out as small text files; the dev server then serves, and the build copies, those directories from their real location (`vite-plugin-linked-dirs.mjs`).
- `.svelte`, `.mjs`, `.ts` and `.scss` files are checked out with LF line endings, so Prettier checks pass with `core.autocrlf=true`.

### Android

Developing for Android requires JDK 11, gradle, and Android SDK 33.

1. Start an Android emulator or connect a physical device with debugging enabled
2. Set a version for the application `SEMVER=2.1.0-dev make version`
3. Run `make android`
4. Open `chrome://inspect/#devices` in a Chrome browser to debug

## Building

Tasks are defined in `gulpfile.mjs` and can be run with pnpm.

```
pnpm gulp <task> [--debug] [--platform <platform>] [--arch <arch>]
```

**`<task>`**

- **`bundle`** bundles the source files into `./bundle`.
- **`app`** builds the application in `./app`.
- **`redist`** creates redistributable archives in `./redist`.

**`--debug`** Outputs builds that can be debugged with Chrome DevTools or an Android debugger.

**`<platform>`** Defaults to the host platform.

- linux
- osx
- win
- android

**`<arch>`** Defaults to the host architecture.

- x86
- x86_64
- arm64
