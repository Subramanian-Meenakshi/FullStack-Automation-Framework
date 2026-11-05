const { expect } = require('@playwright/test');

const LOGIN_TITLE = 'Sandhata Employee Portal';

async function gotoLogin(page) {
  await page.goto('/login');
}

async function expectLoginChrome(page) {
  await expect(page).toHaveTitle(LOGIN_TITLE);
  // AppBar h6 + login h5 share the brand text — pin to the login card heading.
  await expect(page.getByRole('heading', { name: LOGIN_TITLE, level: 5 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'About this project' })).toBeVisible();
}

async function submitCredentials(page, username, password) {
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
}

async function expectErrorAlert(page, text) {
  await expect(page.getByRole('alert')).toContainText(text);
}

module.exports = { LOGIN_TITLE, gotoLogin, expectLoginChrome, submitCredentials, expectErrorAlert };
