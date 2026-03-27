import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: 0,
  reporter: 'html', 
  use: {
    trace: 'retain-on-failure',
    screenshot: 'on', 
    video: 'on', 
  },
  projects: [
    {
      name: 'Desktop Chrome (PC)',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome (HP)',
      use: { ...devices['Pixel 5'] },
    }
  ],
});
