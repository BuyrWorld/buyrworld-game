import { defineConfig, devices } from '@playwright/test';

// First-hour release gate. Runs against the Vite DEV server, where the dev-only
// window.__gate bridge exists (stripped from `vite build` production bundles).
// A dedicated port keeps it clear of a running `npm run dev`.
const PORT = Number(process.env.GATE_PORT || 5178);

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 1,   // absorb the odd transient navigation abort
  timeout: 75_000,   // headroom for the first-navigation cold-load retry in cleanLoad
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
    hasTouch: true,           // enables touch-style .tap() for the cottage-exit check
    serviceWorkers: 'block',  // the PWA's /sw.js aborts the first navigation ("frame detached")
  },
  webServer: {
    command: `node node_modules/vite/bin/vite.js --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 300_000,   // Vite's first serve on this OneDrive-synced repo can be very slow to cold-start
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
