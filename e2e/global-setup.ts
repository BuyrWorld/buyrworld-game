import { chromium } from '@playwright/test';

// Vite's very first index.html serve on this repo is extremely slow to cold-start
// (~45s on the OneDrive-synced filesystem); every subsequent load is fast. Warm
// the exact browser load path ONCE here so the timed tests all hit a warm server.
export default async function globalSetup() {
  const port = process.env.GATE_PORT || 5178;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const t = Date.now();
  try {
    await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded', timeout: 150_000 });
    await page.locator('#title').waitFor({ state: 'visible', timeout: 150_000 });
  } finally {
    // eslint-disable-next-line no-console
    console.log(`[gate] dev server warmed in ${Date.now() - t}ms`);
    await browser.close();
  }
}
