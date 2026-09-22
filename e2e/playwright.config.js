const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: '.', testMatch: '*.spec.js', fullyParallel: false, workers: 1, retries: 0,
  reporter: 'list', timeout: 20000,
  use: { baseURL: 'http://127.0.0.1:45174', trace: 'off', screenshot: 'off', video: 'off' },
  webServer: [
    { command: 'pnpm --filter api dev', url: 'http://127.0.0.1:43101/api/health', reuseExistingServer: false,
      env: { MOCK_LLM: '1', ALLOW_LIVE_PROVIDERS: '0', PORT: '43101', WEB_ORIGIN: 'http://127.0.0.1:45174', REQUEST_TIMEOUT_MS: '1500', GROQ_API_KEY: '', ELEVENLABS_API_KEY: '' } },
    { command: 'pnpm --filter web dev --host 127.0.0.1 --port 45174 --strictPort', url: 'http://127.0.0.1:45174', reuseExistingServer: false,
      env: { VITE_API_BASE_URL: 'http://127.0.0.1:43101' } },
  ],
});
