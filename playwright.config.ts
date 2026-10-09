import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/crm-bot', fullyParallel: false, workers: 1,
  timeout: 60000, retries: 0,
  outputDir: 'crm-bot-report/artifacts',
  reporter: [['list'], ['html', { outputFolder: 'crm-bot-report/html', open: 'never' }], ['json', { outputFile: 'crm-bot-report/browser.json' }]],
  use: { baseURL: process.env.CRM_BOT_URL || 'https://ajuda-pr-cion.vercel.app', screenshot: 'only-on-failure', trace: 'off', actionTimeout: 15000 },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'tablet', use: { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
