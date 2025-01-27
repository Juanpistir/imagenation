export default {
  testDir: './tests/e2e',
  timeout: 60000,
  expect: {
    timeout: 10000
  },
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },
  retries: 2,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never' }]
  ],
  projects: [
    {
      name: 'Chrome',
      use: { 
        browserName: 'chromium',
        viewport: { width: 1280, height: 720 },
        launchOptions: {
          slowMo: 100,
        }
      },
    }
  ],
};