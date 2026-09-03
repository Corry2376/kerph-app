// Playwright config for the Kerph smoke suite.
//
// The site is plain static files with no build step, so the "server" is just a static file
// server over the repo root — the same thing Cloudflare Workers Assets does in production
// (assets.directory is "." in wrangler.jsonc). python3 is used rather than a node static
// server so CI doesn't need a second npm install just to serve files.
//
// Tests run against real Supabase over the network, deliberately: a smoke suite that stubs
// the backend would still pass while the actual site was down. The tests are written so that
// only the checks that genuinely need data depend on it.

const { defineConfig, devices } = require('@playwright/test');

const PORT = 5173;
const BASE_URL = `http://127.0.0.1:${PORT}`;

module.exports = defineConfig({
  testDir: './tests',
  // Fail the build rather than hang if a selector never appears.
  timeout: 45_000,
  expect: { timeout: 10_000 },
  // A flaky smoke suite is worse than none — it trains you to ignore red. One retry in CI
  // absorbs genuine network noise from the CDN and Supabase without hiding real failures,
  // since a test that fails twice still fails the run.
  retries: process.env.CI ? 1 : 0,
  // Serial locally (easier to watch), parallel in CI (faster).
  workers: process.env.CI ? 4 : 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `python3 -m http.server ${PORT}`,
    url: `${BASE_URL}/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
