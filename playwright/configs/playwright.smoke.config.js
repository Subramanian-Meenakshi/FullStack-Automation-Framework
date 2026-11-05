const { defineConfig } = require('@playwright/test');

const allureResults = process.env.ALLURE_RESULTS_DIR || 'reports/allure-results-smoke';

module.exports = defineConfig({
  testDir: '../tests/smoke',
  timeout: 30_000,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    [require.resolve('../helpers/allureStepReporter.js'), { resultsDir: allureResults }],
  ],
  use: { headless: true },
  globalSetup: require.resolve('./global-setup.js'),
});
