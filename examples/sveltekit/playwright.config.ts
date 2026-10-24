import { defineConfig, devices } from '@playwright/test';

const port = 4392;

export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: `http://localhost:${port}/` },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm build && pnpm preview --port ${port} --strictPort`,
    url: `http://localhost:${port}/`,
    reuseExistingServer: false,
  },
});
