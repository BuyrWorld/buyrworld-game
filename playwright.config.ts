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
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
    hasTouch: true,   // enables touch-style .tap() for the cottage-exit check
  },
  webServer: {
    command: `node node_modules/vite/bin/vite.js --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
