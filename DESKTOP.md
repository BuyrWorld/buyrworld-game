# BuyrWorld — Desktop & Steam build

BuyrWorld ships as a web app **and** as a native desktop app via Electron. The
desktop wrapper (`electron/main.cjs`) serves the built `dist/` over a private
`127.0.0.1` HTTP server and loads it, so the game's absolute `/assets/…` paths
work identically to the web build.

## Prerequisites

```bash
npm install          # pulls electron + electron-builder (dev dependencies)
```

## Run locally

```bash
npm run electron         # builds dist/ then launches the desktop app
npm run electron:dev     # loads the live Vite dev server (run `npm run dev` first)
```

## Package installers

```bash
npm run dist:win         # Windows: NSIS installer + portable .exe  → release/
npm run dist:mac         # macOS:   .dmg
npm run dist:linux       # Linux:   AppImage + tar.gz
npm run dist:desktop     # build for the current platform
```

Output lands in `release/`. Icons are derived automatically by electron-builder
from `build/icon.png` (regenerate the source icons with `npm run gen:icons`).

## Steam

1. Build an **unpacked** directory (Steam wants raw files, not an installer):

   ```bash
   npm run dist:steam       # → release/win-unpacked/
   ```

2. In `build/steam_appid.txt`, replace the placeholder `480` (Valve's Spacewar
   test app) with your real Steam App ID. It is copied next to the executable so
   the Steam client can attach the overlay.

3. Upload `release/win-unpacked/` as a Steam **depot**, and set the launch
   executable to `BuyrWorld.exe` in the Steamworks app config.

### Overlay & achievements (optional)

The wrapper calls `initSteam()` on launch. To enable the Steam overlay and
achievements, add the native binding and it will be picked up automatically:

```bash
npm install steamworks.js
```

Without it, the app runs standalone (Steam features are simply skipped) — so the
same build works on and off Steam.
