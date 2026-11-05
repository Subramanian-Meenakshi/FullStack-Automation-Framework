const { defineConfig } = require('@playwright/test');
const { UI_URL } = require('../helpers/services');

const UI = UI_URL;

const allureResults = process.env.ALLURE_RESULTS_DIR || 'reports/allure-results';

module.exports = defineConfig({
  testDir: '../tests',
  // 60s: UI tests navigate a full employee list (700+ rows after a data-
  // accumulating gate run, no pagination yet) — 30s exhausted on J-06/J-09/J-10.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: 1,
  // D-N02/E-N01/E-N02/F-N04 pause infra or kill the consumer — parallel workers would race them.
  workers: 1,
  reporter: [
    ['list'],
    [require.resolve('../helpers/allureStepReporter.js'), { resultsDir: allureResults }],
  ],
  use: {
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'Smoke',
      testMatch: /tests\/smoke\/.*\.spec\.js/,
    },
    {
      name: 'Functional',
      testMatch: /tests\/(api|security)\/.*\.spec\.js/,
    },
    {
      name: 'E2E',
      testMatch: /tests\/(ui|e2e)\/.*\.spec\.js/,
      use: { baseURL: UI },
    },
    {
      name: 'Regression',
      testMatch: /tests\/(api|security|ui|e2e)\/.*\.spec\.js/,
      use: { baseURL: UI },
    },
  ],
  globalSetup: require.resolve('./global-setup.js'),
});
